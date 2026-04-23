"use client";

import { cn } from "@/lib/utils";

export interface TerminalLine {
  type: string;
  path: string;
  detail: string;
}

interface ObTerminalProps {
  lines: TerminalLine[];
  showCaret?: boolean;
  className?: string;
}

function lineColor(type: string): string {
  if (type === "\u2713" || type === "done") return "text-[var(--ob-ok)]";
  if (type === "GET" || type === "read" || type === "fetch")
    return "text-[#8fb5e0]";
  return "text-[#e8d080]";
}

export function ObTerminal({
  lines,
  showCaret = true,
  className,
}: ObTerminalProps) {
  return (
    <div
      className={cn(
        "rounded-xl bg-[var(--ob-ink-d)] p-5 font-mono text-xs overflow-auto",
        className
      )}
    >
      <div className="mb-3 text-[10px] uppercase tracking-[1.4px] text-white/40">
        // live log
      </div>
      {lines.map((ln, i) => (
        <div
          key={i}
          className="flex gap-2.5 border-b border-dashed border-white/[0.06] py-1.5"
          style={{ animation: "obFadeUp 0.3s ease-out" }}
        >
          <span className={cn("w-12 shrink-0", lineColor(ln.type))}>
            {ln.type}
          </span>
          <span className="flex-1 text-white/85">{ln.path}</span>
          <span className="shrink-0 text-white/45">{ln.detail}</span>
        </div>
      ))}
      {showCaret && lines.length > 0 && (
        <span className="ob-caret text-[var(--ob-clay)]" />
      )}
    </div>
  );
}
