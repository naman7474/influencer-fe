import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getLists, getListItemCounts } from "@/lib/queries/lists";
import { CreatorsPageClient } from "./creators-page-client";

export default async function CreatorsPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: brandRow } = await supabase
    .from("brands")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();

  const brand = brandRow as { id: string } | null;
  if (!brand) redirect("/onboarding/brand-profile");

  const lists = await getLists(supabase, brand.id);
  const counts = await getListItemCounts(
    supabase,
    lists.map((l) => l.id),
  );

  return (
    <CreatorsPageClient
      brandId={brand.id}
      initialLists={lists}
      initialCounts={counts}
    />
  );
}
