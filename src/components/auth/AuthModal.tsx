'use client';

import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';

/**
 * Chrome for the intercepted `/sign-in` and `/sign-up` routes. `DialogContent`
 * is stripped down to nothing (`bg-transparent p-0 shadow-none border-0`) so
 * `AuthCard`'s own `Card` — rendered `bare` by the form inside `children` — is
 * the only visible surface; without that this would show a card inside
 * Dialog's own default card-like chrome.
 *
 * `open` is always true: this component only exists on the page while the
 * intercepting route is actively matched. Closing it (Escape, backdrop click,
 * the X) calls `router.back()`, which is always safe here — interception only
 * ever fires on a client-side navigation *from* another already-loaded page,
 * so there's always a history entry to return to.
 */
export default function AuthModal({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();

  return (
    <Dialog open onOpenChange={open => !open && router.back()}>
      <DialogContent className="max-w-md border-0 bg-transparent p-0 shadow-none sm:max-w-md">
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
