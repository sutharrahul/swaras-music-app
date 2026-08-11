import Link from 'next/link';
import type { ReactNode } from 'react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

/**
 * Shared chrome for the sign-in and sign-up screens.
 *
 * Clerk used to draw these, styled through `clerkAppearance` — a second,
 * duplicated palette of literal hexes that existed only because Clerk could not
 * be handed a CSS variable. These are our own components now, so they use the
 * tokens directly (`bg-card`, `text-brand-gradient`, `border-border`)
 * and there is no hex anywhere in `src/**.tsx` to drift out of sync.
 */
export default function AuthCard({
  title,
  description,
  children,
  footer,
  bare = false,
}: {
  title: string;
  description: string;
  children: ReactNode;
  footer: { prompt: string; linkLabel: string; href: string };
  /**
   * Skips the outer `min-h-full` centering wrapper. The full-page routes
   * (`/sign-in`, `/sign-up`) need it to center within the page; `AuthModal`
   * doesn't — the `Dialog` it renders into already centers its content on the
   * screen, and a second centering wrapper inside a modal that's already
   * sized to its content just adds dead space.
   */
  bare?: boolean;
}) {
  const card = (
    <Card className="w-full max-w-md border-border bg-card">
      <CardHeader className="text-center">
        <CardTitle className="text-brand-gradient text-2xl font-bold">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {children}
        <p className="text-center text-sm text-muted-foreground">
          {footer.prompt}{' '}
          <Link
            href={footer.href}
            className="font-semibold text-brand underline-offset-4 hover:underline"
          >
            {footer.linkLabel}
          </Link>
        </p>
      </CardContent>
    </Card>
  );

  if (bare) return card;

  return <div className="flex min-h-full items-center justify-center px-4 py-10">{card}</div>;
}

/**
 * The form-level error. `role="alert"` so a screen reader announces a failed
 * sign-in without the user having to go looking for it.
 */
export function AuthError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {message}
    </p>
  );
}
