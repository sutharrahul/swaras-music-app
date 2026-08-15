import AuthModal from '@/components/auth/AuthModal';
import ForgotPasswordForm from '@/components/auth/ForgotPasswordForm';

/**
 * Intercepts client-side navigation to `/forgot-password` — in practice the
 * "Forgot password?" link inside the sign-in modal, which swaps the modal's
 * contents instead of navigating the page away. See the `(.)sign-in` page next
 * to this one, and the `modal` prop comment in `src/app/layout.tsx`.
 */
export default function InterceptedForgotPasswordModal() {
  return (
    <AuthModal title="Reset your password">
      <ForgotPasswordForm bare />
    </AuthModal>
  );
}
