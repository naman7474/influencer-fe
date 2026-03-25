import { createClient } from "@/lib/supabase/server";
import { requireBrandContext } from "@/lib/queries/brand";
import { getSettingsOverview } from "@/lib/queries/settings";
import { SettingsClient } from "./settings-client";

export default async function SettingsPage() {
  const supabase = await createClient();
  const brand = await requireBrandContext(supabase);
  const settings = await getSettingsOverview(supabase, brand.brand_id);

  return <SettingsClient brand={settings.brand} products={settings.products} hasAdminToken={settings.has_admin_token} />;
}
