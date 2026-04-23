"use client";

import { useRouter } from "next/navigation";
import {
  LogOut,
  Menu,
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
    <header className="sticky top-0 z-40 flex lg:hidden h-14 items-center gap-4 border-b border-border bg-background px-4 md:px-6">
      {/* Mobile/tablet menu button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onMobileMenuToggle}
        aria-label="Toggle menu"
      >
        <Menu className="size-5" />
      </Button>

      {/* Brand name */}
      <div className="flex items-center gap-2 flex-1">
        <div className="flex items-center justify-center size-6 rounded-md bg-primary text-primary-foreground font-semibold text-xs shrink-0">
          {brand?.brand_name?.charAt(0)?.toUpperCase() || "B"}
        </div>
        <span className="text-sm font-medium truncate max-w-[160px]">
          {brand?.brand_name || "My Brand"}
        </span>
      </div>

      {/* Right section */}
      <div className="flex items-center gap-1">
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
