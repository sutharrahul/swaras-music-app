import { Suspense } from 'react';

import AuthModal from '@/components/auth/AuthModal';
import SignInForm from '@/components/auth/SignInForm';

/**
 * Intercepts client-side navigation to `/sign-in` (e.g. the "Sign in" link in
 * `UserMenu`) and renders it as a modal over whatever page is already
 * showing, instead of navigating away. See the `modal` prop comment in
 * `src/app/layout.tsx` for how this composes with the real
 * `src/app/sign-in/page.tsx`.
 */
export default function InterceptedSignInModal() {
  return (
    <AuthModal title="Sign in">
      <Suspense fallback={null}>
        <SignInForm bare />
      </Suspense>
    </AuthModal>
  );
}
