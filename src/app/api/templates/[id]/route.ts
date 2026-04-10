import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

/**
 * PUT /api/templates/[id] — Update a template
 * DELETE /api/templates/[id] — Delete a template
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: templateId } = await params;
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
    const { name, category, subject, body: templateBody } = body as {
      name?: string;
      category?: string;
      subject?: string;
      body?: string;
    };

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (subject !== undefined) updates.subject = subject;
    if (templateBody !== undefined) updates.body = templateBody;

    const { data: template, error } = await supabase
      .from("outreach_templates")
      .update(updates as never)
      .eq("id", templateId)
      .eq("brand_id", brand.id)
      .select()
      .single();

    if (error || !template) {
      return NextResponse.json(
        { error: "Template not found or access denied." },
        { status: 404 }
      );
    }

    return NextResponse.json({ template });
  } catch (err) {
    console.error("Template update error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: templateId } = await params;
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

    // Don't allow deleting default templates
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: templateRow } = await (supabase as any)
      .from("outreach_templates")
      .select("id, is_default")
      .eq("id", templateId)
      .single();

    const template = templateRow as { id: string; is_default: boolean } | null;
    if (!template) {
      return NextResponse.json({ error: "Template not found." }, { status: 404 });
    }

    if (template.is_default) {
      return NextResponse.json(
        { error: "Cannot delete default templates." },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("outreach_templates")
      .delete()
      .eq("id", templateId)
      .eq("brand_id", brand.id);

    if (error) {
      return NextResponse.json({ error: "Failed to delete template." }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Template delete error:", err);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
