import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  CreatorList,
  CreatorListItem,
} from "@/lib/types/database";

/* ------------------------------------------------------------------ */
/*  Fetch all lists for a brand                                        */
/* ------------------------------------------------------------------ */

export async function getLists(
  supabase: SupabaseClient<Database>,
  brandId: string,
): Promise<CreatorList[]> {
  const { data, error } = await supabase
    .from("creator_lists")
    .select("*")
    .eq("brand_id", brandId)
    .order("updated_at", { ascending: false });

  if (error) {
    console.error("getLists error:", error);
    return [];
  }

  return data ?? [];
}

/* ------------------------------------------------------------------ */
/*  Create a new list                                                  */
/* ------------------------------------------------------------------ */

export async function createList(
  supabase: SupabaseClient<Database>,
  brandId: string,
  name: string,
  description?: string,
): Promise<CreatorList> {
  const { data, error } = await supabase
    .from("creator_lists")
    .insert({
      brand_id: brandId,
      name,
      description: description ?? null,
    } as never)
    .select()
    .single();

  if (error) {
    console.error("createList error:", error);
    throw error;
  }

  return data;
}

/* ------------------------------------------------------------------ */
/*  Delete a list                                                      */
/* ------------------------------------------------------------------ */

export async function deleteList(
  supabase: SupabaseClient<Database>,
  listId: string,
): Promise<void> {
  // Delete items first, then the list
  const { error: itemsErr } = await supabase
    .from("creator_list_items")
    .delete()
    .eq("list_id", listId);

  if (itemsErr) {
    console.error("deleteList items error:", itemsErr);
    throw itemsErr;
  }

  const { error } = await supabase
    .from("creator_lists")
    .delete()
    .eq("id", listId);

  if (error) {
    console.error("deleteList error:", error);
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/*  Add a creator to a list                                            */
/* ------------------------------------------------------------------ */

export async function addToList(
  supabase: SupabaseClient<Database>,
  listId: string,
  creatorId: string,
  notes?: string,
): Promise<void> {
  const { error } = await supabase.from("creator_list_items").insert({
    list_id: listId,
    creator_id: creatorId,
    notes: notes ?? null,
  } as never);

  if (error) {
    // Ignore unique constraint violations (already in list)
    if (error.code === "23505") return;
    console.error("addToList error:", error);
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/*  Remove a creator from a list                                       */
/* ------------------------------------------------------------------ */

export async function removeFromList(
  supabase: SupabaseClient<Database>,
  listId: string,
  creatorId: string,
): Promise<void> {
  const { error } = await supabase
    .from("creator_list_items")
    .delete()
    .eq("list_id", listId)
    .eq("creator_id", creatorId);

  if (error) {
    console.error("removeFromList error:", error);
    throw error;
  }
}

/* ------------------------------------------------------------------ */
/*  Get all items in a list (with creator details)                     */
/* ------------------------------------------------------------------ */

export async function getListItems(
  supabase: SupabaseClient<Database>,
  listId: string,
): Promise<(CreatorListItem & { creator: Record<string, unknown> })[]> {
  const { data, error } = await supabase
    .from("creator_list_items")
    .select(
      `
      *,
      creator:creators (
        id,
        handle,
        display_name,
        avatar_url,
        followers,
        tier,
        is_verified,
        city,
        country
      )
    `,
    )
    .eq("list_id", listId)
    .order("added_at", { ascending: false });

  if (error) {
    console.error("getListItems error:", error);
    return [];
  }

  return (data ?? []) as (CreatorListItem & {
    creator: Record<string, unknown>;
  })[];
}

/* ------------------------------------------------------------------ */
/*  Get list item count for each list                                  */
/* ------------------------------------------------------------------ */

export async function getListItemCounts(
  supabase: SupabaseClient<Database>,
  listIds: string[],
): Promise<Record<string, number>> {
  if (listIds.length === 0) return {};

  const counts: Record<string, number> = {};
  for (const id of listIds) {
    const { count, error } = await supabase
      .from("creator_list_items")
      .select("*", { count: "exact", head: true })
      .eq("list_id", id);

    if (!error) {
      counts[id] = count ?? 0;
    }
  }

  return counts;
}

/* ------------------------------------------------------------------ */
/*  Get lists that contain a given creator                             */
/* ------------------------------------------------------------------ */

export async function getListsForCreator(
  supabase: SupabaseClient<Database>,
  brandId: string,
  creatorId: string,
): Promise<string[]> {
  const { data, error } = await supabase
    .from("creator_list_items")
    .select("list_id, creator_lists!inner(brand_id)")
    .eq("creator_id", creatorId)
    .eq("creator_lists.brand_id", brandId);

  if (error) {
    console.error("getListsForCreator error:", error);
    return [];
  }

  return (data ?? []).map((item: { list_id: string }) => item.list_id);
}
