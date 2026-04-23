import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getIgPreview } from "@/lib/scraping/ig-preview";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: brandId } = await params;

  // Auth check
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify brand ownership
  const { data: brandData } = await supabase
    .from("brands")
    .select("id, instagram_handle")
    .eq("id", brandId)
    .eq("auth_user_id", user.id)
    .single();
  const brand = brandData as { id: string; instagram_handle: string | null } | null;

  if (!brand) {
    return NextResponse.json({ error: "Brand not found" }, { status: 404 });
  }

  // Get handle from request body or brand record
  const body = await request.json().catch(() => ({}));
  const handle =
    (body as { handle?: string }).handle ?? brand.instagram_handle;

  if (!handle) {
    return NextResponse.json(
      { error: "No Instagram handle provided" },
      { status: 400 }
    );
  }

  const result = await getIgPreview(handle);

  if (result.error) {
    return NextResponse.json(
      { error: result.error },
      { status: 502 }
    );
  }

  return NextResponse.json({
    data: result.data,
    note: "This is a quick preview. A deeper analysis is running and will be ready in a few minutes.",
  });
}
