import mongoose from "mongoose";

type ConnectionObject = {
  isConnected?: number;
};

const connection: ConnectionObject = {};

async function dbConnect(): Promise<void> {
  if (connection.isConnected) {
    console.log("Already connected to databse");
    return;
  }
  try {
    const db = await mongoose.connect(process.env.MONGODB_URI || "");

    // console.log("dataBase connection db", db);
    connection.isConnected = db.connections[0].readyState;

    console.log("Db Connected Successfully");
  } catch (error) {
    console.log("Database connection failed ", error);
    process.exit(1);
  }
}

export default dbConnect;
