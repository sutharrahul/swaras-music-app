import Link from 'next/link';
import { Music2 } from 'lucide-react';
import EmptyState from '@/components/states/EmptyState';

export const metadata = {
  title: 'Page not found',
};

export default function NotFound() {
  return (
    <div className="flex items-center justify-center h-full">
      <EmptyState
        icon={Music2}
        title="We could not find that page"
        description="The link may be old, or the page may have moved."
        action={
          <Link
            href="/"
            className="rounded-lg bg-primary hover:bg-primary/90 px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            Back to all songs
          </Link>
        }
      />
    </div>
  );
}
