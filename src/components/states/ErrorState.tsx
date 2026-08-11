'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

type ErrorStateProps = {
  title?: string;
  description?: string;
  /** Rendered as the primary button when supplied. */
  onRetry?: () => void;
  retryLabel?: string;
  action?: React.ReactNode;
};

/** Shared failure block — used by every `error.tsx` and by inline fetch errors. */
export default function ErrorState({
  title = 'Something went wrong',
  description = 'That did not work. Try again, and if it keeps happening come back in a bit.',
  onRetry,
  retryLabel = 'Try again',
  action,
}: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-4 py-20 text-center">
      <AlertCircle aria-hidden="true" className="w-12 h-12 text-destructive" />
      <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      <p className="max-w-md text-muted-foreground">{description}</p>
      <div className="flex items-center gap-3">
        {onRetry && (
          <Button onClick={onRetry} className="bg-primary hover:bg-primary/90 text-primary-foreground">
            {retryLabel}
          </Button>
        )}
        {action}
      </div>
    </div>
  );
}
