import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { generateBrandMd } from "@/lib/agent/brand-md";
import { DEFAULT_SOUL_MD } from "@/lib/agent/soul-md";
import type { Brand } from "@/lib/types/database";

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: brandRow } = await supabase
      .from("brands")
      .select("*")
      .eq("auth_user_id", user.id)
      .single();
    const brand = brandRow as Brand | null;

    if (!brand) {
      return NextResponse.json({ error: "Brand not found" }, { status: 404 });
    }

    const { type } = await request.json();

    let content: string;

    if (type === "brand") {
      content = generateBrandMd(brand);
      await supabase
        .from("agent_config")
        .update({ brand_md: content, updated_at: new Date().toISOString() } as never)
        .eq("brand_id", brand.id);
    } else if (type === "soul") {
      content = DEFAULT_SOUL_MD;
      await supabase
        .from("agent_config")
        .update({ soul_md: content, updated_at: new Date().toISOString() } as never)
        .eq("brand_id", brand.id);
    } else {
      return NextResponse.json(
        { error: 'Invalid type. Use "brand" or "soul".' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, data: { type, content } });
  } catch {
    return NextResponse.json(
      { error: "Failed to generate context" },
      { status: 500 }
    );
  }
}
