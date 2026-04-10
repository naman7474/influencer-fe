import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { deactivateDiscountCode } from "@/lib/composio-shopify";

/**
 * DELETE /api/discount-codes/[id]
 * Deactivate a discount code (marks inactive locally + removes from Shopify).
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: codeId } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: brandRow } = await supabase
      .from("brands")
      .select("id")
      .eq("auth_user_id", user.id)
      .single();

    const brand = brandRow as { id: string } | null;

    if (!brand) {
      return NextResponse.json(
        { error: "Brand not found." },
        { status: 404 }
      );
    }

    // Get the code
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: codeRow, error: codeError } = await (supabase as any)
      .from("campaign_discount_codes")
      .select("id, shopify_discount_id, brand_id")
      .eq("id", codeId)
      .eq("brand_id", brand.id)
      .single();

    const code = codeRow as {
      id: string;
      shopify_discount_id: string | null;
      brand_id: string;
    } | null;

    if (codeError || !code) {
      return NextResponse.json(
        { error: "Discount code not found." },
        { status: 404 }
      );
    }

    // Deactivate in Shopify if we have a Shopify ID
    if (code.shopify_discount_id) {
      try {
        await deactivateDiscountCode(brand.id, code.shopify_discount_id);
      } catch (err) {
        console.warn("Failed to deactivate in Shopify:", err);
      }
    }

    // Mark inactive in our DB
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("campaign_discount_codes")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", codeId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE discount-code error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
