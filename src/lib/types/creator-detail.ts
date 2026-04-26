import type {
  Creator,
  CreatorScore,
  CaptionIntelligence,
  TranscriptIntelligence,
  AudienceIntelligence,
  Post,
} from "./database";

export type SocialPlatform = "instagram" | "youtube";

/** One row from creator_social_profiles. */
export interface CreatorPlatformProfile {
  creator_id: string;
  platform: SocialPlatform;
  handle: string;
  platform_user_id: string | null;
  profile_url: string | null;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  category: string | null;
  country: string | null;
  is_verified: boolean;
  is_business: boolean;
  followers_or_subs: number;
  posts_or_videos_count: number;
  avg_engagement: number | null;
  external_links: unknown;
  last_synced_at: string | null;
}

export interface IntelligenceBundle {
  caption: CaptionIntelligence | null;
  transcript: TranscriptIntelligence | null;
  audience: AudienceIntelligence | null;
}

/**
 * Denormalized YouTube video record — mirrors the shape of a `posts` row
 * so components can render IG + YT content through the same feed. Keys
 * chosen from `youtube_videos` match the public field surface.
 */
export interface YoutubeVideoItem {
  id: string;
  creator_id: string;
  video_id: string;
  url: string | null;
  title: string | null;
  description: string | null;
  tags: string[];
  category_id: number | null;
  is_short: boolean;
  is_livestream: boolean;
  duration_seconds: number | null;
  view_count: number;
  like_count: number;
  comment_count: number;
  thumbnail_url: string | null;
  has_captions: boolean;
  caption_source: string | null;
  published_at: string | null;
}

export type ContentItem =
  | ({ kind: "ig_post" } & Post)
  | ({ kind: "yt_video" } & YoutubeVideoItem);

export interface CreatorDetail {
  creator: Creator;
  profiles: CreatorPlatformProfile[];
  scores_by_platform: Partial<Record<SocialPlatform, CreatorScore | null>>;
  intelligence_by_platform: Partial<Record<SocialPlatform, IntelligenceBundle>>;
  content_by_platform: Partial<Record<SocialPlatform, ContentItem[]>>;
  /** Platform with the most followers/subs, used as the default tab. */
  primary_platform: SocialPlatform;
}
