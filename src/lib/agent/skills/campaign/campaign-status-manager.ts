import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

const VALID_TRANSITIONS: Record<string, string[]> = {
  draft: ["active"],
  active: ["paused", "completed"],
  paused: ["active", "completed"],
  // completed is terminal — no transitions out
};

export function campaignStatusManagerTool(brandId: string, supabase: SupabaseClient) {
  return tool({
    description:
      "Change a campaign's status (activate, pause, or complete). Use this to launch draft campaigns, pause running ones, or mark campaigns as completed.",
    inputSchema: z.object({
      campaign_id: z.string().describe("UUID of the campaign to update"),
      new_status: z
        .enum(["active", "paused", "completed"])
        .describe("Target status for the campaign"),
    }),
    execute: async (params) => {
      // Fetch current campaign
      const { data: campaignRaw, error: fetchErr } = await supabase
        .from("campaigns")
        .select("id, name, status, brand_id")
        .eq("id", params.campaign_id)
        .eq("brand_id", brandId)
        .single();

      if (fetchErr || !campaignRaw) {
        return { error: "Campaign not found or access denied" };
      }

      const campaign = campaignRaw as { id: string; name: string; status: string; brand_id: string };

      // Validate transition
      const allowed = VALID_TRANSITIONS[campaign.status] || [];
      if (!allowed.includes(params.new_status)) {
        return {
          error: `Cannot transition from "${campaign.status}" to "${params.new_status}". Allowed: ${allowed.length > 0 ? allowed.join(", ") : "none (terminal state)"}`,
        };
      }

      // Perform update
      const { error: updateErr } = await supabase
        .from("campaigns")
        .update({ status: params.new_status } as never)
        .eq("id", params.campaign_id);

      if (updateErr) {
        return { error: "Failed to update campaign status: " + updateErr.message };
      }

      return {
        success: true,
        campaign_id: campaign.id,
        campaign_name: campaign.name,
        previous_status: campaign.status,
        new_status: params.new_status,
      };
    },
  });
}
