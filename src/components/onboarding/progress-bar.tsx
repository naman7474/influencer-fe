"use client";

import { cn } from "@/lib/utils";
import { CheckIcon } from "lucide-react";

const STEPS = [
  { label: "Brand Profile", step: 1 },
  { label: "Integrations", step: 2 },
  { label: "Preferences", step: 3 },
];

interface ProgressBarProps {
  currentStep: number;
}

export function ProgressBar({ currentStep }: ProgressBarProps) {
  return (
    <div className="w-full">
      <div className="flex items-center justify-between">
        {STEPS.map(({ label, step }, index) => {
          const isCompleted = currentStep > step;
          const isActive = currentStep === step;
          const isLast = index === STEPS.length - 1;

          return (
            <div key={step} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold transition-colors",
                    isCompleted &&
                      "border-primary bg-primary text-primary-foreground",
                    isActive &&
                      "border-primary bg-primary/10 text-primary",
                    !isCompleted &&
                      !isActive &&
                      "border-border bg-background text-muted-foreground"
                  )}
                >
                  {isCompleted ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    step
                  )}
                </div>
                <span
                  className={cn(
                    "text-xs font-medium whitespace-nowrap",
                    isActive
                      ? "text-primary"
                      : isCompleted
                        ? "text-foreground"
                        : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
              </div>
              {!isLast && (
                <div className="mx-2 mt-[-1.25rem] h-0.5 flex-1">
                  <div
                    className={cn(
                      "h-full rounded-full transition-colors",
                      isCompleted ? "bg-primary" : "bg-border"
                    )}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
