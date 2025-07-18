import { ApiResponce } from "@/app/utils/ApiResponse";
import dbConnect from "@/lib/dbConnection";
import PlaylistModel from "@/model/PlaylistModel";

export async function POST(request: Request) {
  dbConnect();
  try {
    const { userId, songId } = await request.json();

    const user = await PlaylistModel.findOne({ playlistUser: userId });

    if (!user) {
      const savedUser = new PlaylistModel({
        playlistUser: userId,
        playListSong: [songId],
      });

      const saveResponse = await savedUser.save();

      return ApiResponce.success("User and Playlist add", saveResponse, 200);
    }

    const songInPlaylist = await PlaylistModel.findOne({
      playlistUser: userId,
      playListSong: songId,
    });
    if (songInPlaylist) {
      return ApiResponce.error("Song is already exist in playlist", 409);
    }

    user?.playListSong.push(songId);
    const saveResponse = await user.save();

    return ApiResponce.success("Song add to playlist", saveResponse, 200);
  } catch (error) {
    console.error("Error adding song to playlist:", error);
    return ApiResponce.error("Faild add song to playlist", 500);
  }
}
