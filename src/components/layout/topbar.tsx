"use client";

import { useRouter } from "next/navigation";
import {
  ChevronDown,
  LogOut,
  Menu,
  Search,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { NotificationBell } from "@/components/layout/notification-bell";
import type { Brand } from "@/lib/types/database";

interface TopbarProps {
  brand: Brand | null;
  onMobileMenuToggle?: () => void;
}

export function Topbar({ brand, onMobileMenuToggle }: TopbarProps) {
  const router = useRouter();

  const initials = brand?.brand_name
    ? brand.brand_name
        .split(" ")
        .map((w) => w[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";

  const handleSignOut = async () => {
    // Navigate to sign-out API route; actual implementation will come with auth
    router.push("/auth/login");
  };

  return (
    <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b border-border bg-background px-4 md:px-6">
      {/* Mobile/tablet menu button - visible below lg (1024px) */}
      <Button
        variant="ghost"
        size="icon"
        className="lg:hidden"
        onClick={onMobileMenuToggle}
        aria-label="Toggle menu"
      >
        <Menu className="size-5" />
      </Button>

      {/* Brand name / dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" className="gap-2 px-2 hidden sm:flex" />
          }
        >
          <div className="flex items-center justify-center size-6 rounded-md bg-primary text-primary-foreground font-semibold text-xs shrink-0">
            {brand?.brand_name?.charAt(0)?.toUpperCase() || "B"}
          </div>
          <span className="text-sm font-medium truncate max-w-[160px]">
            {brand?.brand_name || "My Brand"}
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" sideOffset={8}>
          <DropdownMenuItem onClick={() => router.push("/settings")}>
            <Settings className="size-4" />
            Brand Settings
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Search placeholder - Cmd+K */}
      <div className="flex-1 flex justify-center">
        <button
          className="flex items-center gap-2 rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted max-w-md w-full"
          onClick={() => {
            // Command palette will be implemented later
          }}
        >
          <Search className="size-4" />
          <span className="hidden sm:inline">Search creators, campaigns...</span>
          <span className="sm:hidden">Search...</span>
          <kbd className="ml-auto hidden rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline-block">
            &#8984;K
          </kbd>
        </button>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1">
        <ThemeToggle />

        {/* Notification bell */}
        <NotificationBell />

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" size="icon" className="rounded-full" />
            }
          >
            <Avatar size="sm">
              {brand?.logo_url && <AvatarImage src={brand.logo_url} alt={brand.brand_name} />}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8}>
            <div className="px-1.5 py-1.5">
              <p className="text-sm font-medium">{brand?.brand_name || "My Brand"}</p>
              <p className="text-xs text-muted-foreground truncate">
                {brand?.website || "Set up your brand"}
              </p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push("/settings")}>
              <Settings className="size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut}>
              <LogOut className="size-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
