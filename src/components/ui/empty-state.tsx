"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

interface EmptyStateAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

export interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: EmptyStateAction;
}

/**
 * Reusable empty state component for pages/sections with no data.
 * Renders a centered icon, title, description, and optional action button.
 */
export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
      <div className="mb-4 text-muted-foreground [&>svg]:size-12">{icon}</div>
      <h3 className="text-lg font-semibold text-foreground">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {action && (
        <div className="mt-4">
          {action.href ? (
            <Button render={<Link href={action.href} />}>{action.label}</Button>
          ) : action.onClick ? (
            <Button onClick={action.onClick}>{action.label}</Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
