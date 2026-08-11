/**
 * Required by parallel routes: whenever the current URL doesn't match one of
 * the intercepting routes in this slot (i.e. almost always), Next.js needs
 * something to render here on the initial load. Nothing, in this case — the
 * modal only exists while `(.)sign-in` or `(.)sign-up` is active.
 */
export default function Default() {
  return null;
}
