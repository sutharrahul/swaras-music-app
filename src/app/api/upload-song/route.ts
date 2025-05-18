import { ApiResponce } from "@/app/utils/ApiResponse";
import cloudinary from "@/lib/cloudinary";
import dbConnect from "@/lib/dbConnection";
import SongModel from "@/model/SongsModel";

export async function POST(request: Request) {
  dbConnect();

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File;
    const songName = formData.get("songName") as string;
    const singerName = formData.getAll("singerName") as string[];

    if (!file && !songName && !singerName.length) {
      return ApiResponce.error(
        "All field require. file song name singer name ",
        401
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const uploadResponse = await new Promise<{ secure_url: string }>(
      (resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ resource_type: "video" }, (error, result) => {
            if (error || !result) reject(error);
            else resolve(result);
          })
          .end(buffer);
      }
    );

    console.log(uploadResponse);

    const uploadSong = new SongModel({
      songFile: uploadResponse.secure_url,
      songName,
      singerName,
    });

    const newSong = await uploadSong.save();

    return ApiResponce.success("Song Upload successfully ", newSong, 201);
  } catch (error) {
    console.log("Song not upload error ", error);

    return ApiResponce.error("Song not upload || Request Timeout", 500);
  }
}
