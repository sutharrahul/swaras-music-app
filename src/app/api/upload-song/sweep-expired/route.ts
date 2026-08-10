import { ApiResponse } from '@/app/utils/ApiResponse';
import { requireAdmin } from '@/lib/auth';
import { sweepExpiredUploadJobs } from '@/lib/storage.server';

/**
 * Sweep upload jobs abandoned partway: mark them EXPIRED and remove whatever
 * they left in Storage with no `songs` row pointing at it. The gap this closes,
 * and its limits, are documented on `sweepExpiredUploadJobs` in
 * `src/lib/storage.server.ts` — read that before changing this file.
 *
 * NOTHING CALLS THIS ON A SCHEDULE YET. Wiring it up is one `crons` entry in
 * `vercel.json`:
 *
 *   { "path": "/api/upload-song/sweep-expired", "schedule": "0 3 * * *" }
 *
 * plus a `CRON_SECRET` env var set in the Vercel project (Vercel signs cron
 * requests with it automatically as `Authorization: Bearer <value>` — nothing
 * else needs to send that header). That change was left out of this pass
 * deliberately: it is infrastructure config outside this task's owned files,
 * and shipping a `crons` entry with no `CRON_SECRET` set would leave a
 * secret-key-backed endpoint reachable without the shared secret actually
 * configured. Add the env var first, then the cron entry, then confirm this
 * route rejects a request with no/blank `CRON_SECRET`.
 *
 * Until that is wired up, this is reachable by any signed-in ADMIN, which
 * makes it a usable manual "run the sweep now" as-is — just with no schedule
 * behind it.
 */
export async function POST(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  const isCron = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;

  if (!isCron) {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;
  }

  const result = await sweepExpiredUploadJobs();
  return ApiResponse.success('Sweep complete', result, 200);
}
