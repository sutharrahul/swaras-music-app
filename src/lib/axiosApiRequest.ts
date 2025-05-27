import axios from "axios";

export async function getAllSongsApi() {
  try {
    const response = await axios.get("/api/get-songs");
    return response.data.data;
  } catch (err) {
    console.error("Failed to fetch songs", err);
    return [];
  }
}
