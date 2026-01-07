'use client';

import { useParams, useRouter } from 'next/navigation';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { LoaderCircle } from 'lucide-react';
import axios from 'axios';

export default function VerifyAccount() {
  const [verifyCode, setVerifyCode] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState<boolean>(false);
  const router = useRouter();
  const params = useParams<{ username: string }>();

  const isButtonDisabled = verifyCode.length < 4 || isVerifying;

  const verifyAccount = async () => {
    setIsVerifying(true);
    try {
      const { data } = await axios.post('/api/verify-code', {
        username: params?.username,
        code: verifyCode,
      });

      if (data.success) {
        toast.success('User Verified');
        router.replace('/');
      }
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const errorMsg = error.response?.data?.message || 'Unable to verify user';
        toast.error(errorMsg);
      } else {
        toast.error('Something went wrong');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <section className="bg-[#000000] h-full">
      <div className="flex flex-col items-center justify-center px-6 py-8 mx-auto md:h-screen lg:py-0  h-full">
        <div className="w-full min-w-[330px] bg-[#141414]/80 rounded-lg shadow md:mt-0 sm:max-w-md xl:p-0  ">
          <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
            <h1 className="text-xl text-center font-bold leading-tight tracking-tight md:text-2xl text-white">
              Verify Your Account
            </h1>
            <div className="space-y-4 md:space-y-6">
              <div>
                <label className="block mb-2  font-medium text-white">
                  Enter Verification Code
                </label>
                <input
                  type="text"
                  value={verifyCode}
                  onChange={e => setVerifyCode(e.target.value)}
                  className="text-sm font-light rounded-lg block w-full p-2.5 bg-[#262626] border-gray-600  placeholder:font- text-white placeholder:bg-[#262626] placeholder:font-light"
                  placeholder="XXXX"
                />
              </div>
              <button
                disabled={isButtonDisabled}
                onClick={verifyAccount}
                className="w-full text-white bg-gradient-to-r from-[#800000] to-[#B40000]  focus:ring-1 focus:outline-none font-medium rounded-lg text-sm px-5 py-2.5 text-center cursor-pointer"
              >
                {isVerifying ? (
                  <span className="flex items-center justify-center gap-4">
                    <LoaderCircle className="animate-spin" />
                    verifying...
                  </span>
                ) : (
                  'Verify'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
