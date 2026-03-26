"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  MapPinned,
  Megaphone,
  Search,
  Settings2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const DASHBOARD_NAV_ITEMS = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/discover", label: "Creator Discovery", icon: Search },
  { href: "/geo", label: "Geo Intelligence", icon: MapPinned },
  { href: "/campaigns", label: "Campaigns", icon: Megaphone },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function DashboardBrandMark() {
  return (
    <div className="flex items-center gap-3 px-1">
      <div className="grid h-9 w-9 place-items-center rounded-lg bg-primary text-primary-foreground">
        <Sparkles className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-semibold tracking-tight text-foreground">
          Influencer Intel
        </p>
      </div>
    </div>
  );
}

export function SidebarNav({
  onNavigate,
  showInbound = false,
}: {
  onNavigate?: () => void;
  showInbound?: boolean;
}) {
  const pathname = usePathname();
  const navItems = showInbound
    ? [
        ...DASHBOARD_NAV_ITEMS.slice(0, 4),
        { href: "/inbound", label: "Inbound", icon: Search },
        DASHBOARD_NAV_ITEMS[4],
      ]
    : DASHBOARD_NAV_ITEMS;

  return (
    <nav className="flex flex-1 flex-col">
      <div className="px-2">
        <p className="mb-2 px-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Workspace
        </p>
        <ul className="space-y-0.5">
          {navItems.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}

export function Sidebar({ showInbound = false }: { showInbound?: boolean }) {
  return (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:z-50 lg:flex lg:w-60 lg:flex-col">
      <div className="flex grow flex-col overflow-y-auto border-r border-border bg-background px-3 py-4">
        <div className="pb-5">
          <DashboardBrandMark />
        </div>
        <SidebarNav showInbound={showInbound} />
      </div>
    </aside>
  );
}
