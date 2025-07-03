"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import axios from "axios";
import toast from "react-hot-toast";

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [uploadSong, setUploadSong] = useState<File | null>();
  const [uploading, setUploading] = useState<boolean>(false);

  useEffect(() => {
    if (status !== "authenticated") return;

    if (session?.user.role !== "admin") {
      router.replace("/");
    }
  }, [session, status, router]);

  const handleUpload = async () => {
    if (!uploadSong) {
      toast.error("Please select a song first.");
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append("file", uploadSong);

    try {
      const { data } = await axios.post("/api/upload-song", formData);
      if (data?.success) {
        toast.success(data?.message);
        setUploadSong(null);
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || "Server error");
      } else {
        toast.error("Something went wrong");
      }
    } finally {
      setUploading(false);
    }
  };
  if (status === "loading" || !session) {
    return (
      <div className="h-screen flex items-center justify-center text-white">
        <LoaderCircle className="animate-spin w-6 h-6 mr-2" />
        Loading admin access...
      </div>
    );
  }
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-center">Admin Dashboard</h1>
      <section className="bg-[#000000]">
        <div className="flex flex-col items-center justify-center px-6 py-8 mx-auto md:h-screen lg:py-0">
          <div className="w-full min-w-[330px] bg-[#141414]/80 rounded-lg shadow md:mt-0 sm:max-w-md xl:p-0  ">
            <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
              <h1 className="text-xl text-center font-bold leading-tight tracking-tight md:text-2xl text-white">
                Upload Song
              </h1>
              <div className="space-y-4 md:space-y-6">
                <div>
                  <label className="block mb-2 text-sm font-medium text-white">
                    Upload file
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setUploadSong(e.target.files?.[0])}
                    className="text-sm font-light rounded-lg block w-full p-2.5 bg-[#262626] border-gray-600  placeholder:font- text-white placeholder:bg-[#262626] placeholder:font-light"
                  />
                  {uploadSong && <p>Selected file: {uploadSong?.name}</p>}
                </div>

                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full text-white bg-gradient-to-r from-[#800000] to-[#B40000]  focus:ring-1 focus:outline-none font-medium rounded-lg text-sm px-5 py-2.5 text-center "
                >
                  {uploading ? (
                    <span className="flex items-center justify-center gap-4">
                      <LoaderCircle className="animate-spin" />
                      Uploading...
                    </span>
                  ) : (
                    "Upload"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
