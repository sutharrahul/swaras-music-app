'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, TriangleAlert } from 'lucide-react';

import AuthCard, { AuthError } from '@/components/auth/AuthCard';
import PasswordInput from '@/components/auth/PasswordInput';
import { Button } from '@/components/ui/button';
import { createClient } from '@/utils/supabase/client';
import { describeAuthError, fieldErrors, newPasswordSchema } from '@/lib/authForm';

/**
 * The second half of the recovery flow: the screen the emailed link lands on.
 *
 * By the time this renders, `/auth/callback` has already traded the `code` for a
 * recovery session, so `updateUser` needs nothing from the URL — the session is
 * the proof. That also means no session at all is the failure signal: the link
 * expired, was already spent, or was opened in a browser other than the one that
 * asked for it. The form is hidden in that case rather than shown and left to
 * fail on submit.
 */
export default function ResetPasswordForm({ bare = false }: { bare?: boolean }) {
  const router = useRouter();

  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (active) setHasSession(Boolean(data.session));
    });

    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const parsed = newPasswordSchema.safeParse({ password, confirmPassword });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password: parsed.data.password });

    if (error) {
      setFormError(describeAuthError(error));
      setSubmitting(false);
      return;
    }

    // refresh() re-runs the middleware and every Server Component with the new
    // cookies. Without it the shell keeps rendering its signed-out state.
    router.replace('/');
    router.refresh();
  };

  if (hasSession === null) {
    return (
      <AuthCard
        title="Choose a new password"
        description="Checking your recovery link."
        footer={{ prompt: 'Changed your mind?', linkLabel: 'Sign in', href: '/sign-in' }}
        bare={bare}
      >
        <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
          Checking your link…
        </div>
      </AuthCard>
    );
  }

  if (!hasSession) {
    return (
      <AuthCard
        title="That link has expired"
        description="Recovery links are single-use and short-lived."
        footer={{ prompt: 'Changed your mind?', linkLabel: 'Sign in', href: '/sign-in' }}
        bare={bare}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <TriangleAlert aria-hidden="true" className="h-10 w-10 text-brand" />
          <p className="text-sm text-muted-foreground">
            This link has expired, has already been used, or was opened in a different browser.{' '}
            <Link
              href="/forgot-password"
              className="font-semibold text-brand underline-offset-4 hover:underline"
            >
              Request a new one
            </Link>
            .
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Choose a new password"
      description="Pick something you haven't used here before."
      footer={{ prompt: 'Changed your mind?', linkLabel: 'Sign in', href: '/sign-in' }}
      bare={bare}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <AuthError message={formError} />

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-foreground">
            New password
          </label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={event => setPassword(event.target.value)}
            disabled={submitting}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : 'password-hint'}
            className="bg-surface-strong border-border text-foreground"
          />
          {errors.password ? (
            <p id="password-error" className="text-sm text-destructive">
              {errors.password}
            </p>
          ) : (
            <p id="password-hint" className="text-xs text-muted-foreground">
              Use at least 8 characters.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
            Confirm new password
          </label>
          <PasswordInput
            id="confirmPassword"
            name="confirmPassword"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={event => setConfirmPassword(event.target.value)}
            disabled={submitting}
            aria-invalid={Boolean(errors.confirmPassword)}
            aria-describedby={errors.confirmPassword ? 'confirmPassword-error' : undefined}
            className="bg-surface-strong border-border text-foreground"
          />
          {errors.confirmPassword && (
            <p id="confirmPassword-error" className="text-sm text-destructive">
              {errors.confirmPassword}
            </p>
          )}
        </div>

        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {submitting ? (
            <>
              <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            'Save new password'
          )}
        </Button>
      </form>
    </AuthCard>
  );
}
