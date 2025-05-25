import { ApiResponce } from "@/app/utils/ApiResponse";
import dbConnect from "@/lib/dbConnection";
import SongModel from "@/model/SongsModel";

export async function GET() {
  await dbConnect();
  try {
    const allSongs = await SongModel.find({});

    if (allSongs.length === 0) {
      return ApiResponce.error("Songs are not available", 404);
    }

    return ApiResponce.success("All songs fetch successfully", allSongs, 200);
  } catch (error) {
    console.log("Somthing went wrong while try to fetch songs", error);
    return ApiResponce.error(
      "Somthing went wrong while try to fetch songs",
      500
    );
  }
}
