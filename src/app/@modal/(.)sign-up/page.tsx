import AuthModal from '@/components/auth/AuthModal';
import SignUpForm from '@/components/auth/SignUpForm';

/**
 * Intercepts client-side navigation to `/sign-up`. See the `(.)sign-in` page
 * next to this one, and the `modal` prop comment in `src/app/layout.tsx`.
 */
export default function InterceptedSignUpModal() {
  return (
    <AuthModal title="Create your account">
      <SignUpForm bare />
    </AuthModal>
  );
}
