"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  ClipboardList,
  Settings,
  Send,
  MessageSquare,
  CheckSquare,
  Wrench,
  Zap,
  Brain,
  SlidersHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import type { Brand } from "@/lib/types/database";

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
  { label: "Campaigns", href: "/campaigns", icon: ClipboardList },
  { label: "Outreach", href: "/outreach", icon: Send },
  { label: "Settings", href: "/settings", icon: Settings },
];

const agentNavItems: NavItem[] = [
  { label: "Chat", href: "/agent", icon: MessageSquare },
  { label: "Skills", href: "/agent/skills", icon: Wrench },
  { label: "Automations", href: "/agent/automations", icon: Zap },
  { label: "Memory", href: "/agent/memory", icon: Brain },
  { label: "Approvals", href: "/approvals", icon: CheckSquare },
  { label: "Illaya Config", href: "/agent/config", icon: SlidersHorizontal },
];

interface MobileSidebarProps {
  brand: Brand | null;
  onNavigate: () => void;
}

export function MobileSidebar({ brand, onNavigate }: MobileSidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
    if (href === "/agent") return pathname === "/agent";
    return pathname.startsWith(href);
  };

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Brand header */}
      <div className="flex items-center h-14 px-4 gap-3 shrink-0 border-b border-sidebar-border">
        <div className="flex items-center justify-center size-8 rounded-lg bg-primary text-primary-foreground font-semibold text-sm shrink-0">
          {brand?.brand_name?.charAt(0)?.toUpperCase() || "B"}
        </div>
        <span className="text-sm font-semibold text-sidebar-foreground truncate">
          {brand?.brand_name || "My Brand"}
        </span>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        {mainNavItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150 ease-out",
                active
                  ? "bg-sidebar-accent text-primary font-semibold"
                  : "text-sidebar-foreground hover:bg-muted"
              )}
            >
              <Icon className={cn("size-5 shrink-0", active && "text-primary")} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}

        <Separator className="my-3" />

        {/* Illaya section label */}
        <div className="px-3 mb-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
            Illaya
          </span>
        </div>

        {agentNavItems.map((item) => {
          const Icon = item.icon;
          const agentEnabled = brand?.agent_enabled ?? false;

          if (!agentEnabled) {
            return (
              <div
                key={item.label}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted-foreground/50 cursor-not-allowed select-none"
              >
                <Icon className="size-5 shrink-0" />
                <span className="truncate">{item.label}</span>
                <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-muted-foreground/40">
                  Soon
                </span>
              </div>
            );
          }

          const active = isActive(item.href);
          return (
            <Link
              key={item.label}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-all duration-150 ease-out",
                active
                  ? "bg-sidebar-accent text-primary font-semibold"
                  : "text-sidebar-foreground hover:bg-muted"
              )}
            >
              <Icon className={cn("size-5 shrink-0", active && "text-primary")} />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
