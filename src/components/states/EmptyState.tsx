import React from 'react';
import type { LucideIcon } from 'lucide-react';

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

/** Shared "there is nothing here yet" block. */
export default function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-20">
      <Icon aria-hidden="true" className="w-16 h-16 mx-auto mb-4 text-muted-foreground/50" />
      <h3 className="text-xl font-semibold text-muted-foreground mb-2">{title}</h3>
      {description && <p className="text-muted-foreground/70">{description}</p>}
      {action && <div className="mt-6 flex justify-center">{action}</div>}
    </div>
  );
}
