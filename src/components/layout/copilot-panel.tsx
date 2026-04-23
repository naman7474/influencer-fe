"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { ChatContent } from "@/components/agent/chat-content";

interface CopilotPanelProps {
  open: boolean;
  onToggle: () => void;
}

export function CopilotPanel({ open, onToggle }: CopilotPanelProps) {
  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col h-screen sticky top-0 border-l border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out overflow-hidden shrink-0",
        open ? "w-[340px]" : "w-[40px]"
      )}
    >
      {open ? (
        <ChatContent
          isVisible={open}
          onClose={onToggle}
          showCloseButton={true}
        />
      ) : (
        /* Collapsed strip — sparkle toggle */
        <button
          onClick={onToggle}
          className="flex flex-col items-center justify-center h-full w-full text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Open Illaya"
        >
          <Sparkles className="size-4" />
        </button>
      )}
    </aside>
  );
}
