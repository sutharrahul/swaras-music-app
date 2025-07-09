import { ApiResponce } from "@/app/utils/ApiResponse";
import cloudinary from "@/lib/cloudinary";
import dbConnect from "@/lib/dbConnection";
import SongModel from "@/model/SongModel";
import { parseBuffer } from "music-metadata";
import { getServerSession } from "next-auth";
import { authOptions } from "../auth/[...nextauth]/options";
import UserModel from "@/model/UserModel";

export async function POST(request: Request) {
  await dbConnect();

  const session = await getServerSession(authOptions);

  if (!session) {
    return ApiResponce.error("Unauthorized: Please log in", 401);
  }

  const user = await UserModel.findOne({ email: session.user.email });

  if (!user || user.role !== "admin") {
    return ApiResponce.error("Only admins can upload songs", 403);
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    if (!file) {
      return ApiResponce.error("File is required", 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract metadata from file

    const metadata = await parseBuffer(buffer, "audio/mpeg");
    const { title, artist, album, picture, composer } = metadata.common;

    // Upload song file to Cloudinary

    const uploadSong = await new Promise<{
      secure_url: string;
      duration?: number;
    }>((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ resource_type: "video" }, (err, result) => {
          if (err || !result) reject(err);
          else resolve(result);
        })
        .end(buffer);
    });

    // Upload album art to Cloudinary (if present)
    let coverImageUrl = "";
    if (picture?.[0]) {
      const imageBuffer = picture[0].data;
      const mime = picture[0].format;

      const uploadImage = await new Promise<{ secure_url: string }>(
        (resolve, reject) => {
          cloudinary.uploader
            .upload_stream(
              {
                resource_type: "image",
                folder: "music_covers",
                format: mime.split("/")[1], // e.g., "jpeg"
              },
              (err, result) => {
                if (err || !result) reject(err);
                else resolve(result);
              }
            )
            .end(imageBuffer);
        }
      );

      coverImageUrl = uploadImage.secure_url;
    }

    const song = new SongModel({
      songFile: uploadSong.secure_url,
      duration: uploadSong?.duration,
      songName: title || "Unknown Title",
      singerName: artist ? [artist] : ["Unknown Artist"],
      composersName: composer || "Unknown composer",
      albumName: album || "",
      coverImage: coverImageUrl || "",
    });

    const newSong = await song.save();

    return ApiResponce.success("Song uploaded with metadata", newSong, 201);
  } catch (error) {
    console.error("Upload error:", error);
    return ApiResponce.error("Failed to upload song", 500);
  }
}
