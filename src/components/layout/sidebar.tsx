"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  Users,
  ClipboardList,
  Settings,
  Send,
  BarChart3,
  MessageSquare,
  CheckSquare,
  ChevronsLeft,
  ChevronsRight,
  Wrench,
  Zap,
  Brain,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Brand } from "@/lib/types/database";

const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
  comingSoon?: boolean;
}

const mainNavItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Discover", href: "/discover", icon: Search },
  { label: "My Creators", href: "/creators", icon: Users },
  { label: "Campaigns", href: "/campaigns", icon: ClipboardList },
  { label: "Outreach", href: "/outreach", icon: Send },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Settings", href: "/settings", icon: Settings },
];

const agentNavItems: NavItem[] = [
  { label: "Chat", href: "/agent", icon: MessageSquare },
  { label: "Skills", href: "/agent/skills", icon: Wrench },
  { label: "Automations", href: "/agent/automations", icon: Zap },
  { label: "Memory", href: "/agent/memory", icon: Brain },
  { label: "Approvals", href: "/approvals", icon: CheckSquare },
  { label: "Agent Config", href: "/agent/config", icon: SlidersHorizontal },
];

interface SidebarProps {
  brand: Brand | null;
}

export function Sidebar({ brand }: SidebarProps) {
  const pathname = usePathname();
  const [userCollapsed, setUserCollapsed] = useState(false);
  const [autoCollapsed, setAutoCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Responsive: auto-collapse between 1024-1279px
  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px) and (max-width: 1279px)");
    const handleChange = (e: MediaQueryListEvent | MediaQueryList) => {
      setAutoCollapsed(e.matches);
    };
    handleChange(mediaQuery);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
    if (stored === "true") {
      setUserCollapsed(true);
    }
  }, []);

  const collapsed = autoCollapsed || userCollapsed;

  const toggleCollapsed = useCallback(() => {
    const next = !userCollapsed;
    setUserCollapsed(next);
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(next));
  }, [userCollapsed]);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
    // Exact match for /agent to avoid highlighting on /agent/skills etc.
    if (href === "/agent") return pathname === "/agent";
    return pathname.startsWith(href);
  };

  // Prevent flash of wrong state
  const sidebarWidth = !mounted ? "w-[240px]" : collapsed ? "w-[60px]" : "w-[240px]";

  return (
    <aside
      className={cn(
        "hidden lg:flex flex-col h-screen sticky top-0 border-r bg-sidebar border-sidebar-border transition-all duration-150 ease-out shrink-0 overflow-hidden",
        sidebarWidth
      )}
    >
      {/* Brand header */}
      <div className="flex items-center h-14 px-3 gap-3 shrink-0">
        <div className="flex items-center justify-center size-8 rounded-lg bg-primary text-primary-foreground font-semibold text-sm shrink-0">
          {brand?.brand_name?.charAt(0)?.toUpperCase() || "B"}
        </div>
        {!collapsed && (
          <span className="text-sm font-semibold text-sidebar-foreground truncate">
            {brand?.brand_name || "My Brand"}
          </span>
        )}
      </div>

      {/* Main navigation */}
      <nav className="flex-1 px-2 py-2 space-y-1 overflow-y-auto">
        {mainNavItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          const linkContent = (
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 ease-out",
                active
                  ? "bg-sidebar-accent text-primary font-semibold"
                  : "text-sidebar-foreground hover:bg-muted",
                collapsed && "justify-center px-0"
              )}
            >
              <Icon className={cn("size-5 shrink-0", active && "text-primary")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger render={<div />}>
                  {linkContent}
                </TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }

          return <div key={item.href}>{linkContent}</div>;
        })}

        {/* Separator + Agent section */}
        <div className="my-3 h-px bg-sidebar-border" />
        {!collapsed && (
          <div className="px-3 mb-1">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
              AI Agent
            </span>
          </div>
        )}

        {agentNavItems.map((item) => {
          const Icon = item.icon;
          const agentEnabled = brand?.agent_enabled ?? false;

          if (!agentEnabled) {
            const disabledContent = (
              <div
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground/50 cursor-not-allowed select-none",
                  collapsed && "justify-center px-0"
                )}
              >
                <Icon className="size-5 shrink-0" />
                {!collapsed && <span className="truncate">{item.label}</span>}
                {!collapsed && (
                  <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
                    Soon
                  </span>
                )}
              </div>
            );
            return (
              <Tooltip key={item.label}>
                <TooltipTrigger render={<div />}>{disabledContent}</TooltipTrigger>
                <TooltipContent side="right">Enable AI Agent in Settings</TooltipContent>
              </Tooltip>
            );
          }

          const active = isActive(item.href);
          const linkContent = (
            <Link
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-150 ease-out",
                active
                  ? "bg-sidebar-accent text-primary font-semibold"
                  : "text-sidebar-foreground hover:bg-muted",
                collapsed && "justify-center px-0"
              )}
            >
              <Icon className={cn("size-5 shrink-0", active && "text-primary")} />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );

          if (collapsed) {
            return (
              <Tooltip key={item.label}>
                <TooltipTrigger render={<div />}>{linkContent}</TooltipTrigger>
                <TooltipContent side="right">{item.label}</TooltipContent>
              </Tooltip>
            );
          }
          return <div key={item.label}>{linkContent}</div>;
        })}
      </nav>

      {/* Collapse toggle */}
      <div className="shrink-0 border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={toggleCollapsed}
          className={cn(
            "w-full text-muted-foreground hover:text-sidebar-foreground",
            !collapsed && "justify-start gap-3 px-3"
          )}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronsRight className="size-4" />
          ) : (
            <>
              <ChevronsLeft className="size-4" />
              <span className="text-sm">Collapse</span>
            </>
          )}
        </Button>
      </div>
    </aside>
  );
}
