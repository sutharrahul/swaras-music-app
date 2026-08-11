/**
 * The few colour values that have to exist outside CSS.
 *
 * Everything the app renders itself uses the design tokens in `globals.css`.
 * What is left here are the two places that cannot read a CSS variable: the
 * `<meta name="theme-color">` value, which the browser chrome consumes before
 * any stylesheet applies, and react-hot-toast's inline `style` object.
 *
 * This file used to also hold `clerkAppearance` and the full brand/surface
 * palette that existed only to feed it — Clerk derived hover and border shades
 * internally and could not be handed a `var(--brand)`. Supabase Auth has no
 * appearance API: the sign-in and sign-up pages are our own components built
 * from the shadcn primitives and the CSS tokens, so the duplicated palette is
 * gone with it.
 */

/** Mirrors `--background` in globals.css — for <meta name="theme-color">. */
export const themeColor = '#f5f4ee';

/** react-hot-toast styling; mirrors `--surface-subtle` / `--foreground`. */
export const toastOptions = {
  style: {
    background: '#fbfaf5',
    color: '#1e2a2a',
  },
};
