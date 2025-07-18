"use client";

import { Eye, EyeOff } from "lucide-react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useState } from "react";
import toast from "react-hot-toast";
import { LoaderCircle } from "lucide-react";

export default function SignIn() {
  const [emailOrUsername, setEmailOrUsername] = useState<string>();
  const [password, setPassword] = useState<string>();
  const [seePassword, setSeePassword] = useState("password");
  const [isSignin, setIsSignin] = useState<boolean>(false);
  const router = useRouter();

  const handleSignIn = async () => {
    setIsSignin(true);
    try {
      const result = await signIn("credentials", {
        identifier: emailOrUsername,
        password: password,
      });

      console.log("show result ", result);

      if (result?.error) {
        toast.error("Invalid Id and Password");
      }
      if (result?.url) {
        router.replace("/");
      }
    } catch (error: any) {
      toast.error("Somthing went wrong", error);
    } finally {
      setIsSignin(false);
    }
  };

  const passwordVisible = (e: React.MouseEvent) => {
    e.preventDefault();
    if (seePassword === "password") {
      setSeePassword("text");
    } else {
      setSeePassword("password");
    }
  };

  return (
    <section className="bg-[#000000]">
      <div className="flex flex-col items-center justify-center px-6 py-8 mx-auto md:h-screen lg:py-0">
        <div className="w-full min-w-[330px] bg-[#141414]/80 rounded-lg shadow md:mt-0 sm:max-w-md xl:p-0  ">
          <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
            <h1 className="text-xl text-center font-bold leading-tight tracking-tight md:text-2xl text-white">
              Sign in to your account
            </h1>
            <div className="space-y-4 md:space-y-6">
              <div>
                <label className="block mb-2 text-sm font-medium text-white">
                  username or email
                </label>
                <input
                  type="text"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  className="text-sm font-light rounded-lg block w-full p-2.5 bg-[#262626] border-gray-600  placeholder:font- text-white placeholder:bg-[#262626] placeholder:font-light"
                  placeholder="username or email"
                />
              </div>
              <div>
                <label className="block mb-2 text-sm font-medium text-white ">
                  Password
                </label>
                <div className="flex items-center relative">
                  <input
                    type={seePassword}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="text-sm font-light rounded-lg block w-full p-2.5 bg-[#262626] border-gray-600  placeholder:font- text-white placeholder:bg-[#262626] placeholder:font-light"
                  />
                  <span className="absolute right-2" onClick={passwordVisible}>
                    {seePassword === "password" ? <Eye /> : <EyeOff />}
                  </span>
                </div>
              </div>
              <button
                onClick={handleSignIn}
                className="w-full text-white bg-gradient-to-r from-[#800000] to-[#B40000]  focus:ring-1 focus:outline-none font-medium rounded-lg text-sm px-5 py-2.5 text-center "
              >
                {isSignin ? (
                  <span className="flex items-center justify-center gap-4">
                    <LoaderCircle className="animate-spin" />
                    Sing In...
                  </span>
                ) : (
                  "Sing in"
                )}
              </button>
              <p className="text-sm font-light text-white">
                Don&rsquo;t have an account yet?
                <Link
                  href="/sign-up"
                  className="font-medium text-[#B40000] hover:underline"
                >
                  {" "}
                  Sign-up
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
