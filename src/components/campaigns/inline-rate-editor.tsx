"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/format";

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface InlineRateEditorProps {
  value: number | null;
  currency?: string;
  onSave: (value: string) => void;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function InlineRateEditor({
  value,
  currency = "INR",
  onSave,
  className,
}: InlineRateEditorProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toString() ?? "");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function handleCommit() {
    setEditing(false);
    const orig = value?.toString() ?? "";
    if (draft !== orig) {
      onSave(draft);
    }
  }

  if (editing) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <input
          ref={inputRef}
          type="number"
          min={0}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={handleCommit}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCommit();
            if (e.key === "Escape") {
              setDraft(value?.toString() ?? "");
              setEditing(false);
            }
          }}
          className="w-20 rounded border bg-background px-2 py-0.5 text-xs text-right font-medium focus:outline-none focus:ring-1 focus:ring-ring [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        />
        <button
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onClick={handleCommit}
          className="rounded p-0.5 text-primary hover:bg-primary/10"
        >
          <Check className="size-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setDraft(value?.toString() ?? "");
        setEditing(true);
      }}
      className={cn(
        "group inline-flex items-center gap-1 text-xs font-medium",
        className,
      )}
    >
      <span>
        {value != null ? formatCurrency(value, currency) : "--"}
      </span>
      <Pencil className="size-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
    </button>
  );
}
