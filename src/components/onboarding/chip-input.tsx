"use client";

import { useState, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { XIcon, ChevronDownIcon } from "lucide-react";

interface ChipInputProps {
  value: string[];
  onChange: (value: string[]) => void;
  presets?: string[];
  placeholder?: string;
  allowCustom?: boolean;
  className?: string;
}

export function ChipInput({
  value,
  onChange,
  presets = [],
  placeholder = "Add items...",
  allowCustom = true,
  className,
}: ChipInputProps) {
  const [inputValue, setInputValue] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredPresets = presets.filter(
    (preset) =>
      !value.includes(preset) &&
      preset.toLowerCase().includes(inputValue.toLowerCase())
  );

  const addItem = useCallback(
    (item: string) => {
      const trimmed = item.trim();
      if (trimmed && !value.includes(trimmed)) {
        onChange([...value, trimmed]);
      }
      setInputValue("");
    },
    [value, onChange]
  );

  const removeItem = useCallback(
    (item: string) => {
      onChange(value.filter((v) => v !== item));
    },
    [value, onChange]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && allowCustom) {
      e.preventDefault();
      addItem(inputValue);
    }
    if (e.key === "Backspace" && !inputValue && value.length > 0) {
      removeItem(value[value.length - 1]);
    }
    if (e.key === "Escape") {
      setIsOpen(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <div
        className={cn(
          "flex min-h-[2.25rem] flex-wrap items-center gap-1.5 rounded-lg border border-input bg-transparent px-2.5 py-1.5 transition-colors",
          "focus-within:border-ring focus-within:ring-3 focus-within:ring-ring/50",
          "dark:bg-input/30"
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {value.map((item) => (
          <span
            key={item}
            className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
          >
            {item}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeItem(item);
              }}
              className="rounded-sm p-0.5 transition-colors hover:bg-primary/20"
            >
              <XIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
        <div className="flex flex-1 items-center gap-1">
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onBlur={() => {
              // Delay closing so click on option registers
              setTimeout(() => setIsOpen(false), 200);
            }}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? placeholder : ""}
            className="min-w-[80px] flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {presets.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(!isOpen);
                inputRef.current?.focus();
              }}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronDownIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {isOpen && filteredPresets.length > 0 && (
        <div className="absolute z-50 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-border bg-popover p-1 shadow-md">
          {filteredPresets.map((preset) => (
            <button
              key={preset}
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                addItem(preset);
              }}
              className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {preset}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
