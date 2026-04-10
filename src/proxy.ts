import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

const publicRoutes = ["/login", "/signup", "/"];

// Routes that bypass auth and onboarding checks entirely
function shouldBypass(path: string): boolean {
  return (
    path.startsWith("/api/") ||
    path.startsWith("/auth/") ||
    path.startsWith("/submit/") ||
    path.startsWith("/api/track/")
  );
}

export async function proxy(request: NextRequest) {
  const { user, response, supabase } = await updateSession(request);
  const path = request.nextUrl.pathname;

  // If Supabase is not configured, allow all routes
  if (!supabase) {
    return response;
  }

  // API routes, auth callbacks, and public submission links — pass through
  // (they handle their own auth via session or tokens)
  if (shouldBypass(path)) {
    return response;
  }

  // Public routes — allow access
  if (publicRoutes.includes(path)) {
    // If logged in, redirect away from login/signup
    if (user && (path === "/login" || path === "/signup")) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return response;
  }

  // No session — redirect to login
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", path);
    return NextResponse.redirect(loginUrl);
  }

  // Check onboarding status
  const { data: brandRow } = await supabase
    .from("brands")
    .select("onboarding_step, onboarded_at")
    .eq("auth_user_id", user.id)
    .single();

  const brand = brandRow as { onboarding_step: number | null; onboarded_at: string | null } | null;
  const isOnboarded = brand?.onboarded_at != null;
  const isOnboardingRoute = path.startsWith("/onboarding");

  // Not onboarded yet — force onboarding
  if (!isOnboarded && !isOnboardingRoute) {
    const step = brand?.onboarding_step || 1;
    const stepRoutes: Record<number, string> = {
      1: "/onboarding/brand-profile",
      2: "/onboarding/integrations",
      3: "/onboarding/preferences",
    };
    return NextResponse.redirect(
      new URL(stepRoutes[step] || "/onboarding/brand-profile", request.url)
    );
  }

  // Onboarded but trying to access onboarding — redirect to dashboard
  if (isOnboarded && isOnboardingRoute) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
