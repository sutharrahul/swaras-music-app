import { ApiResponce } from "@/app/utils/ApiResponse";
import dbConnect from "@/lib/dbConnection";
import SongModel from "@/model/SongModel";

export async function GET() {
  await dbConnect();
  try {
    const allSongs = await SongModel.find({});

    if (allSongs.length === 0) {
      if (allSongs.length === 0) {
        return ApiResponce.success("No songs available", [], 200);
      }
    }

    return ApiResponce.success("All songs fetch successfully", allSongs, 200);
  } catch (error) {
    console.error("Error fetching songs:", error);
    return ApiResponce.error(
      "Somthing went wrong while try to fetch songs",
      500
    );
  }
}
