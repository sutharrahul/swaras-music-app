import mongoose, { Schema, Document } from "mongoose";

export interface Playlist extends Document {
  playlistUser: Schema.Types.ObjectId;
  playListSong: Schema.Types.ObjectId[];
}

const playlistSchema: Schema<Playlist> = new Schema({
  playlistUser: {
    type: Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  playListSong: [
    {
      type: Schema.Types.ObjectId,
      ref: "Song",
    },
  ],
});

const PlaylistModel =
  (mongoose.models.Playlist as mongoose.Model<Playlist>) ||
  mongoose.model("Playlist", playlistSchema);

export default PlaylistModel;
