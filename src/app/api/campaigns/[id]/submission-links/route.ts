import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

/**
 * GET /api/campaigns/[id]/submission-links
 * Returns submission links for all creators in a campaign.
 *
 * POST /api/campaigns/[id]/submission-links
 * Generates submission tokens for confirmed+ creators that don't have one yet.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (supabase as any)
      .from("campaign_creators")
      .select("id, creator_id, submission_token, submission_token_expires_at")
      .eq("campaign_id", campaignId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch submission links." },
        { status: 500 }
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const links = (rows ?? []).map(
      (r: {
        id: string;
        creator_id: string;
        submission_token: string | null;
        submission_token_expires_at: string | null;
      }) => ({
        campaign_creator_id: r.id,
        creator_id: r.creator_id,
        has_token: !!r.submission_token,
        submission_url: r.submission_token
          ? `${baseUrl}/submit/${r.id}/${r.submission_token}`
          : null,
        expires_at: r.submission_token_expires_at,
      })
    );

    return NextResponse.json({ links });
  } catch (err) {
    console.error("GET submission-links error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: campaignId } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    // Get all creators in this campaign that don't have a token yet
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rows, error } = await (supabase as any)
      .from("campaign_creators")
      .select("id, creator_id, submission_token, status")
      .eq("campaign_id", campaignId);

    if (error) {
      return NextResponse.json(
        { error: "Failed to fetch campaign creators." },
        { status: 500 }
      );
    }

    const creators = rows as Array<{
      id: string;
      creator_id: string;
      submission_token: string | null;
      status: string;
    }>;

    // Generate tokens for creators that don't have one yet
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 90); // 90-day expiry

    let generated = 0;
    for (const cc of creators ?? []) {
      if (cc.submission_token) continue; // already has a token

      const token = randomBytes(24).toString("hex");

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any)
        .from("campaign_creators")
        .update({
          submission_token: token,
          submission_token_expires_at: expiresAt.toISOString(),
          content_status:
            cc.status === "confirmed" ? "brief_sent" : undefined,
        } as never)
        .eq("id", cc.id);

      generated++;
    }

    // Return updated links
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: updated } = await (supabase as any)
      .from("campaign_creators")
      .select("id, creator_id, submission_token, submission_token_expires_at")
      .eq("campaign_id", campaignId);

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const links = (updated ?? []).map(
      (r: {
        id: string;
        creator_id: string;
        submission_token: string | null;
        submission_token_expires_at: string | null;
      }) => ({
        campaign_creator_id: r.id,
        creator_id: r.creator_id,
        has_token: !!r.submission_token,
        submission_url: r.submission_token
          ? `${baseUrl}/submit/${r.id}/${r.submission_token}`
          : null,
        expires_at: r.submission_token_expires_at,
      })
    );

    return NextResponse.json({ generated, links });
  } catch (err) {
    console.error("POST submission-links error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 }
    );
  }
}
