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
  billing_plan: BillingPlan;
  user_role: UserRole;
  feature_flags: {
    geo_enabled: boolean;
    campaigns_enabled: boolean;
    billing_enabled: boolean;
    brand_fit_enabled: boolean;
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
  created_at?: string;
  updated_at?: string;
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
