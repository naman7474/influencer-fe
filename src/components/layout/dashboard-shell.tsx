"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { MobileSidebar } from "@/components/layout/mobile-sidebar";
import { CopilotPanel } from "@/components/layout/copilot-panel";
import { PageContextProvider } from "@/components/agent/page-context-provider";
import { ChatPanel } from "@/components/agent/chat-panel";
import { ChatFAB } from "@/components/agent/chat-fab";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import type { Brand } from "@/lib/types/database";

/* Dark Ops tokens — scoped via .db-shell on <html> */
import "@/app/(dashboard)/db-tokens.css";

interface DashboardShellProps {
  brand: Brand | null;
  children: React.ReactNode;
}

const SIDEBAR_STORAGE_KEY = "sidebar-expanded";

export function DashboardShell({ brand, children }: DashboardShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);

  const agentEnabled = brand?.agent_enabled ?? false;
  const isAgentPage = pathname === "/agent" || pathname.startsWith("/agent/");
  const isSettingsPage = pathname === "/settings" || pathname.startsWith("/settings/");

  /* ── Hydrate sidebar state from localStorage ──────────────────── */
  useEffect(() => {
    const hydrate = () => {
      try {
        const stored = window.localStorage.getItem(SIDEBAR_STORAGE_KEY);
        if (stored != null) setSidebarExpanded(stored === "true");
      } catch {
        /* ignore storage errors */
      }
    };
    hydrate();
  }, []);

  const toggleSidebar = () => {
    setSidebarExpanded((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  /* ── Apply Dark Ops theme to <html> so portals inherit ────────── */
  useEffect(() => {
    const html = document.documentElement;
    const hadDark = html.classList.contains("dark");
    html.classList.add("dark", "db-shell");
    return () => {
      html.classList.remove("db-shell");
      if (!hadDark) html.classList.remove("dark");
    };
  }, []);

  /* ── Auto-collapse illaya on narrow viewports ────────────────── */
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1280px)");
    const handle = (e: MediaQueryListEvent | MediaQueryList) => {
      setCopilotOpen(e.matches);
    };
    handle(mq);
    mq.addEventListener("change", handle);
    return () => mq.removeEventListener("change", handle);
  }, []);

  // Illaya shown on desktop when agent is enabled and NOT on agent or settings page
  const showCopilot = agentEnabled && !isAgentPage && !isSettingsPage;

  // Grid columns: sidebar (72px collapsed / 224px expanded) | main (1fr) | Illaya panel (variable)
  const sidebarWidth = sidebarExpanded ? "224px" : "72px";
  const lgGridTemplate = showCopilot
    ? `${sidebarWidth} 1fr ${copilotOpen ? "340px" : "40px"}`
    : `${sidebarWidth} 1fr`;

  return (
    <PageContextProvider>
      <div
        className="flex h-screen flex-col overflow-hidden bg-background lg:grid transition-[grid-template-columns] duration-200 ease-out"
        style={{ gridTemplateColumns: lgGridTemplate }}
      >
        {/* Desktop icon rail - visible at lg (1024px+) */}
        <Sidebar
          brand={brand}
          expanded={sidebarExpanded}
          onToggle={toggleSidebar}
        />

        {/* Tablet/mobile sidebar sheet */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" showCloseButton={true} className="w-[280px] p-0">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <MobileSidebar brand={brand} onNavigate={() => setMobileMenuOpen(false)} />
          </SheetContent>
        </Sheet>

        {/* Main area */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Topbar: mobile/tablet only */}
          <Topbar
            brand={brand}
            onMobileMenuToggle={() => setMobileMenuOpen(true)}
          />

          <main className="flex-1 overflow-y-auto">
            {isAgentPage ? (
              children
            ) : (
              <div className="mx-auto max-w-[1280px] px-4 py-6 md:px-8 md:py-6">
                {children}
              </div>
            )}
            {/* Spacer for mobile bottom nav */}
            {!isAgentPage && <div className="h-16 md:hidden" />}
          </main>
        </div>

        {/* Desktop Illaya panel - visible at lg (1024px+) */}
        {showCopilot && (
          <CopilotPanel
            open={copilotOpen}
            onToggle={() => setCopilotOpen((o) => !o)}
          />
        )}

        {/* Mobile bottom navigation - visible below md (768px) */}
        <MobileNav />

        {/* Mobile AI Agent chat (Sheet) + FAB — hidden on /agent, /settings, and on desktop */}
        {agentEnabled && !isAgentPage && !isSettingsPage && (
          <div className="lg:hidden">
            <ChatPanel isOpen={chatOpen} onClose={() => setChatOpen(false)} />
            {!chatOpen && <ChatFAB onClick={() => setChatOpen(true)} />}
          </div>
        )}
      </div>
    </PageContextProvider>
  );
}
