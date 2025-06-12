import mongoose, { Document, Schema } from "mongoose";

export interface Song extends Document {
  songFile: string;
  duration: number;
  songName: string;
  singerName: string[];
  composersName: string[];
  albumName?: string;
  coverImage?: string;
}

const songSchema: Schema<Song> = new Schema(
  {
    songFile: { type: String, required: true },
    duration: { type: Number },
    songName: { type: String, required: true },
    singerName: { type: [String], required: true },
    composersName: { type: [String], required: true },
    albumName: { type: String },
    coverImage: { type: String },
  },
  { timestamps: true }
);

const SongModel =
  (mongoose.models.Song as mongoose.Model<Song>) ||
  mongoose.model("Song", songSchema);

export default SongModel;
