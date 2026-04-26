"use client";

import { ArrowUp, Loader2, Square } from "lucide-react";

/* ── Types ─────────────────────────────────────────────── */

interface ChatInputRedesignProps {
  input: string;
  onInputChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onSend: () => void;
  isLoading: boolean;
  inputRef: React.RefObject<HTMLTextAreaElement | null>;
}

/* ── Component ─────────────────────────────────────────── */

export function ChatInputRedesign({
  input,
  onInputChange,
  onKeyDown,
  onSend,
  isLoading,
  inputRef,
}: ChatInputRedesignProps) {
  return (
    <div style={{ background: "var(--background)" }} className="shrink-0 px-4 pb-4 pt-2">
      <div className="mx-auto max-w-[720px]">
        {/* Streaming indicator */}
        {isLoading && (
          <div
            className="mb-2 flex items-center gap-2 text-[11.5px]"
            style={{ color: "var(--fg-dim)" }}
          >
            <span className="flex gap-1">
              <span
                className="dot-pulse h-1 w-1 rounded-full"
                style={{ background: "var(--primary)" }}
              />
              <span
                className="dot-pulse h-1 w-1 rounded-full"
                style={{ background: "var(--primary)" }}
              />
              <span
                className="dot-pulse h-1 w-1 rounded-full"
                style={{ background: "var(--primary)" }}
              />
            </span>
            <span>Agent is working…</span>
            <div className="flex-1" />
            <button
              className="flex items-center gap-1 px-1.5 py-0.5 rounded transition-colors hover:bg-surface-2"
              style={{ color: "var(--muted-foreground)" }}
            >
              <Square className="h-2.5 w-2.5" />
              <span>Stop</span>
              <kbd className="text-[10px] font-mono px-1 py-0.5 rounded border bg-card ml-0.5" style={{ color: "var(--fg-dim)" }}>
                esc
              </kbd>
            </button>
          </div>
        )}

        {/* Input card */}
        <div
          className="agent-ring transition-all rounded-2xl shadow-sm"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={onInputChange}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Ask, plan, or delegate…"
            className="w-full resize-none bg-transparent px-4 pt-3 pb-1 focus:outline-none"
            style={{
              fontSize: 13.5,
              color: "var(--foreground)",
              lineHeight: 1.55,
              maxHeight: 180,
            }}
            disabled={isLoading}
          />

          {/* Controls row */}
          <div className="px-2 pb-2 flex items-center gap-1">
            <InputChip label="@" title="Mention creator" />
            <InputChip label="/" title="Run skill" />
            <InputChip label="#" title="Campaign context" />
            <div className="flex-1" />
            <span
              className="text-[10.5px] font-mono mr-1 hidden sm:inline"
              style={{ color: "var(--fg-faint)" }}
            >
              <kbd className="text-[10px] font-mono px-1 py-0.5 rounded border bg-card" style={{ color: "var(--fg-dim)" }}>⌘</kbd>
              <kbd className="text-[10px] font-mono px-1 py-0.5 rounded border bg-card ml-0.5" style={{ color: "var(--fg-dim)" }}>K</kbd>
              <span className="mx-1">focus</span>
              <span className="mx-1">·</span>
              <kbd className="text-[10px] font-mono px-1 py-0.5 rounded border bg-card" style={{ color: "var(--fg-dim)" }}>↵</kbd>
              <span className="ml-1">send</span>
            </span>
            <button
              onClick={onSend}
              disabled={!input.trim() || isLoading}
              className="h-8 px-3 rounded-xl flex items-center gap-1 text-[12px] font-bold transition-all shadow-sm hover:opacity-95 disabled:cursor-not-allowed"
              style={{
                background: input.trim()
                  ? "var(--gradient-canva)"
                  : "var(--surface-3)",
                color: input.trim() ? "white" : "var(--fg-faint)",
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Send
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Input chip button ─────────────────────────────────── */

function InputChip({ label, title }: { label: string; title: string }) {
  return (
    <button
      title={title}
      className="h-7 w-7 grid place-items-center rounded-md font-mono text-[12px] transition-colors hover:bg-surface-2"
      style={{ color: "var(--fg-dim)" }}
    >
      {label}
    </button>
  );
}
