import { ApiResponse } from '@/app/utils/ApiResponse';
import { privateNoStore } from '@/lib/api';
import { requireUser } from '@/lib/auth';

/**
 * Bug 6 is closed here: this used to return `userId`, the internal
 * `public.users.id`. The frontend then posted that id to
 * `/api/admin/delete-song`, which trusted it — so leaking it was half of the
 * privilege-escalation chain. Nothing the client can do needs that id any more;
 * every handler reads it from the session instead.
 */
export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  return privateNoStore(
    ApiResponse.success('User role retrieved', {
      isAdmin: auth.user.role === 'ADMIN',
      role: auth.user.role,
    })
  );
}
