"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { PageContextProvider } from "@/components/agent/page-context-provider";
import { ChatPanel } from "@/components/agent/chat-panel";
import { ChatFAB } from "@/components/agent/chat-fab";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Brand } from "@/lib/types/database";

interface DashboardShellProps {
  brand: Brand | null;
  children: React.ReactNode;
}

export function DashboardShell({ brand, children }: DashboardShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);

  const agentEnabled = brand?.agent_enabled ?? false;
  const isAgentPage = pathname === "/agent";

  return (
    <PageContextProvider>
      <div className="flex h-screen overflow-hidden bg-background">
        {/* Desktop sidebar - visible at lg (1024px+) */}
        <Sidebar brand={brand} />

        {/* Tablet sidebar sheet - visible at md-lg (768-1023px) */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" showCloseButton={true} className="w-[280px] p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <MobileSidebar brand={brand} onNavigate={() => setMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Main area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar
            brand={brand}
            onMobileMenuToggle={() => setMobileMenuOpen(true)}
          />

          <main className="flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-8 md:py-6">
              {children}
            </div>
            {/* Spacer for mobile bottom nav */}
            <div className="h-16 md:hidden" />
          </main>
        </div>

        {/* Mobile bottom navigation - visible below md (768px) */}
        <MobileNav />

        {/* AI Agent sidebar chat + FAB — hidden on /agent page */}
        {agentEnabled && !isAgentPage && (
          <>
            <ChatPanel isOpen={chatOpen} onClose={() => setChatOpen(false)} />
            {!chatOpen && <ChatFAB onClick={() => setChatOpen(true)} />}
          </>
        )}
      </div>
    </PageContextProvider>
  );
}
