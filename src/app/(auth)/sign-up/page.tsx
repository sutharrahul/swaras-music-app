'use client';
import axios from 'axios';
import { Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { LoaderCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function SingUp() {
  const [seePassword, setSeePassword] = useState('password');
  const [username, setUsername] = useState<string>();
  const [email, setEmail] = useState<string>();
  const [password, setPassword] = useState<string>();
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const router = useRouter();
  const userData = {
    username,
    email,
    password,
  };

  const handelSingUp = async () => {
    setIsCreating(true);
    try {
      const response = await axios.post('/api/sign-up', userData);

      if (!response.data.success) {
        toast.error(response?.data?.message);
        return;
      }
      toast.success(response?.data?.message);
      router.replace(`/verify/${username}`);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Server error');
      } else {
        toast.error('Something went wrong');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const passwordVisible = (e: React.MouseEvent) => {
    e.preventDefault();
    if (seePassword === 'password') {
      setSeePassword('text');
    } else {
      setSeePassword('password');
    }
  };

  return (
    <section className="bg-[#000000]">
      <div className="flex flex-col items-center justify-center px-6 py-8 mx-auto md:h-screen lg:py-0">
        <div className="w-full min-w-[330px] bg-[#141414]/80 rounded-lg shadow md:mt-0 sm:max-w-md xl:p-0  ">
          <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
            <h1 className="text-xl text-center font-bold leading-tight tracking-tight md:text-2xl text-white">
              Create an account
            </h1>
            <div className="space-y-4 md:space-y-6">
              <div>
                <label htmlFor="username" className="block mb-2 text-sm text-white">
                  username{' '}
                </label>
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="text-sm font-light rounded-lg block w-full p-2.5 bg-[#262626] border-gray-600  placeholder:font- text-white placeholder:bg-[#262626] placeholder:font-light"
                  placeholder="username"
                />
              </div>
              <div>
                <label htmlFor="email" className="block mb-2 text-sm font-medium :text-white">
                  Your email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="text-sm font-light rounded-lg block w-full p-2.5 bg-[#262626] border-gray-600  placeholder:font- text-white placeholder:bg-[#262626] placeholder:font-light"
                  placeholder="youremail@email.com"
                />
              </div>
              <div>
                <label
                  htmlFor="password"
                  className="block mb-2 text-sm font-medium text-gray-900 dark:text-white"
                >
                  Password
                </label>
                <div className="flex items-center relative">
                  <input
                    type={seePassword}
                    id="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="text-sm font-light rounded-lg block w-full p-2.5 bg-[#262626] border-gray-600  placeholder:font- text-white placeholder:bg-[#262626] placeholder:font-light"
                  />
                  <span className="absolute right-2" onClick={passwordVisible}>
                    {seePassword === 'password' ? <Eye /> : <EyeOff />}
                  </span>
                </div>
              </div>

              <button
                disabled={isCreating}
                onClick={handelSingUp}
                className="w-full  text-white bg-gradient-to-r from-[#800000] to-[#B40000]  focus:ring-1 focus:outline-none font-medium rounded-lg text-sm px-5 py-2.5 text-center "
              >
                {isCreating ? (
                  <span className="flex items-center justify-center gap-4">
                    <LoaderCircle className="animate-spin" />
                    Creating account...
                  </span>
                ) : (
                  'Create an account'
                )}
              </button>
              <p className="text-sm font-light text-white">
                Already have an account?{' '}
                <Link href="/sign-in" className="font-medium text-primary-600 hover:underline">
                  Login here
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
