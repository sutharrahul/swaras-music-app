import { ApiResponce } from "@/app/utils/ApiResponse";
import dbConnect from "@/lib/dbConnection";
import PlaylistModel from "@/model/PlaylistModel";
import "@/model/SongModel";

export async function GET(request: Request) {
  dbConnect();
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    const userPlaylist = await PlaylistModel.findOne({
      playlistUser: userId,
    }).populate("playListSong");

    if (!userPlaylist) {
      return ApiResponce.error("User playlist not found", 404);
    }
    return ApiResponce.success(
      "User playlist fetched successfully",
      userPlaylist,
      200
    );
  } catch (error) {
    console.error("Error fetching user playlist:", error);
    return ApiResponce.error("User playlist not found", 500);
  }
}
