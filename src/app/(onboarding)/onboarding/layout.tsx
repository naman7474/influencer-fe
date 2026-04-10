"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const STEPS = [
  { path: "/onboarding/brand", label: "Brand Profile", step: 1 },
  { path: "/onboarding/integrations", label: "Integrations", step: 2 },
  { path: "/onboarding/preferences", label: "Preferences", step: 3 },
];

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const currentStepIndex = STEPS.findIndex((s) => pathname.startsWith(s.path));
  const currentStep = currentStepIndex >= 0 ? currentStepIndex : 0;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* Progress bar */}
      <div className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-6 py-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-muted-foreground">
              Step {currentStep + 1} of {STEPS.length}
            </p>
            <p className="text-sm font-medium text-foreground">
              {STEPS[currentStep]?.label}
            </p>
          </div>
          <div className="flex gap-2">
            {STEPS.map((step, i) => (
              <div
                key={step.path}
                className={cn(
                  "h-1.5 flex-1 rounded-full transition-colors duration-300",
                  i <= currentStep ? "bg-primary" : "bg-muted"
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex flex-1 items-start justify-center px-6 py-10">
        <div className="w-full max-w-3xl">{children}</div>
      </main>
    </div>
  );
}
