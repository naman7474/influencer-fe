"use client";

import Link from "next/link";
import { useHighlightFocus } from "./highlight-focus-context";
import { cn } from "@/lib/utils";

/**
 * Clickable @handle pill rendered inline in assistant markdown.
 * - If the handle maps to a highlight in the panel, clicking focuses it.
 * - Otherwise it links to the creators page as a fallback so the user
 *   can always click through.
 */
export function HandlePill({ handle }: { handle: string }) {
  const { resolveHandle, focusHighlight } = useHighlightFocus();
  const targetId = resolveHandle(handle);

  const base =
    "inline-flex items-center rounded-full px-1.5 py-px text-[11px] font-mono align-baseline bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-primary/40";

  if (targetId) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          focusHighlight(targetId);
        }}
        className={cn(base)}
      >
        @{handle}
      </button>
    );
  }
  return (
    <Link href={`/creators?q=${encodeURIComponent(handle)}`} className={cn(base)}>
      @{handle}
    </Link>
  );
}
