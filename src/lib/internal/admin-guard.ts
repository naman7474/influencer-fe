import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * Returns the authenticated user's email if they are on the internal
 * admin allowlist (INTERNAL_ADMIN_EMAILS, comma-separated). Otherwise
 * returns null. Page handlers should redirect or 404 on null; API
 * routes should return 403.
 */
export async function requireInternalAdmin(): Promise<string | null> {
  const allowlist = (process.env.INTERNAL_ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (!allowlist.length) return null;

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();
  if (!email) return null;
  return allowlist.includes(email) ? email : null;
}
