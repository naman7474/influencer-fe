"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import "./ob-tokens.css";

const STEPS = [
  { path: "/onboarding/brand-profile", label: "Brand Profile", step: 1, phase: "discover" },
  { path: "/onboarding/integrations", label: "Integrations", step: 2, phase: "connect" },
  { path: "/onboarding/preferences", label: "Preferences", step: 3, phase: "define" },
];

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const currentStepIndex = STEPS.findIndex((s) => pathname.startsWith(s.path));
  const currentStep = currentStepIndex >= 0 ? currentStepIndex : 0;
  const step = STEPS[currentStep];

  return (
    <div className="ob-flow flex min-h-screen flex-col">
      {/* Top bar — Kindred logo + step indicator */}
      <header className="sticky top-0 z-50 flex items-center justify-between border-b border-[var(--ob-line)] bg-[var(--ob-paper)]/80 px-7 py-3.5 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <span className="font-serif text-xl italic tracking-tight text-[var(--ob-ink)]">
            Kindred
          </span>
        </div>
        <div className="font-mono text-[11px] text-[var(--ob-ink3)]">
          step {String(currentStep + 1).padStart(2, "0")} &middot;{" "}
          {step?.phase}
        </div>
      </header>

      {/* Progress dots */}
      <div className="flex gap-1.5 px-7 pt-3">
        {STEPS.map((s, i) => (
          <div
            key={s.path}
            className={cn(
              "h-1 flex-1 rounded-full transition-all duration-500",
              i <= currentStep
                ? "bg-[var(--ob-clay)]"
                : "bg-[var(--ob-line)]"
            )}
          />
        ))}
      </div>

      {/* Content */}
      <main className="flex flex-1 items-start justify-center px-6 py-8">
        <div
          className="w-full max-w-4xl"
          style={{ animation: "obRise 0.35s ease-out" }}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
