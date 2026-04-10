import { createServerSupabaseClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OutreachClient } from "./outreach-client";

export default async function OutreachPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  const { data: brandRow } = await supabase
    .from("brands")
    .select("id, brand_name, gmail_connected, gmail_email, email_sender_name")
    .eq("auth_user_id", user.id)
    .single();

  const brand = brandRow as { id: string; brand_name: string; gmail_connected: boolean; gmail_email: string | null; email_sender_name: string | null } | null;

  if (!brand) redirect("/onboarding");

  // Fetch campaigns for the filter dropdown
  const { data: campaignRows } = await supabase
    .from("campaigns")
    .select("id, name")
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: false });

  const campaigns = (campaignRows || []) as Array<{ id: string; name: string }>;

  return (
    <OutreachClient
      brand={brand}
      campaigns={campaigns}
    />
  );
}
