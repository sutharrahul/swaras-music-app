import { ApiResponce } from "@/app/utils/ApiResponse";
import dbConnect from "@/lib/dbConnection";
import UserModel from "@/model/UserModel";

export async function POST(request: Request) {
  await dbConnect();
  try {
    const { username, code } = await request.json();

    const decodedUsername = decodeURIComponent(username);

    const user = await UserModel.findOne({ username: decodedUsername });
    if (!user?.username) {
      return ApiResponce.error("User not exist ", 401);
    }
    if (user.isVerified) {
      return ApiResponce.error("User already verified", 401);
    }

    const isVerified = user.verifyCode == code;
    const isCodeNotExpired = new Date(user.verifyCodeExpiry) > new Date();

    if (isVerified && isCodeNotExpired) {
      user.isVerified = true;
      await user.save();

      return ApiResponce.success("Account verified successfully", 200);
    } else if (!isCodeNotExpired) {
      return ApiResponce.error(
        "Verification code has expired. Please sign up again to get a new code.",
        400
      );
    } else {
      return ApiResponce.error("Incorrect Verification code", 400);
    }
  } catch (error) {
    return ApiResponce.error("Error verifying user", 500);
  }
}
