'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, MailCheck } from 'lucide-react';

import AuthCard, { AuthError } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/utils/supabase/client';
import { describeAuthError, emailSchema, fieldErrors } from '@/lib/authForm';

/**
 * Step one of a password reset: ask for the address, send the recovery link.
 *
 * `redirectTo` points at `/auth/callback`, the same Route Handler the sign-up
 * confirmation uses — it exchanges the `?code=` for a session and then forwards
 * to the validated `next`, which here is the screen that sets the new password.
 * Built with `new URL()` so `next` is encoded rather than concatenated.
 */
export default function ForgotPasswordForm({ bare = false }: { bare?: boolean }) {
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const parsed = emailSchema.safeParse({ email });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);

    const supabase = createClient();
    const redirectTo = new URL('/auth/callback', window.location.origin);
    redirectTo.searchParams.set('next', '/reset-password');

    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
      redirectTo: redirectTo.toString(),
    });

    // Only failures that cannot depend on whether the address is registered are
    // shown: a 429 is rate limiting, and a missing or 5xx status is a transport
    // or server fault that never got as far as looking the user up. Everything
    // else — "user not found" and its rewordings — falls through to the same
    // confirmation a real send produces. Reporting it would make this form an
    // account-enumeration oracle: anyone could type addresses in and read back
    // which ones have accounts here, which is exactly what the sign-in and
    // sign-up forms already refuse to leak.
    if (error && (error.status === 429 || !error.status || error.status >= 500)) {
      setFormError(describeAuthError(error));
      setSubmitting(false);
      return;
    }

    setSent(true);
    setSubmitting(false);
  };

  if (sent) {
    return (
      <AuthCard
        title="Check your inbox"
        description="The link is good for a single use."
        footer={{ prompt: 'Remembered it?', linkLabel: 'Sign in', href: '/sign-in' }}
        bare={bare}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <MailCheck aria-hidden="true" className="h-10 w-10 text-brand" />
          <p className="text-sm text-muted-foreground">
            If an account exists for <span className="font-medium text-foreground">{email}</span>, a
            reset link is on its way. Open it to choose a new password.
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Reset your password"
      description="Tell us your email and we'll send you a link to set a new one."
      footer={{ prompt: 'Remembered it?', linkLabel: 'Sign in', href: '/sign-in' }}
      bare={bare}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <AuthError message={formError} />

        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-foreground">
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={event => setEmail(event.target.value)}
            disabled={submitting}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? 'email-error' : undefined}
            className="bg-surface-strong border-border text-foreground"
          />
          {errors.email && (
            <p id="email-error" className="text-sm text-destructive">
              {errors.email}
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
              Sending link…
            </>
          ) : (
            'Send reset link'
          )}
        </Button>
      </form>
    </AuthCard>
  );
}
