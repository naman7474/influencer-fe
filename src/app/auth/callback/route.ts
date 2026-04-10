import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const redirect = requestUrl.searchParams.get("redirect") || "/dashboard";

  if (code) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Cookie setting may fail in some contexts
            }
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: brandRow } = await supabase
          .from("brands")
          .select("id, onboarded_at")
          .eq("auth_user_id", user.id)
          .single();

        const brand = brandRow as { id: string; onboarded_at: string | null } | null;

        if (!brand) {
          // No brand row yet — create it now that the user is confirmed
          // and auth.uid() is valid (RLS will pass).
          // brand_name comes from user metadata (set during signup)
          // or falls back to email prefix for Google OAuth sign-ins.
          const meta = user.user_metadata ?? {};
          const brandName =
            meta.brand_name ||
            meta.full_name ||
            meta.name ||
            user.email?.split("@")[0] ||
            "My Brand";

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from("brands") as any).insert({
            auth_user_id: user.id,
            brand_name: brandName,
            onboarding_step: 1,
            onboarded_at: null,
          });

          return NextResponse.redirect(
            new URL("/onboarding/brand-profile", requestUrl.origin)
          );
        }

        if (!brand.onboarded_at) {
          return NextResponse.redirect(
            new URL("/onboarding/brand-profile", requestUrl.origin)
          );
        }
      }

      return NextResponse.redirect(new URL(redirect, requestUrl.origin));
    }
  }

  // Something went wrong — send back to login
  return NextResponse.redirect(new URL("/login", requestUrl.origin));
}
