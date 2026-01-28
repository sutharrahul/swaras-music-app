'use client';

import { useUser } from '@clerk/nextjs';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { LoaderCircle, Upload, CheckCircle, XCircle, Music, AlertCircle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useUserQueries } from '@/hook/query';

interface JobStatus {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  totalFiles: number;
  processedFiles: number;
  successfulFiles: number;
  failedFiles: number;
  results: Array<{
    success: boolean;
    fileName: string;
    error?: string;
  }>;
}

export default function AdminPage() {
  const { user, isLoaded } = useUser();
  const router = useRouter();
  const { useCheckAdmin } = useUserQueries();
  const { data: adminData, isLoading: isCheckingAdmin, error: adminError } = useCheckAdmin(!!user);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState<boolean>(false);
  const [currentJob, setCurrentJob] = useState<JobStatus | null>(null);
  const pollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    // Redirect non-users
    if (!user) {
      router.replace('/sign-in');
      return;
    }

    // Redirect non-admin users
    if (adminData && !adminData.data?.isAdmin) {
      toast.error('Access denied. Admin privileges required.');
      router.replace('/');
    }
  }, [user, isLoaded, adminData, router]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
  }, []);

  // Poll for job status
  const pollJobStatus = async (jobId: string) => {
    try {
      const { data } = await axios.get(`/api/upload-song?jobId=${jobId}`);

      if (data?.success && data?.data) {
        const job: JobStatus = data.data;
        setCurrentJob(job);

        // Check if job is complete
        if (job.status === 'COMPLETED') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          setUploading(false);

          // Show completion toast
          if (job.failedFiles === 0) {
            toast.success(`🎉 All ${job.successfulFiles} songs uploaded successfully!`);
          } else if (job.successfulFiles > 0) {
            toast.success(`✅ Uploaded ${job.successfulFiles} songs. ${job.failedFiles} failed.`, {
              duration: 5000,
            });
          } else {
            toast.error(`❌ All uploads failed. Please try again.`);
          }

          // Clear selection
          setSelectedFiles(null);
          setCurrentJob(null);
        } else if (job.status === 'FAILED') {
          if (pollingRef.current) {
            clearInterval(pollingRef.current);
            pollingRef.current = null;
          }
          setUploading(false);
          toast.error('Upload job failed. Please try again.');
          setCurrentJob(null);
        }
      }
    } catch (error) {
      console.error('Polling error:', error);
    }
  };

  const handleUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      toast.error('Please select at least one song file.');
      return;
    }

    if (selectedFiles.length > 10) {
      toast.error('Maximum 10 files allowed per upload.');
      return;
    }

    setUploading(true);
    const formData = new FormData();

    // Append all files
    Array.from(selectedFiles).forEach(file => {
      formData.append('files', file);
    });

    try {
      const { data } = await axios.post('/api/upload-song', formData);

      if (data?.success && data?.data?.jobId) {
        const jobId = data.data.jobId;
        toast.success(`Upload started! Processing ${data.data.totalFiles} file(s) in background.`);

        // Start polling for status
        pollJobStatus(jobId);
        pollingRef.current = setInterval(() => pollJobStatus(jobId), 5000);
      }
    } catch (error) {
      setUploading(false);
      if (axios.isAxiosError(error)) {
        toast.error(error.response?.data?.message || 'Server error');
      } else {
        toast.error('Something went wrong');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 10) {
      toast.error('Maximum 10 files allowed per upload.');
      e.target.value = ''; // Clear selection
      return;
    }
    setSelectedFiles(files);
  };

  if (!isLoaded || !user || isCheckingAdmin) {
    return (
      <div className="h-screen flex items-center justify-center text-white">
        <LoaderCircle className="animate-spin w-6 h-6 mr-2" />
        Loading admin access...
      </div>
    );
  }

  // Show error if admin check failed
  if (adminError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-white gap-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-xl">Failed to verify admin access</p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-[#B40000] rounded-lg hover:bg-[#900000] transition"
        >
          Go Home
        </button>
      </div>
    );
  }

  // Show access denied if not admin
  if (adminData && !adminData.data?.isAdmin) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-white gap-4">
        <AlertCircle className="w-12 h-12 text-red-500" />
        <p className="text-xl">Access Denied</p>
        <p className="text-gray-400">You need admin privileges to access this page</p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-[#B40000] rounded-lg hover:bg-[#900000] transition"
        >
          Go Home
        </button>
      </div>
    );
  }

  const getProgressPercentage = () => {
    if (!currentJob) return 0;
    return Math.round((currentJob.processedFiles / currentJob.totalFiles) * 100);
  };

  return (
    <div className="p-6 h-full overflow-hidden">
      <h1 className="text-2xl font-bold text-center">Admin Dashboard</h1>
      <section className="bg-[#000000]">
        <div className="flex flex-col items-center justify-center px-6 py-8 mx-auto md:h-screen lg:py-0">
          <div className="w-full min-w-[330px] bg-[#141414]/80 rounded-lg shadow md:mt-0 sm:max-w-md xl:p-0">
            <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
              <h1 className="text-xl text-center font-bold leading-tight tracking-tight md:text-2xl text-white">
                Upload Songs
              </h1>

              <div className="space-y-4 md:space-y-6">
                {/* File Input */}
                <div>
                  <label className="block mb-2 text-sm font-medium text-white">
                    Select audio files (max 10, up to 100MB each)
                  </label>
                  <input
                    type="file"
                    multiple
                    accept="audio/mpeg,audio/wav,audio/flac,audio/m4a,audio/mp4"
                    onChange={handleFileChange}
                    disabled={uploading}
                    className="text-sm font-light rounded-lg block w-full p-2.5 bg-[#262626] border-gray-600 placeholder:font- text-white placeholder:bg-[#262626] placeholder:font-light disabled:opacity-50 disabled:cursor-not-allowed"
                  />

                  {selectedFiles && selectedFiles.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="text-sm text-gray-300">
                        Selected {selectedFiles.length} file(s):
                      </p>
                      <div className="max-h-32 overflow-y-auto space-y-1">
                        {Array.from(selectedFiles).map((file, idx) => (
                          <p key={idx} className="text-xs text-[#c50707] flex items-center gap-2">
                            <Music className="w-3 h-3" />
                            {file.name} ({Math.round(file.size / 1024 / 1024)}MB)
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Progress Display */}
                {currentJob && uploading && (
                  <div className="bg-[#262626] p-4 rounded-lg space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white font-medium">Upload Progress</span>
                      <span className="text-gray-300">
                        {currentJob.processedFiles} / {currentJob.totalFiles}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-700 rounded-full h-2.5">
                      <div
                        className="bg-gradient-to-r from-[#800000] to-[#B40000] h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${getProgressPercentage()}%` }}
                      />
                    </div>

                    {/* Stats */}
                    <div className="flex justify-between text-xs">
                      <span className="text-green-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        {currentJob.successfulFiles} successful
                      </span>
                      {currentJob.failedFiles > 0 && (
                        <span className="text-red-400 flex items-center gap-1">
                          <XCircle className="w-3 h-3" />
                          {currentJob.failedFiles} failed
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-gray-400 text-center">
                      {currentJob.status === 'PROCESSING'
                        ? 'Processing in background. You can continue using the app.'
                        : 'Starting upload...'}
                    </p>
                  </div>
                )}

                {/* Upload Button */}
                <button
                  onClick={handleUpload}
                  disabled={uploading || !selectedFiles || selectedFiles.length === 0}
                  className="w-full text-white bg-gradient-to-r from-[#800000] to-[#B40000] focus:ring-1 focus:outline-none font-medium rounded-lg text-sm px-5 py-2.5 text-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {uploading ? (
                    <span className="flex items-center justify-center gap-4">
                      <LoaderCircle className="animate-spin" />
                      Uploading in background...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <Upload className="w-4 h-4" />
                      Upload{' '}
                      {selectedFiles?.length
                        ? `${selectedFiles.length} Song${selectedFiles.length > 1 ? 's' : ''}`
                        : 'Songs'}
                    </span>
                  )}
                </button>

                {/* Info Message */}
                <p className="text-xs text-gray-400 text-center">
                  Uploads happen in the background. You&apos;ll be notified when complete.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
