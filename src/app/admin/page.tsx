'use client';

import { useSupabaseUser } from '@/hooks/useSupabaseUser';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { LoaderCircle, AlertCircle, Search } from 'lucide-react';
import toast from 'react-hot-toast';

import { useUserQueries } from '@/hook/query';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import ArtistsPanel from '@/components/admin/ArtistsPanel';
import ManageSongsPanel from '@/components/admin/ManageSongsPanel';
import UploadSongsPanel from '@/components/admin/UploadSongsPanel';

type AdminTab = 'manage' | 'upload' | 'artists';

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

  const tabParam = searchParams.get('tab');
  const initialTab: AdminTab =
    tabParam === 'upload' ? 'upload' : tabParam === 'artists' ? 'artists' : 'manage';
  const [activeTab, setActiveTab] = useState<AdminTab>(initialTab);
  const [search, setSearch] = useState('');
  const [songCount, setSongCount] = useState<number | null>(null);
  const [artistCount, setArtistCount] = useState<number | null>(null);

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
      <div role="status" className="h-screen flex items-center justify-center text-foreground">
        <LoaderCircle aria-hidden="true" className="animate-spin w-6 h-6 mr-2" />
        Loading admin access...
      </div>
    );
  }

  if (adminError) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-foreground gap-4">
        <AlertCircle aria-hidden="true" className="w-12 h-12 text-red-500" />
        <p className="text-xl">Failed to verify admin access</p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition"
        >
          Go Home
        </button>
      </div>
    );
  }

  if (adminData && !adminData.data?.isAdmin) {
    return (
      <div className="h-screen flex flex-col items-center justify-center text-foreground gap-4">
        <AlertCircle aria-hidden="true" className="w-12 h-12 text-red-500" />
        <p className="text-xl">Access Denied</p>
        <p className="text-muted-foreground">You need admin privileges to access this page</p>
        <button
          onClick={() => router.push('/')}
          className="px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg transition"
        >
          Go Home
        </button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>

      <Tabs
        value={activeTab}
        onValueChange={value => setActiveTab(value as AdminTab)}
        className="w-full"
      >
        {/* Tabs and search share one row so switching sections doesn't cost a
            whole extra row of vertical space. Search only means something on the
            two list tabs, so it only appears there. */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-0">
          <TabsList variant="line">
            <TabsTrigger value="manage" className="data-[state=active]:after:bg-primary">
              Manage Songs
              {songCount !== null && (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
                  {songCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="artists" className="data-[state=active]:after:bg-primary">
              Artists
              {artistCount !== null && (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-[10px] leading-none text-muted-foreground">
                  {artistCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="upload" className="data-[state=active]:after:bg-primary">
              Upload
            </TabsTrigger>
          </TabsList>

          {(activeTab === 'manage' || activeTab === 'artists') && (
            <div className="relative w-full sm:w-64">
              <Search
                aria-hidden="true"
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder={
                  activeTab === 'artists' ? 'Search artists' : 'Search by title or artist'
                }
                aria-label={activeTab === 'artists' ? 'Search artists' : 'Search songs'}
                className="h-8 pl-9"
              />
            </div>
          )}
        </div>

        <TabsContent value="manage" className="pt-4">
          <ManageSongsPanel search={search} onCountChange={setSongCount} />
        </TabsContent>

        <TabsContent value="artists" className="pt-4">
          <ArtistsPanel search={search} onCountChange={setArtistCount} />
        </TabsContent>

        <TabsContent value="upload" className="pt-4">
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
        <div role="status" className="h-screen flex items-center justify-center text-foreground">
          <LoaderCircle aria-hidden="true" className="animate-spin w-6 h-6 mr-2" />
          Loading admin access...
        </div>
      }
    >
      <AdminPageContent />
    </Suspense>
  );
}
