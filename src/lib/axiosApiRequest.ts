import axios from "axios";

export async function getAllSongsApi() {
  try {
    const { data } = await axios.get("/api/get-songs");
    console.log(data);

    return data;
  } catch (err) {
    console.error("Failed to fetch songs", err);
    return [];
  }
}
