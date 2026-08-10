'use client';

import { useSupabaseUser } from '@/hooks/useSupabaseUser';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect } from 'react';
import { LoaderCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import { useUserQueries } from '@/hook/query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import ManageSongsPanel from '@/components/admin/ManageSongsPanel';
import UploadSongsPanel from '@/components/admin/UploadSongsPanel';

/**
 * `/admin`, gated the same way `/admin/upload-song` used to be: the middleware
 * (`src/utils/supabase/middleware.ts`) only requires a signed-in session for
 * this path, not an admin role. The check below is for RENDERING ONLY — every
 * mutating endpoint underneath (`delete-song`, `upload-song`, `.../complete`)
 * independently re-checks with `requireAdmin()`.
 */
function AdminPageContent() {
  const { user, isLoaded } = useSupabaseUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { useCheckAdmin } = useUserQueries();
  const { data: adminData, isLoading: isCheckingAdmin, error: adminError } = useCheckAdmin(!!user);

  const initialTab = searchParams.get('tab') === 'upload' ? 'upload' : 'manage';

  useEffect(() => {
    if (!isLoaded) return;

    if (!user) {
      router.replace('/sign-in');
      return;
    }

    if (adminData && !adminData.data?.isAdmin) {
      toast.error('Access denied. Admin privileges required.');
      router.replace('/');
    }
  }, [user, isLoaded, adminData, router]);

  if (!isLoaded || !user || isCheckingAdmin) {
    return (
      <div role="status" className="h-screen flex items-center justify-center text-white">
        <LoaderCircle aria-hidden="true" className="animate-spin w-6 h-6 mr-2" />
        Loading admin access...
      </div>
    );
  }

  if (adminError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-white gap-4">
        <AlertCircle aria-hidden="true" className="w-12 h-12 text-red-500" />
        <p className="text-xl">Failed to verify admin access</p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-primary rounded-lg hover:bg-brand-hover transition"
        >
          Go Home
        </button>
      </div>
    );
  }

  if (adminData && !adminData.data?.isAdmin) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-white gap-4">
        <AlertCircle aria-hidden="true" className="w-12 h-12 text-red-500" />
        <p className="text-xl">Access Denied</p>
        <p className="text-muted-foreground">You need admin privileges to access this page</p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-primary rounded-lg hover:bg-brand-hover transition"
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-center mb-6">Admin Dashboard</h1>

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="mx-auto">
          <TabsTrigger value="manage">Manage Songs</TabsTrigger>
          <TabsTrigger value="upload">Upload</TabsTrigger>
        </TabsList>

        <TabsContent value="manage">
          <ManageSongsPanel />
        </TabsContent>

        <TabsContent value="upload">
          <UploadSongsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <div role="status" className="h-screen flex items-center justify-center text-white">
          <LoaderCircle aria-hidden="true" className="animate-spin w-6 h-6 mr-2" />
          Loading admin access...
        </div>
      }
    >
      <AdminPageContent />
    </Suspense>
  );
}
