import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

import { createServerSupabaseClient } from "@/lib/supabase/server";

interface CampaignCreatorTokenRow {
  id: string;
  campaign_id: string;
  creator_id: string;
  submission_token: string | null;
  submission_token_expires_at: string | null;
  status: string;
}

function buildSubmissionUrl(campaignCreatorId: string, token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/submit/${campaignCreatorId}/${token}`;
}

/**
 * POST /api/campaigns/[id]/creators/[creator_id]/submission-link
 *
 * Idempotently returns or creates the submission token for one creator on a
 * campaign. Lets the brand share the upload URL with the creator from the
 * campaign side panel.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; creator_id: string }> },
) {
  try {
    const { id: campaignId, creator_id: creatorId } = await params;
    const supabase = await createServerSupabaseClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { data: ccRow } = await supabase
      .from("campaign_creators")
      .select(
        "id, campaign_id, creator_id, submission_token, submission_token_expires_at, status",
      )
      .eq("campaign_id", campaignId)
      .eq("creator_id", creatorId)
      .maybeSingle();
    const cc = ccRow as CampaignCreatorTokenRow | null;
    if (!cc) {
      return NextResponse.json(
        { error: "Creator is not on this campaign." },
        { status: 404 },
      );
    }

    if (cc.submission_token) {
      return NextResponse.json({
        link: {
          campaign_creator_id: cc.id,
          creator_id: cc.creator_id,
          submission_url: buildSubmissionUrl(cc.id, cc.submission_token),
          expires_at: cc.submission_token_expires_at,
        },
        created: false,
      });
    }

    const token = randomBytes(24).toString("hex");
    const expires = new Date();
    expires.setDate(expires.getDate() + 90);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase as any)
      .from("campaign_creators")
      .update({
        submission_token: token,
        submission_token_expires_at: expires.toISOString(),
        content_status:
          cc.status === "confirmed" ? "brief_sent" : undefined,
      } as never)
      .eq("id", cc.id);

    if (updateError) {
      console.error("submission-link update:", updateError);
      return NextResponse.json(
        { error: "Failed to create submission link." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      link: {
        campaign_creator_id: cc.id,
        creator_id: cc.creator_id,
        submission_url: buildSubmissionUrl(cc.id, token),
        expires_at: expires.toISOString(),
      },
      created: true,
    });
  } catch (err) {
    console.error("submission-link error:", err);
    return NextResponse.json(
      { error: "Internal server error." },
      { status: 500 },
    );
  }
}
