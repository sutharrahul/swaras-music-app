import { ApiResponce } from "@/app/utils/ApiResponse";
import dbConnect from "@/lib/dbConnection";
import PlaylistModel from "@/model/PlaylistModel";

export async function DELETE(request: Request) {
  dbConnect();
  try {
    const { userId, songId } = await request.json();

    if (!userId && !songId) {
      return ApiResponce.error("User Id or Song Id missing ", 401);
    }

    const updatedPlaylist = await PlaylistModel.findOneAndUpdate(
      {
        playlistUser: userId,
      },
      {
        $pull: {
          playListSong: songId,
        },
      },
      {
        new: true,
      }
    );

    if (!updatedPlaylist) {
      return ApiResponce.error("Playlist not found", 401);
    }

    return ApiResponce.success("Song removed", updatedPlaylist, 201);
  } catch (error) {
    console.error("Error removing song from playlist:", error);
    return ApiResponce.error("Faild remove song from playlist", 500);
    
  }
}
