/**
 * Validation and error text shared by the sign-in and sign-up forms.
 *
 * Kept out of the components so both screens agree on what a valid password is
 * and on how a failure is phrased.
 */

import type { AuthError } from '@supabase/supabase-js';
import { z } from 'zod';

/**
 * 8 characters is Supabase Auth's own default minimum. Matching it here means a
 * too-short password is rejected inline instead of after a round-trip.
 */
export const credentialsSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * Just the email, for the screen that asks for a recovery link — reusing
 * `credentialsSchema` there would demand a password nobody has yet.
 */
export const emailSchema = z.object({
  email: z.email('Enter a valid email address'),
});

/**
 * The password half of the reset screen. Same 8-character floor as
 * `credentialsSchema` — a reset must not be a way around the sign-up rule.
 * The mismatch issue is attached to `confirmPassword` so it renders under the
 * field the user has to retype, not under the one they already got right.
 */
export const newPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine(values => values.password === values.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

/** zod issues keyed by field, for rendering next to the input that caused them. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!result[key]) result[key] = issue.message;
  }
  return result;
}

/**
 * Supabase's own message, but only where we recognise it.
 *
 * Anything unrecognised becomes a generic line: provider error strings change
 * between releases and occasionally carry more detail than a signed-out visitor
 * should see. Note that "invalid credentials" deliberately does not say whether
 * the email exists — distinguishing the two turns the sign-in form into an
 * account-enumeration oracle.
 */
export function describeAuthError(error: AuthError): string {
  const message = error.message.toLowerCase();

  if (message.includes('invalid login credentials')) {
    return 'That email and password combination is not right.';
  }
  if (message.includes('email not confirmed')) {
    return 'Confirm your email address first — check your inbox for the link.';
  }
  if (message.includes('already registered') || message.includes('already been registered')) {
    return 'An account with that email already exists. Try signing in instead.';
  }
  if (message.includes('rate limit') || error.status === 429) {
    return 'Too many attempts. Wait a minute and try again.';
  }
  if (message.includes('password')) {
    return 'That password was rejected. Pick a longer or less common one.';
  }
  return 'Something went wrong. Please try again.';
}

/**
 * Only a same-site absolute path is allowed as a post-sign-in destination.
 * `//evil.example` is a valid URL to a browser, so the second character is
 * checked too — otherwise `?next=//evil.example` becomes an open redirect off
 * the back of a successful login.
 */
export function safeNextPath(next: string | null): string {
  return next && /^\/(?!\/)/.test(next) ? next : '/';
}
