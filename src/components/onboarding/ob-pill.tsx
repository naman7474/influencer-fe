"use client";

import { cn } from "@/lib/utils";

interface PillOption {
  value: string;
  label: string;
}

interface ObPillProps {
  options: (string | PillOption)[];
  value: string | string[];
  onChange: (value: string | string[]) => void;
  multi?: boolean;
  className?: string;
}

function normalizeOption(opt: string | PillOption): PillOption {
  return typeof opt === "string" ? { value: opt, label: opt } : opt;
}

export function ObPill({
  options,
  value,
  onChange,
  multi = false,
  className,
}: ObPillProps) {
  const items = options.map(normalizeOption);

  function isSelected(key: string) {
    if (multi) return Array.isArray(value) && value.includes(key);
    return value === key;
  }

  function toggle(key: string) {
    if (multi) {
      const arr = Array.isArray(value) ? value : [];
      const next = arr.includes(key)
        ? arr.filter((x) => x !== key)
        : [...arr, key];
      onChange(next);
    } else {
      onChange(key);
    }
  }

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {items.map((item) => {
        const sel = isSelected(item.value);
        return (
          <button
            key={item.value}
            type="button"
            onClick={() => toggle(item.value)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-all duration-150",
              "border cursor-pointer",
              sel
                ? "bg-[var(--ob-clay-soft)] text-[var(--ob-clay2)] border-[var(--ob-clay)]"
                : "bg-[var(--ob-card)] text-[var(--ob-ink2)] border-[var(--ob-line2)] hover:border-[var(--ob-ink4)]"
            )}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
