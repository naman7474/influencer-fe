import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Brand } from "@/lib/types/database";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();

  // Check auth
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Fetch brand data
  const { data: brandRow } = await supabase
    .from("brands")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  return <DashboardShell brand={brandRow as Brand | null}>{children}</DashboardShell>;
}
