import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * GET /api/templates — List all templates (brand + defaults)
 * POST /api/templates — Create a new template
 */
export async function GET(_request: NextRequest) {
  try {
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
      return NextResponse.json({ error: "Brand not found." }, { status: 404 });
    }

    // Get brand's own templates + platform defaults
    const { data: templates, error } = await supabase
      .from("outreach_templates")
      .select("*")
      .or(`brand_id.eq.${brand.id},is_default.eq.true`)
      .order("category", { ascending: true })
      .order("times_used", { ascending: false });

    if (error) {
      return NextResponse.json({ error: "Failed to fetch templates." }, { status: 500 });
    }

    return NextResponse.json({ templates: templates || [] });
  } catch (err) {
    console.error("Templates list error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json({ error: "Brand not found." }, { status: 404 });
    }

    const body = await request.json();
    const { name, category, subject, body: templateBody, channel } = body as {
      name: string;
      category?: string;
      subject?: string;
      body: string;
      channel?: string;
    };

    if (!name || !templateBody) {
      return NextResponse.json(
        { error: "Name and body are required." },
        { status: 400 }
      );
    }

    const { data: template, error } = await supabase
      .from("outreach_templates")
      .insert({
        brand_id: brand.id,
        name,
        category: category || "cold_outreach",
        subject: subject || null,
        body: templateBody,
        channel: channel || "email",
        is_default: false,
      } as never)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to create template." }, { status: 500 });
    }

    return NextResponse.json({ template }, { status: 201 });
  } catch (err) {
    console.error("Template create error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
