import type { Metadata } from 'next';

import ResetPasswordForm from '@/components/auth/ResetPasswordForm';

export const metadata: Metadata = { title: 'Choose a new password' };

/**
 * Only ever reached as a full page load, from the recovery link in the email
 * (which lands on `/auth/callback?next=/reset-password`) — so there is no
 * intercepting `@modal` variant of this route.
 */
export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
