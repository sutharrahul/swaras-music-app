import { ApiResponce } from "@/app/utils/ApiResponse";
import dbConnect from "@/lib/dbConnection";
import UserModel from "@/model/UserModel";
import bcrypt from "bcryptjs";
import { sendVerificationEmail } from "@/helper/sendVerificationEmail";

export async function POST(request: Request) {
  await dbConnect();
  try {
    const { username, email, password } = await request.json();

    const existingUserdByUserName = await UserModel.findOne({
      username,
      isVerified: true,
    });

    if (existingUserdByUserName) {
      return ApiResponce.error("User already exist ", 409);
    }

    const exisitingUserbyEmail = await UserModel.findOne({ email });

    const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();

    if (exisitingUserbyEmail) {
      if (exisitingUserbyEmail.isVerified) {
        return ApiResponce.error(
          "User already exist with email and Verified",
          409
        );
      } else {
        const hashedPassword = await bcrypt.hash(password, 10);
        exisitingUserbyEmail.password = hashedPassword;
        exisitingUserbyEmail.verifyCode = verifyCode;
        exisitingUserbyEmail.verifyCodeExpiry = new Date(Date.now() + 3600000);

        await exisitingUserbyEmail.save();
      }
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const verifyCodeExpiryDate = new Date();
      verifyCodeExpiryDate.setHours(verifyCodeExpiryDate.getHours() + 1);

      const newUserSignUp = new UserModel({
        username,
        email,
        password: hashedPassword,
        verifyCode,
        verifyCodeExpiry: verifyCodeExpiryDate,
        isVerified: false,
      });
      await newUserSignUp.save();
    }
    const emailResponse = await sendVerificationEmail(
      email,
      username,
      verifyCode
    );

    if (!emailResponse.success) {
      return ApiResponce.error(emailResponse.message, 500);
    }

    return ApiResponce.success(
      "User registered  successfully verification code send to your email",
      {
        username,
        email,
      },
      201
    );
  } catch (error) {
    console.error("Error during user sign-up:", error);
    return ApiResponce.error("Error while sign-up user", 500);
  }
}
