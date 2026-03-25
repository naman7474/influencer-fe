import { apiError, apiOk } from "@/lib/api";
import { requireBrandContext } from "@/lib/queries/brand";
import { createClient } from "@/lib/supabase/server";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const supabase = await createClient();
    const brand = await requireBrandContext(supabase);

    const { error } = await supabase
      .from("brand_shortlist_items")
      .delete()
      .eq("id", id)
      .eq("brand_id", brand.brand_id);

    if (error) {
      throw error;
    }

    return apiOk({
      deleted: true,
      shortlist_item_id: id,
    });
  } catch (error) {
    return apiError(500, {
      code: "shortlist_delete_failed",
      message:
        error instanceof Error ? error.message : "Unable to delete shortlist item.",
    });
  }
}
