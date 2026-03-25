"use client";

import { type FormEvent, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Menu, Search as SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  DASHBOARD_NAV_ITEMS,
  DashboardBrandMark,
  SidebarNav,
} from "@/components/layout/sidebar";

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeSection =
    DASHBOARD_NAV_ITEMS.find((item) => pathname.startsWith(item.href))?.label ??
    "Brand Dashboard";

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const query = String(formData.get("search") ?? "").trim();

    const params = new URLSearchParams();
    if (query) params.set("search", query);

    router.push(`/discover${params.toString() ? `?${params.toString()}` : ""}`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm lg:px-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={
                <Button
                  variant="outline"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open navigation"
                />
              }
            >
              <Menu className="h-4 w-4" />
            </SheetTrigger>
            <SheetContent
              side="left"
              className="w-[88%] max-w-sm border-r-0 bg-background p-0"
            >
              <SheetHeader className="border-b border-border px-4 py-4">
                <SheetTitle className="sr-only">Dashboard navigation</SheetTitle>
                <DashboardBrandMark />
              </SheetHeader>
              <div className="flex h-full flex-col px-3 py-4">
                <SidebarNav onNavigate={() => setMobileOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            {activeSection}
          </h2>
        </div>

        <div className="flex flex-1 items-center gap-3 lg:max-w-lg lg:justify-end">
          <form
            onSubmit={handleSearchSubmit}
            className="relative w-full lg:max-w-sm"
          >
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              key={`${pathname}-${searchParams.get("search") ?? ""}`}
              name="search"
              defaultValue={searchParams.get("search") ?? ""}
              placeholder="Search creators..."
              className="h-9 rounded-lg border-border bg-muted/50 pl-9 text-sm"
            />
          </form>

          <div className="hidden items-center gap-2 lg:flex">
            <div className="rounded-md border border-border bg-muted/50 px-2 py-1 text-[11px] font-medium text-muted-foreground">
              Live
            </div>
            <div className="grid h-8 w-8 place-items-center rounded-full bg-primary text-xs font-medium text-primary-foreground">
              NJ
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
