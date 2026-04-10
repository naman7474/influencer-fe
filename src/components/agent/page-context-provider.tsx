"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { usePathname, useParams } from "next/navigation";

interface PageContext {
  path: string;
  pageType: string;
  data: Record<string, unknown> | null;
}

interface PageContextValue {
  pageContext: PageContext;
}

const PageContextCtx = createContext<PageContextValue>({
  pageContext: { path: "/", pageType: "unknown", data: null },
});

function classifyPage(pathname: string): string {
  if (pathname === "/dashboard") return "dashboard";
  if (pathname === "/discover") return "discover";
  if (pathname.startsWith("/creator/")) return "creator_profile";
  if (pathname === "/creators") return "creators";
  if (pathname === "/campaigns") return "campaigns";
  if (/^\/campaigns\/[^/]+/.test(pathname)) return "campaign_detail";
  if (pathname === "/outreach") return "outreach";
  if (pathname === "/analytics") return "analytics";
  if (pathname === "/settings") return "settings";
  if (pathname === "/approvals") return "approvals";
  if (pathname === "/agent") return "agent";
  return "other";
}

function extractPageData(
  pathname: string,
  params: Record<string, string | string[] | undefined>
): Record<string, unknown> | null {
  if (/^\/campaigns\/[^/]+/.test(pathname) && params?.id) {
    return { campaignId: params.id };
  }
  if (pathname.startsWith("/creator/") && params?.handle) {
    return { creatorHandle: params.handle };
  }
  return null;
}

export function PageContextProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const params = useParams() as Record<string, string | string[] | undefined>;
  const [pageContext, setPageContext] = useState<PageContext>({
    path: pathname,
    pageType: classifyPage(pathname),
    data: null,
  });

  useEffect(() => {
    setPageContext({
      path: pathname,
      pageType: classifyPage(pathname),
      data: extractPageData(pathname, params),
    });
  }, [pathname, params]);

  return (
    <PageContextCtx.Provider value={{ pageContext }}>
      {children}
    </PageContextCtx.Provider>
  );
}

export function usePageContext() {
  return useContext(PageContextCtx);
}
