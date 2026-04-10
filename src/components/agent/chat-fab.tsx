"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ChatFABProps {
  onClick: () => void;
  hasUnread?: boolean;
}

export function ChatFAB({ onClick, hasUnread }: ChatFABProps) {
  return (
    <Button
      onClick={onClick}
      className={cn(
        "fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full shadow-lg",
        "bg-[var(--accent-primary,#6366F1)] hover:bg-[var(--accent-primary-hover,#4F46E5)]",
        "text-white",
        "md:bottom-8 md:right-8",
        "transition-all duration-200 hover:scale-105"
      )}
      size="icon"
    >
      <Sparkles className="h-6 w-6" />
      {hasUnread && (
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 ring-2 ring-background" />
      )}
    </Button>
  );
}
