export type CampaignGoal = "awareness" | "conversion" | "ugc";

export type CreatorTier = "nano" | "micro" | "mid" | "macro" | "mega";

export type EngagementTrend =
  | "growing"
  | "stable"
  | "declining"
  | "insufficient_data";

export type ProblemType =
  | "awareness_gap"
  | "conversion_gap"
  | "strong_market";

export type ContentType =
  | "video"
  | "image"
  | "carousel"
  | "reel"
  | "story"
  | "unknown";

export type CampaignCreatorStatus =
  | "shortlisted"
  | "contacted"
  | "confirmed"
  | "completed"
  | "declined"
  | "cancelled";

export type Sentiment =
  | "positive"
  | "neutral"
  | "mixed"
  | "negative"
  | "unknown";

export type BillingPlan = "starter" | "growth" | "scale" | "enterprise";

export type UserRole = "owner" | "admin" | "editor" | "viewer";

export type ShopifySyncStatus =
  | "idle"
  | "queued"
  | "running"
  | "succeeded"
  | "failed";

export type OutreachChannel = "email" | "whatsapp" | "instagram_dm";

export type OutreachStatus =
  | "draft"
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "replied"
  | "bounced"
  | "failed";

export type InboundStatus =
  | "new"
  | "analyzing"
  | "scored"
  | "accepted"
  | "rejected";

export interface ApiMeta {
  request_id?: string;
  page?: number;
  page_size?: number;
  total?: number;
  total_pages?: number;
  next_cursor?: string | null;
  generated_at?: string;
}

export interface ApiErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown> | null;
}

export interface ApiEnvelope<T, M extends ApiMeta = ApiMeta> {
  data: T | null;
  meta: M;
  error: ApiErrorPayload | null;
}

export interface BrandContext {
  brand_id: string;
  brand_name: string;
  logo_url: string | null;
  industry: string | null;
  website: string | null;
  shopify_connected: boolean;
  instagram_connected: boolean;
  billing_plan: BillingPlan;
  user_role: UserRole;
  feature_flags: {
    geo_enabled: boolean;
    campaigns_enabled: boolean;
    billing_enabled: boolean;
    brand_fit_enabled: boolean;
    inbound_enabled: boolean;
  };
}

export interface BrandContextRecord extends BrandContext {
  auth_user_id: string | null;
  onboarding_step: number;
  shopify_store_url: string | null;
  shopify_connected_at: string | null;
  shopify_last_sync_at: string | null;
  shopify_sync_status: ShopifySyncStatus;
  shopify_sync_error: string | null;
  shopify_sync_started_at: string | null;
  shopify_sync_completed_at: string | null;
  instagram_connected_at: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface OutreachTemplate {
  id: string;
  brand_id: string;
  name: string;
  channel: OutreachChannel;
  subject: string | null;
  body: string;
  followup_enabled: boolean;
  followup_days: number;
  followup_subject: string | null;
  followup_body: string | null;
  max_followups: number;
  created_at: string;
  updated_at: string;
}

export interface OutreachMessage {
  id: string;
  brand_id: string;
  campaign_id: string | null;
  creator_id: string;
  template_id: string | null;
  channel: OutreachChannel;
  status: OutreachStatus;
  subject: string | null;
  body: string;
  recipient_email: string | null;
  from_email: string | null;
  resend_message_id: string | null;
  inbound_reply_address: string | null;
  parent_message_id: string | null;
  followup_number: number;
  queued_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  replied_at: string | null;
  bounced_at: string | null;
  failed_at: string | null;
  error_message: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  creator?: {
    id: string;
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
    contact_email?: string | null;
  };
  campaign?: {
    id: string;
    name: string;
  } | null;
}

export interface OutreachReply {
  id: string;
  brand_id: string;
  outreach_message_id: string;
  resend_message_id: string | null;
  from_email: string | null;
  to_email: string | null;
  subject: string | null;
  text_content: string | null;
  html_content: string | null;
  raw_payload: Record<string, unknown>;
  received_at: string;
  created_at: string;
}

export interface InboundCreator {
  id: string;
  brand_id: string;
  sender_id: string;
  sender_handle: string | null;
  sender_name: string | null;
  sender_avatar_url: string | null;
  message_preview: string | null;
  last_message_at: string | null;
  status: InboundStatus;
  linked_creator_id: string | null;
  cpi_score: number | null;
  match_score: number | null;
  created_at: string;
  updated_at: string;
  creator?: {
    id: string;
    handle: string;
    display_name: string | null;
    avatar_url: string | null;
    followers?: number | null;
  } | null;
}

export interface CampaignUtmLink {
  id: string;
  brand_id: string;
  campaign_id: string;
  creator_id: string;
  campaign_creator_id: string | null;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  full_url: string;
  clicks: number;
  orders_attributed: number;
  revenue_attributed: number;
  created_at: string;
  updated_at: string;
}

export interface BrandProduct {
  id: string;
  brand_id: string;
  shopify_product_id: string;
  title: string;
  handle: string | null;
  product_type: string | null;
  tags: string[];
  image_url: string | null;
  status: string | null;
  min_price: number | null;
  max_price: number | null;
  currency: string | null;
}

export interface BrandMatchSummary {
  creator_id: string;
  match_score: number;
  niche_fit_score: number;
  audience_geo_score: number;
  price_tier_score: number;
  engagement_score: number;
  brand_safety_score: number;
  content_style_score: number;
  recommended_for: string | null;
  match_reasoning: string | null;
  geo_match_regions: Array<{
    region: string;
    weight?: number;
    gap_score?: number;
    problem_type?: ProblemType | string;
  }>;
}

export interface CreatorDiscoveryCard {
  creator_id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  is_verified: boolean;
  tier: CreatorTier | null;
  followers: number | null;
  posts_count: number | null;
  city: string | null;
  country: string | null;
  cpi: number | null;
  avg_engagement_rate: number | null;
  engagement_trend: EngagementTrend;
  audience_authenticity_score: number | null;
  primary_niche: string | null;
  secondary_niche: string | null;
  primary_tone: string | null;
  audience_country: string | null;
  match_score: number | null;
  shortlist_state?: {
    is_shortlisted: boolean;
    shortlist_item_id: string | null;
  };
}

export interface OnboardingState {
  is_complete: boolean;
  current_step: 1 | 2 | 3;
  brand_profile: {
    brand_name: string | null;
    website: string | null;
    logo_url: string | null;
    industry: string | null;
  };
  shopify: {
    shopify_connected: boolean;
    store_url: string | null;
    last_sync_at: string | null;
    sync_status: ShopifySyncStatus;
    sync_error: string | null;
  };
  preferences: {
    default_campaign_goal: CampaignGoal | null;
    budget_per_creator_min_paise: number | null;
    budget_per_creator_max_paise: number | null;
    content_format_pref: string[];
    past_collaborations: string[];
    competitor_brands: string[];
  };
}

export interface SaveBrandProfileRequest {
  brand_name: string;
  website: string | null;
  logo_url: string | null;
  industry: string | null;
}

export interface ShopifyConnectRequest {
  store_url: string;
  admin_access_token?: string;
}

export interface SaveBrandPreferencesRequest {
  default_campaign_goal: CampaignGoal;
  budget_per_creator_min_paise: number | null;
  budget_per_creator_max_paise: number | null;
  content_format_pref: string[];
  past_collaborations: string[];
  competitor_brands: string[];
}
