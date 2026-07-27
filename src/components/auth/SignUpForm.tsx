'use client';

import { useState, type FormEvent } from 'react';
import { Loader2, MailCheck } from 'lucide-react';

import AuthCard, { AuthError } from '@/components/auth/AuthCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/utils/supabase/client';
import { credentialsSchema, describeAuthError, fieldErrors } from '@/lib/authForm';

/**
 * Email + password sign-up.
 *
 * `emailRedirectTo` points at `/auth/callback`, which is the Route Handler that
 * exchanges the code for a session — a Server Component could not, because only
 * a Route Handler may write cookies.
 *
 * The app row in `public.users` is not created here. The `on_auth_user_created`
 * trigger does it inside GoTrue's own transaction, which is the only place it
 * can happen atomically with the auth identity. Doing it from the client would
 * mean an authenticated user with no profile whenever the second call failed.
 */
export default function SignUpForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    const parsed = credentialsSchema.safeParse({ email, password });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    setSubmitting(true);

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      ...parsed.data,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setFormError(describeAuthError(error));
      setSubmitting(false);
      return;
    }

    // With email confirmation on, Supabase returns a user and no session. It
    // returns the same shape for an address that already exists, deliberately,
    // so that this form cannot be used to enumerate accounts — which is why the
    // confirmation screen below is worded to fit either case.
    if (!data.session) {
      setSent(true);
      setSubmitting(false);
      return;
    }

    // Confirmation disabled: the session already exists. A full navigation
    // rather than router.push, so the middleware re-runs with the new cookies.
    window.location.assign('/');
  };

  if (sent) {
    return (
      <AuthCard
        title="Check your inbox"
        description="One more step before you can sign in."
        footer={{ prompt: 'Already confirmed?', linkLabel: 'Sign in', href: '/sign-in' }}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <MailCheck aria-hidden="true" className="h-10 w-10 text-brand" />
          <p className="text-sm text-muted-foreground">
            If <span className="font-medium text-white">{email}</span> can be registered, a
            confirmation link is on its way. Open it to finish creating your account.
          </p>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Create your account"
      description="Save playlists and keep every track you like."
      footer={{ prompt: 'Already have an account?', linkLabel: 'Sign in', href: '/sign-in' }}
    >
      <form onSubmit={handleSubmit} noValidate className="space-y-4">
        <AuthError message={formError} />

        <div className="space-y-2">
          <label htmlFor="email" className="block text-sm font-medium text-white">
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
            className="bg-surface-strong dark:bg-surface-strong border-border text-white"
          />
          {errors.email && (
            <p id="email-error" className="text-sm text-destructive">
              {errors.email}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="block text-sm font-medium text-white">
            Password
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            value={password}
            onChange={event => setPassword(event.target.value)}
            disabled={submitting}
            aria-invalid={Boolean(errors.password)}
            aria-describedby={errors.password ? 'password-error' : 'password-hint'}
            className="bg-surface-strong dark:bg-surface-strong border-border text-white"
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

        <Button
          type="submit"
          disabled={submitting}
          className="w-full bg-brand-gradient hover:bg-brand-gradient-hover text-white"
        >
          {submitting ? (
            <>
              <Loader2 aria-hidden="true" className="mr-2 h-4 w-4 animate-spin" />
              Creating account…
            </>
          ) : (
            'Create account'
          )}
        </Button>
      </form>
    </AuthCard>
  );
}
