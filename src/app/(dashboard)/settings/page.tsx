import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Brand } from "@/lib/types/database";
import { SettingsClient } from "./settings-client";

export const metadata = {
  title: "Settings | CreatorGoose",
};

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: brandRow } = await supabase
    .from("brands")
    .select("*")
    .eq("auth_user_id", user.id)
    .single();

  const brand = brandRow as Record<string, unknown> | null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="font-serif italic text-2xl tracking-tight text-foreground">
          Settings
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your brand profile, integrations, and preferences.
        </p>
      </div>

      <SettingsClient
        brand={brand as Brand | null}
        userEmail={user.email ?? ""}
      />
    </div>
  );
}
