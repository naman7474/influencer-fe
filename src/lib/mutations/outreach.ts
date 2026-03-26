import type { SupabaseClient } from "@supabase/supabase-js";
import { triggerOutreachSendJob } from "@/lib/jobs";
import type { OutreachStatus } from "@/types/api";

const STATUS_ORDER: OutreachStatus[] = [
  "draft",
  "queued",
  "sent",
  "delivered",
  "opened",
  "replied",
  "bounced",
  "failed",
];

function getHigherStatus(current: OutreachStatus, next: OutreachStatus): OutreachStatus {
  return STATUS_ORDER.indexOf(next) > STATUS_ORDER.indexOf(current) ? next : current;
}

export async function createOutreachTemplate(
  supabase: SupabaseClient,
  brandId: string,
  input: {
    name: string;
    channel: string;
    subject?: string | null;
    body: string;
    followup_enabled?: boolean;
    followup_days?: number;
    followup_subject?: string | null;
    followup_body?: string | null;
    max_followups?: number;
  }
) {
  const { data, error } = await supabase
    .from("outreach_templates")
    .insert({
      brand_id: brandId,
      name: input.name,
      channel: input.channel,
      subject: input.subject ?? null,
      body: input.body,
      followup_enabled: Boolean(input.followup_enabled),
      followup_days: input.followup_days ?? 3,
      followup_subject: input.followup_subject ?? null,
      followup_body: input.followup_body ?? null,
      max_followups: input.max_followups ?? 1,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updateOutreachTemplate(
  supabase: SupabaseClient,
  brandId: string,
  templateId: string,
  input: {
    name?: string;
    channel?: string;
    subject?: string | null;
    body?: string;
    followup_enabled?: boolean;
    followup_days?: number;
    followup_subject?: string | null;
    followup_body?: string | null;
    max_followups?: number;
  }
) {
  const payload = {
    ...input,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("outreach_templates")
    .update(payload)
    .eq("id", templateId)
    .eq("brand_id", brandId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteOutreachTemplate(
  supabase: SupabaseClient,
  brandId: string,
  templateId: string
) {
  const { error } = await supabase
    .from("outreach_templates")
    .delete()
    .eq("id", templateId)
    .eq("brand_id", brandId);

  if (error) {
    throw error;
  }
}

export async function createOutreachMessage(
  supabase: SupabaseClient,
  brandId: string,
  input: {
    campaign_id?: string | null;
    creator_id: string;
    template_id?: string | null;
    channel: string;
    subject?: string | null;
    body: string;
    recipient_email?: string | null;
    metadata?: Record<string, unknown>;
    parent_message_id?: string | null;
    followup_number?: number;
  }
) {
  const { data, error } = await supabase
    .from("outreach_messages")
    .insert({
      brand_id: brandId,
      campaign_id: input.campaign_id ?? null,
      creator_id: input.creator_id,
      template_id: input.template_id ?? null,
      channel: input.channel,
      status: "draft",
      subject: input.subject ?? null,
      body: input.body,
      recipient_email: input.recipient_email ?? null,
      metadata: input.metadata ?? {},
      parent_message_id: input.parent_message_id ?? null,
      followup_number: input.followup_number ?? 0,
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function queueOutreachMessage(
  supabase: SupabaseClient,
  brandId: string,
  messageId: string
) {
  const queuedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("outreach_messages")
    .update({
      status: "queued",
      queued_at: queuedAt,
      updated_at: queuedAt,
    })
    .eq("id", messageId)
    .eq("brand_id", brandId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  await triggerOutreachSendJob(brandId, { message_id: messageId });
  return data;
}

export async function bulkQueueOutreach(
  supabase: SupabaseClient,
  brandId: string,
  input: Array<{
    campaign_id?: string | null;
    creator_id: string;
    template_id?: string | null;
    channel: string;
    subject?: string | null;
    body: string;
    recipient_email?: string | null;
    metadata?: Record<string, unknown>;
  }>
) {
  const queuedAt = new Date().toISOString();
  const rows = input.map((row) => ({
    brand_id: brandId,
    campaign_id: row.campaign_id ?? null,
    creator_id: row.creator_id,
    template_id: row.template_id ?? null,
    channel: row.channel,
    status: "queued",
    subject: row.subject ?? null,
    body: row.body,
    recipient_email: row.recipient_email ?? null,
    metadata: row.metadata ?? {},
    queued_at: queuedAt,
  }));

  const { data, error } = await supabase
    .from("outreach_messages")
    .insert(rows)
    .select("*");

  if (error) {
    throw error;
  }

  await triggerOutreachSendJob(brandId, {
    message_ids: (data ?? []).map((item) => item.id),
  });

  return data ?? [];
}

export async function recordOutreachEvent(
  supabase: SupabaseClient,
  input: {
    resend_message_id?: string | null;
    outreach_message_id?: string | null;
    status: OutreachStatus;
    timestamp?: string | null;
    error_message?: string | null;
  }
) {
  const filterField = input.outreach_message_id ? "id" : "resend_message_id";
  const filterValue = input.outreach_message_id ?? input.resend_message_id;

  if (!filterValue) {
    throw new Error("A message id or Resend message id is required.");
  }

  const { data: current, error: currentError } = await supabase
    .from("outreach_messages")
    .select("*")
    .eq(filterField, filterValue)
    .maybeSingle();

  if (currentError) {
    throw currentError;
  }

  if (!current) {
    return null;
  }

  const eventTime = input.timestamp ?? new Date().toISOString();
  const nextStatus = getHigherStatus(current.status, input.status);
  const patch: Record<string, unknown> = {
    status: nextStatus,
    updated_at: new Date().toISOString(),
  };

  if (input.status === "sent") patch.sent_at = current.sent_at ?? eventTime;
  if (input.status === "delivered") patch.delivered_at = current.delivered_at ?? eventTime;
  if (input.status === "opened") patch.opened_at = current.opened_at ?? eventTime;
  if (input.status === "replied") patch.replied_at = current.replied_at ?? eventTime;
  if (input.status === "bounced") patch.bounced_at = current.bounced_at ?? eventTime;
  if (input.status === "failed") {
    patch.failed_at = current.failed_at ?? eventTime;
    patch.error_message = input.error_message ?? current.error_message ?? null;
  }

  const { data, error } = await supabase
    .from("outreach_messages")
    .update(patch)
    .eq("id", current.id)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
