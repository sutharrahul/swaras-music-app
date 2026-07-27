import { Suspense } from 'react';
import type { Metadata } from 'next';

import SignInForm from '@/components/auth/SignInForm';

export const metadata: Metadata = { title: 'Sign in' };

/**
 * `SignInForm` reads `useSearchParams` (for `?next=` and `?error=`), which forces
 * a Suspense boundary in the App Router — without one the whole route opts out
 * of static rendering and `next build` fails on it.
 */
export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}
