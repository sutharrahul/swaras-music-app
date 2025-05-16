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
      return ApiResponce.error("User already exist with username", 401);
    }

    const exisitingUserbyEmail = await UserModel.findOne({ email });

    const verifyCode = Math.floor(100000 + Math.random() * 900000).toString();

    if (exisitingUserbyEmail) {
      if (exisitingUserbyEmail.isVerified) {
        return ApiResponce.error(
          "User already exist with email and Verified",
          401
        );
      } else {
        const hashedPassword = await bcrypt.hash(password, 10);
        exisitingUserbyEmail.password = hashedPassword;
        exisitingUserbyEmail.verifyCode = verifyCode;
        exisitingUserbyEmail.verifyCodeExpiry = new Date(Date.now() + 3600000);

        const userExistbyEmail = await exisitingUserbyEmail.save();
        return ApiResponce.success(
          "User already exist with email but not verified new verification code send on email",
          {
            email: userExistbyEmail.email,
            username: userExistbyEmail.username,
            id: userExistbyEmail._id,
          },
          208
        );
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

      const emailResponse = await sendVerificationEmail(
        email,
        username,
        verifyCode
      );

      if (!emailResponse.success) {
        return ApiResponce.error(emailResponse.message, 401);
      }

      const savedUser = await newUserSignUp.save();

      console.log("Saved User", savedUser);

      return ApiResponce.success(
        "User registered successfully please verify your email",
        {
          email: savedUser.email,
          username: savedUser.username,
          id: savedUser._id,
        },
        201
      );
    }
  } catch (error) {
    console.log("Error while sign-up user", error);
    return ApiResponce.error("Error while sign-up user", 500);
  }
}
