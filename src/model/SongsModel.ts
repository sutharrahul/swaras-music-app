import mongoose, { Document, Schema } from "mongoose";

export interface Song extends Document {
  songFile: string;
  songName: string;
  singerName: string[];
}

const songSchema: Schema<Song> = new Schema({
  songFile: {
    type: String,
    required: true,
  },
  songName: {
    type: String,
    required: true,
  },
  singerName: {
    type: [String],
    required: true,
  },
});

const SongModel =
  (mongoose.models.Song as mongoose.Model<Song>) ||
  mongoose.model("Song", songSchema);

export default SongModel;
