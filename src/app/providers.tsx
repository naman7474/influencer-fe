"use client";

import * as React from "react";

import { ThemeProvider } from "next-themes";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { NavigationProgress } from "@/components/layout/navigation-progress";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <TooltipProvider>
        <React.Suspense fallback={null}>
          <NavigationProgress />
        </React.Suspense>
        {children}
        <Toaster />
      </TooltipProvider>
    </ThemeProvider>
  );
}
