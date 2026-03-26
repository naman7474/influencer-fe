import type { SupabaseClient } from "@supabase/supabase-js";

export async function getOutreachTemplates(
  supabase: SupabaseClient,
  brandId: string
) {
  const { data, error } = await supabase
    .from("outreach_templates")
    .select("*")
    .eq("brand_id", brandId)
    .order("updated_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function getOutreachMessages(
  supabase: SupabaseClient,
  brandId: string,
  filters: {
    campaignId?: string | null;
    creatorId?: string | null;
    status?: string | null;
    page?: number;
    pageSize?: number;
  } = {}
) {
  const page = Math.max(filters.page ?? 1, 1);
  const pageSize = Math.max(filters.pageSize ?? 20, 1);
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("outreach_messages")
    .select(
      "*, creator:creators(id, handle, display_name, avatar_url, contact_email), campaign:campaigns(id, name)",
      { count: "exact" }
    )
    .eq("brand_id", brandId)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.campaignId) {
    query = query.eq("campaign_id", filters.campaignId);
  }

  if (filters.creatorId) {
    query = query.eq("creator_id", filters.creatorId);
  }

  if (filters.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error, count } = await query;
  if (error) {
    throw error;
  }

  return {
    items: data ?? [],
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function getOutreachMessageDetail(
  supabase: SupabaseClient,
  brandId: string,
  messageId: string
) {
  const { data, error } = await supabase
    .from("outreach_messages")
    .select(
      "*, creator:creators(id, handle, display_name, avatar_url, contact_email), campaign:campaigns(id, name)"
    )
    .eq("brand_id", brandId)
    .eq("id", messageId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getOutreachReplies(
  supabase: SupabaseClient,
  brandId: string,
  messageId: string
) {
  const { data, error } = await supabase
    .from("outreach_replies")
    .select("*")
    .eq("brand_id", brandId)
    .eq("outreach_message_id", messageId)
    .order("received_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data ?? [];
}
