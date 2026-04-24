"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  Users,
  ClipboardList,
  Settings,
  Send,
  BarChart3,
  MessageSquare,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import type { Brand } from "@/lib/types/database";

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { label: "Home", href: "/dashboard", icon: LayoutDashboard },
  { label: "Discover", href: "/discover", icon: Search },
  { label: "Creators", href: "/creators", icon: Users },
  { label: "Campaigns", href: "/campaigns", icon: ClipboardList },
  { label: "Outreach", href: "/outreach", icon: Send },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Illaya", href: "/agent", icon: MessageSquare },
  { label: "Settings", href: "/settings", icon: Settings },
];

interface SidebarProps {
  brand: Brand | null;
  expanded: boolean;
  onToggle: () => void;
}

export function Sidebar({ brand, expanded, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard" || pathname === "/";
    if (href === "/agent") return pathname === "/agent";
    return pathname.startsWith(href);
  };

  const brandInitial = brand?.brand_name?.charAt(0)?.toUpperCase() || "K";

  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex",
        expanded ? "w-56" : "w-[72px]",
      )}
    >
      {/* ── Brand row (logo + optional name + toggle) ─────────────── */}
      <div
        className={cn(
          "flex h-16 shrink-0 items-center gap-2",
          expanded ? "px-3" : "justify-center",
        )}
      >
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="flex shrink-0 items-center justify-center size-9 rounded-full bg-primary text-primary-foreground font-semibold text-sm transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
            }
          >
            {brandInitial}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" sideOffset={12}>
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{brand?.brand_name || "My Brand"}</p>
              <p className="text-xs text-muted-foreground truncate">
                {brand?.website || "Set up your brand"}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="size-4" />
              Brand Settings
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {expanded && (
          <>
            <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
              {brand?.brand_name || "My Brand"}
            </span>
            <ToggleButton expanded={expanded} onToggle={onToggle} />
          </>
        )}
      </div>

      {/* Collapsed-state toggle lives just below the brand logo */}
      {!expanded && (
        <div className="flex justify-center pb-1 pt-0">
          <ToggleButton expanded={expanded} onToggle={onToggle} />
        </div>
      )}

      {/* ── Navigation ────────────────────────────────────────────── */}
      <nav
        className={cn(
          "flex flex-1 flex-col gap-1 overflow-y-auto py-2",
          expanded ? "px-2" : "items-center px-2",
        )}
      >
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          const linkClass = cn(
            "flex items-center transition-all duration-150 rounded-xl",
            expanded
              ? "h-10 w-full gap-3 px-3 text-sm"
              : "size-10 justify-center",
            active
              ? "bg-[var(--db-clay-soft)] text-[var(--db-clay)]"
              : "text-[var(--db-txt3)] hover:text-[var(--db-txt2)] hover:bg-muted",
          );

          if (expanded) {
            return (
              <Link key={item.href} href={item.href} className={linkClass}>
                <Icon className="size-[20px] shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          }

          return (
            <Tooltip key={item.href}>
              <TooltipTrigger render={<div />}>
                <Link href={item.href} className={linkClass}>
                  <Icon className="size-[20px]" />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {item.label}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </nav>

      {/* ── Bottom section: notifications + user ────────────────── */}
      <div
        className={cn(
          "flex shrink-0 gap-2 border-t border-sidebar-border py-3",
          expanded
            ? "flex-row items-center justify-between px-3"
            : "flex-col items-center px-2",
        )}
      >
        <ThemeToggle />
        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button className="flex items-center justify-center size-9 shrink-0 rounded-full bg-muted text-muted-foreground text-xs font-semibold transition-opacity hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring overflow-hidden" />
            }
          >
            {brand?.logo_url ? (
              <img
                src={brand.logo_url}
                alt={brand.brand_name || ""}
                className="size-full object-cover"
              />
            ) : (
              brandInitial
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="end" sideOffset={12}>
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{brand?.brand_name || "My Brand"}</p>
              <p className="text-xs text-muted-foreground truncate">
                {brand?.website || ""}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/auth/login")}>
              <LogOut className="size-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Toggle button                                                      */
/* ------------------------------------------------------------------ */

function ToggleButton({
  expanded,
  onToggle,
}: {
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = expanded ? PanelLeftClose : PanelLeftOpen;
  const label = expanded ? "Collapse sidebar" : "Expand sidebar";

  return (
    <Tooltip>
      <TooltipTrigger render={<div />}>
        <button
          type="button"
          onClick={onToggle}
          aria-label={label}
          className="flex size-8 items-center justify-center rounded-lg text-[var(--db-txt3)] transition-colors hover:bg-muted hover:text-[var(--db-txt2)] focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Icon className="size-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}
