"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface ObConnectorCardProps {
  color: string;
  letter: string;
  name: string;
  unlocks: string[];
  connected: boolean;
  onConnect: () => void;
  recommended?: boolean;
  comingSoon?: boolean;
  connecting?: boolean;
  className?: string;
}

export function ObConnectorCard({
  color,
  letter,
  name,
  unlocks,
  connected,
  onConnect,
  recommended,
  comingSoon,
  connecting,
  className,
}: ObConnectorCardProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-xl border p-4 transition-colors",
        connected
          ? "border-[var(--ob-ok)] bg-[var(--ob-ok-soft)]"
          : "border-[var(--ob-line)] bg-[var(--ob-card)]",
        comingSoon && "opacity-60",
        className
      )}
    >
      <div
        className="flex h-11 w-11 items-center justify-center rounded-[10px] font-serif text-[22px] italic font-medium text-white"
        style={{ backgroundColor: color }}
      >
        {letter}
      </div>

      <div>
        <div className="flex items-center gap-2">
          <span className="text-base font-semibold text-[var(--ob-ink)]">
            {name}
          </span>
          {recommended && (
            <span className="rounded bg-[var(--ob-clay-soft)] px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--ob-clay)]">
              recommended
            </span>
          )}
          {comingSoon && (
            <span className="rounded bg-[var(--ob-panel)] px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-[var(--ob-ink3)]">
              coming soon
            </span>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-[var(--ob-ink2)]">
          {unlocks.map((u) => (
            <span key={u} className="inline-flex items-center gap-1.5">
              <span className="h-[3px] w-[3px] rounded-full bg-[var(--ob-ink3)]" />
              {u}
            </span>
          ))}
        </div>
      </div>

      <button
        onClick={onConnect}
        disabled={comingSoon || connecting}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-all",
          "cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
          connected ? "bg-[var(--ob-ok)]" : ""
        )}
        style={!connected ? { backgroundColor: color } : undefined}
      >
        {connecting ? (
          <>
            <svg
              className="h-3.5 w-3.5 animate-spin"
              viewBox="0 0 16 16"
              fill="none"
            >
              <circle
                cx="8"
                cy="8"
                r="6"
                stroke="currentColor"
                strokeOpacity="0.3"
                strokeWidth="1.6"
              />
              <path
                d="M8 2a6 6 0 016 6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
            Connecting...
          </>
        ) : connected ? (
          <>
            <Check className="h-3.5 w-3.5" />
            Connected
          </>
        ) : (
          "Connect"
        )}
      </button>
    </div>
  );
}
