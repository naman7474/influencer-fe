import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { AnalyticsClient } from "./analytics-client";

export default async function AnalyticsPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brandRow } = await supabase
    .from("brands")
    .select("id, currency: price_currency")
    .eq("auth_user_id", user.id)
    .single();

  const brand = brandRow as { id: string; currency: string } | null;
  return (
    <AnalyticsClient
      currency={brand?.currency ?? "INR"}
    />
  );
}
