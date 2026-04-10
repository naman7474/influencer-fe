/* ------------------------------------------------------------------ */
/*  Auto-generated-style Supabase Database type definitions            */
/*  for the Influencer Intelligence Platform                           */
/* ------------------------------------------------------------------ */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      creators: {
        Row: {
          id: string;
          handle: string;
          instagram_id: string | null;
          fbid: string | null;
          display_name: string | null;
          biography: string | null;
          external_url: string | null;
          avatar_url: string | null;
          category: string | null;
          city: string | null;
          country: string | null;
          is_business: boolean | null;
          is_professional: boolean | null;
          is_verified: boolean | null;
          followers: number | null;
          following: number | null;
          posts_count: number | null;
          tier: Database["public"]["Enums"]["creator_tier"] | null;
          follower_following_ratio: number | null;
          posts_to_follower_efficiency: number | null;
          contact_email: string | null;
          contact_phone: string | null;
          brightdata_avg_engagement: number | null;
          bio_hashtags: string[] | null;
          post_hashtags: string[] | null;
          first_scraped_at: string | null;
          last_scraped_at: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          handle: string;
          instagram_id?: string | null;
          fbid?: string | null;
          display_name?: string | null;
          biography?: string | null;
          external_url?: string | null;
          avatar_url?: string | null;
          category?: string | null;
          city?: string | null;
          country?: string | null;
          is_business?: boolean | null;
          is_professional?: boolean | null;
          is_verified?: boolean | null;
          followers?: number | null;
          following?: number | null;
          posts_count?: number | null;
          tier?: Database["public"]["Enums"]["creator_tier"] | null;
          follower_following_ratio?: number | null;
          posts_to_follower_efficiency?: number | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          brightdata_avg_engagement?: number | null;
          bio_hashtags?: string[] | null;
          post_hashtags?: string[] | null;
          first_scraped_at?: string | null;
          last_scraped_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          handle?: string;
          instagram_id?: string | null;
          fbid?: string | null;
          display_name?: string | null;
          biography?: string | null;
          external_url?: string | null;
          avatar_url?: string | null;
          category?: string | null;
          city?: string | null;
          country?: string | null;
          is_business?: boolean | null;
          is_professional?: boolean | null;
          is_verified?: boolean | null;
          followers?: number | null;
          following?: number | null;
          posts_count?: number | null;
          tier?: Database["public"]["Enums"]["creator_tier"] | null;
          follower_following_ratio?: number | null;
          posts_to_follower_efficiency?: number | null;
          contact_email?: string | null;
          contact_phone?: string | null;
          brightdata_avg_engagement?: number | null;
          bio_hashtags?: string[] | null;
          post_hashtags?: string[] | null;
          first_scraped_at?: string | null;
          last_scraped_at?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      posts: {
        Row: {
          id: string;
          creator_id: string;
          post_id: string;
          url: string | null;
          shortcode: string | null;
          description: string | null;
          hashtags: string[] | null;
          content_type: Database["public"]["Enums"]["content_type"] | null;
          likes: number | null;
          num_comments: number | null;
          video_view_count: number | null;
          video_play_count: number | null;
          is_paid_partnership: boolean | null;
          is_sponsored: boolean | null;
          thumbnail_url: string | null;
          date_posted: string | null;
          engagement_rate: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          post_id: string;
          url?: string | null;
          shortcode?: string | null;
          description?: string | null;
          hashtags?: string[] | null;
          content_type?: Database["public"]["Enums"]["content_type"] | null;
          likes?: number | null;
          num_comments?: number | null;
          video_view_count?: number | null;
          video_play_count?: number | null;
          is_paid_partnership?: boolean | null;
          is_sponsored?: boolean | null;
          thumbnail_url?: string | null;
          date_posted?: string | null;
          engagement_rate?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          post_id?: string;
          url?: string | null;
          shortcode?: string | null;
          description?: string | null;
          hashtags?: string[] | null;
          content_type?: Database["public"]["Enums"]["content_type"] | null;
          likes?: number | null;
          num_comments?: number | null;
          video_view_count?: number | null;
          video_play_count?: number | null;
          is_paid_partnership?: boolean | null;
          is_sponsored?: boolean | null;
          thumbnail_url?: string | null;
          date_posted?: string | null;
          engagement_rate?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      creator_scores: {
        Row: {
          id: string;
          creator_id: string;
          engagement_quality: number | null;
          content_quality: number | null;
          audience_authenticity: number | null;
          growth_trajectory: number | null;
          professionalism: number | null;
          cpi: number | null;
          avg_engagement_rate: number | null;
          median_engagement_rate: number | null;
          engagement_trend: Database["public"]["Enums"]["trend_direction"] | null;
          engagement_by_content_type: Json | null;
          posts_per_week: number | null;
          posting_consistency_stddev: number | null;
          content_mix: Json | null;
          sponsored_post_rate: number | null;
          sponsored_vs_organic_delta: number | null;
          brand_mentions: string[] | null;
          brand_mentions_count: number | null;
          top_hashtags: Json | null;
          avg_views_to_likes_ratio: number | null;
          avg_rewatch_rate: number | null;
          avg_reel_length_seconds: number | null;
          creator_reply_rate: number | null;
          unique_commenter_count: number | null;
          comment_hour_distribution: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          engagement_quality?: number | null;
          content_quality?: number | null;
          audience_authenticity?: number | null;
          growth_trajectory?: number | null;
          professionalism?: number | null;
          cpi?: number | null;
          avg_engagement_rate?: number | null;
          median_engagement_rate?: number | null;
          engagement_trend?: Database["public"]["Enums"]["trend_direction"] | null;
          engagement_by_content_type?: Json | null;
          posts_per_week?: number | null;
          posting_consistency_stddev?: number | null;
          content_mix?: Json | null;
          sponsored_post_rate?: number | null;
          sponsored_vs_organic_delta?: number | null;
          brand_mentions?: string[] | null;
          brand_mentions_count?: number | null;
          top_hashtags?: Json | null;
          avg_views_to_likes_ratio?: number | null;
          avg_rewatch_rate?: number | null;
          avg_reel_length_seconds?: number | null;
          creator_reply_rate?: number | null;
          unique_commenter_count?: number | null;
          comment_hour_distribution?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          engagement_quality?: number | null;
          content_quality?: number | null;
          audience_authenticity?: number | null;
          growth_trajectory?: number | null;
          professionalism?: number | null;
          cpi?: number | null;
          avg_engagement_rate?: number | null;
          median_engagement_rate?: number | null;
          engagement_trend?: Database["public"]["Enums"]["trend_direction"] | null;
          engagement_by_content_type?: Json | null;
          posts_per_week?: number | null;
          posting_consistency_stddev?: number | null;
          content_mix?: Json | null;
          sponsored_post_rate?: number | null;
          sponsored_vs_organic_delta?: number | null;
          brand_mentions?: string[] | null;
          brand_mentions_count?: number | null;
          top_hashtags?: Json | null;
          avg_views_to_likes_ratio?: number | null;
          avg_rewatch_rate?: number | null;
          avg_reel_length_seconds?: number | null;
          creator_reply_rate?: number | null;
          unique_commenter_count?: number | null;
          comment_hour_distribution?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      caption_intelligence: {
        Row: {
          id: string;
          creator_id: string;
          primary_niche: string | null;
          secondary_niche: string | null;
          niche_confidence: number | null;
          primary_tone: Database["public"]["Enums"]["content_tone"] | null;
          secondary_tone: Database["public"]["Enums"]["content_tone"] | null;
          formality_score: number | null;
          humor_score: number | null;
          authenticity_feel: number | null;
          primary_language: string | null;
          language_mix: Json | null;
          uses_transliteration: boolean | null;
          script_types: string[] | null;
          dominant_cta_style: string | null;
          cta_frequency: number | null;
          is_conversion_oriented: boolean | null;
          organic_brand_mentions: string[] | null;
          paid_brand_mentions: string[] | null;
          brand_categories: string[] | null;
          recurring_topics: string[] | null;
          content_pillars: string[] | null;
          personal_storytelling_freq: number | null;
          vulnerability_openness: number | null;
          engagement_bait_score: number | null;
          posts_analyzed: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          primary_niche?: string | null;
          secondary_niche?: string | null;
          niche_confidence?: number | null;
          primary_tone?: Database["public"]["Enums"]["content_tone"] | null;
          secondary_tone?: Database["public"]["Enums"]["content_tone"] | null;
          formality_score?: number | null;
          humor_score?: number | null;
          authenticity_feel?: number | null;
          primary_language?: string | null;
          language_mix?: Json | null;
          uses_transliteration?: boolean | null;
          script_types?: string[] | null;
          dominant_cta_style?: string | null;
          cta_frequency?: number | null;
          is_conversion_oriented?: boolean | null;
          organic_brand_mentions?: string[] | null;
          paid_brand_mentions?: string[] | null;
          brand_categories?: string[] | null;
          recurring_topics?: string[] | null;
          content_pillars?: string[] | null;
          personal_storytelling_freq?: number | null;
          vulnerability_openness?: number | null;
          engagement_bait_score?: number | null;
          posts_analyzed?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          primary_niche?: string | null;
          secondary_niche?: string | null;
          niche_confidence?: number | null;
          primary_tone?: Database["public"]["Enums"]["content_tone"] | null;
          secondary_tone?: Database["public"]["Enums"]["content_tone"] | null;
          formality_score?: number | null;
          humor_score?: number | null;
          authenticity_feel?: number | null;
          primary_language?: string | null;
          language_mix?: Json | null;
          uses_transliteration?: boolean | null;
          script_types?: string[] | null;
          dominant_cta_style?: string | null;
          cta_frequency?: number | null;
          is_conversion_oriented?: boolean | null;
          organic_brand_mentions?: string[] | null;
          paid_brand_mentions?: string[] | null;
          brand_categories?: string[] | null;
          recurring_topics?: string[] | null;
          content_pillars?: string[] | null;
          personal_storytelling_freq?: number | null;
          vulnerability_openness?: number | null;
          engagement_bait_score?: number | null;
          posts_analyzed?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      transcript_intelligence: {
        Row: {
          id: string;
          creator_id: string;
          primary_spoken_language: string | null;
          languages_spoken: string[] | null;
          caption_vs_spoken_mismatch: boolean | null;
          avg_hook_quality: number | null;
          dominant_hook_style: string | null;
          hook_details: Json | null;
          brand_mention_analysis: Json | null;
          avg_word_count: number | null;
          vocabulary_complexity: number | null;
          educational_density: number | null;
          storytelling_score: number | null;
          filler_word_frequency: number | null;
          audio_quality_rating: number | null;
          cultural_references: string[] | null;
          local_places_mentioned: string[] | null;
          regional_language_phrases: string[] | null;
          estimated_region: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          primary_spoken_language?: string | null;
          languages_spoken?: string[] | null;
          caption_vs_spoken_mismatch?: boolean | null;
          avg_hook_quality?: number | null;
          dominant_hook_style?: string | null;
          hook_details?: Json | null;
          brand_mention_analysis?: Json | null;
          avg_word_count?: number | null;
          vocabulary_complexity?: number | null;
          educational_density?: number | null;
          storytelling_score?: number | null;
          filler_word_frequency?: number | null;
          audio_quality_rating?: number | null;
          cultural_references?: string[] | null;
          local_places_mentioned?: string[] | null;
          regional_language_phrases?: string[] | null;
          estimated_region?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          primary_spoken_language?: string | null;
          languages_spoken?: string[] | null;
          caption_vs_spoken_mismatch?: boolean | null;
          avg_hook_quality?: number | null;
          dominant_hook_style?: string | null;
          hook_details?: Json | null;
          brand_mention_analysis?: Json | null;
          avg_word_count?: number | null;
          vocabulary_complexity?: number | null;
          educational_density?: number | null;
          storytelling_score?: number | null;
          filler_word_frequency?: number | null;
          audio_quality_rating?: number | null;
          cultural_references?: string[] | null;
          local_places_mentioned?: string[] | null;
          regional_language_phrases?: string[] | null;
          estimated_region?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      audience_intelligence: {
        Row: {
          id: string;
          creator_id: string;
          audience_languages: Json | null;
          primary_audience_language: string | null;
          is_multilingual_audience: boolean | null;
          geo_regions: Json | null;
          domestic_percentage: number | null;
          primary_country: string | null;
          authenticity_score: number | null;
          emoji_only_percentage: number | null;
          generic_comment_percentage: number | null;
          substantive_comment_percentage: number | null;
          suspicious_patterns: string[] | null;
          overall_sentiment: string | null;
          sentiment_score: number | null;
          positive_themes: string[] | null;
          negative_themes: string[] | null;
          estimated_age_group: string | null;
          estimated_gender_skew: string | null;
          interest_signals: string[] | null;
          engagement_quality_score: number | null;
          conversation_depth: number | null;
          community_strength: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          audience_languages?: Json | null;
          primary_audience_language?: string | null;
          is_multilingual_audience?: boolean | null;
          geo_regions?: Json | null;
          domestic_percentage?: number | null;
          primary_country?: string | null;
          authenticity_score?: number | null;
          emoji_only_percentage?: number | null;
          generic_comment_percentage?: number | null;
          substantive_comment_percentage?: number | null;
          suspicious_patterns?: string[] | null;
          overall_sentiment?: string | null;
          sentiment_score?: number | null;
          positive_themes?: string[] | null;
          negative_themes?: string[] | null;
          estimated_age_group?: string | null;
          estimated_gender_skew?: string | null;
          interest_signals?: string[] | null;
          engagement_quality_score?: number | null;
          conversation_depth?: number | null;
          community_strength?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          audience_languages?: Json | null;
          primary_audience_language?: string | null;
          is_multilingual_audience?: boolean | null;
          geo_regions?: Json | null;
          domestic_percentage?: number | null;
          primary_country?: string | null;
          authenticity_score?: number | null;
          emoji_only_percentage?: number | null;
          generic_comment_percentage?: number | null;
          substantive_comment_percentage?: number | null;
          suspicious_patterns?: string[] | null;
          overall_sentiment?: string | null;
          sentiment_score?: number | null;
          positive_themes?: string[] | null;
          negative_themes?: string[] | null;
          estimated_age_group?: string | null;
          estimated_gender_skew?: string | null;
          interest_signals?: string[] | null;
          engagement_quality_score?: number | null;
          conversation_depth?: number | null;
          community_strength?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      brands: {
        Row: {
          id: string;
          auth_user_id: string;
          brand_name: string;
          website: string | null;
          logo_url: string | null;
          industry: string | null;
          shopify_store_url: string | null;
          shopify_connected: boolean;
          product_categories: string[] | null;
          avg_product_price: number | null;
          price_currency: string | null;
          shipping_zones: string[] | null;
          default_campaign_goal: Database["public"]["Enums"]["campaign_goal"] | null;
          budget_per_creator_min: number | null;
          budget_per_creator_max: number | null;
          past_collaborations: string[] | null;
          competitor_brands: string[] | null;
          content_format_pref: Database["public"]["Enums"]["content_format"] | null;
          onboarding_step: number;
          onboarded_at: string | null;
          gmail_connected: boolean;
          gmail_email: string | null;
          composio_gmail_connection_id: string | null;
          email_sender_name: string | null;
          email_signature: string | null;
          email_include_tracking: boolean;
          email_include_logo: boolean;
          agent_enabled: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          auth_user_id: string;
          brand_name: string;
          website?: string | null;
          logo_url?: string | null;
          industry?: string | null;
          shopify_store_url?: string | null;
          shopify_connected?: boolean;
          product_categories?: string[] | null;
          avg_product_price?: number | null;
          price_currency?: string | null;
          shipping_zones?: string[] | null;
          default_campaign_goal?: Database["public"]["Enums"]["campaign_goal"] | null;
          budget_per_creator_min?: number | null;
          budget_per_creator_max?: number | null;
          past_collaborations?: string[] | null;
          competitor_brands?: string[] | null;
          content_format_pref?: Database["public"]["Enums"]["content_format"] | null;
          onboarding_step?: number;
          onboarded_at?: string | null;
          gmail_connected?: boolean;
          gmail_email?: string | null;
          composio_gmail_connection_id?: string | null;
          email_sender_name?: string | null;
          email_signature?: string | null;
          email_include_tracking?: boolean;
          email_include_logo?: boolean;
          agent_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          auth_user_id?: string;
          brand_name?: string;
          website?: string | null;
          logo_url?: string | null;
          industry?: string | null;
          shopify_store_url?: string | null;
          shopify_connected?: boolean;
          product_categories?: string[] | null;
          avg_product_price?: number | null;
          price_currency?: string | null;
          shipping_zones?: string[] | null;
          default_campaign_goal?: Database["public"]["Enums"]["campaign_goal"] | null;
          budget_per_creator_min?: number | null;
          budget_per_creator_max?: number | null;
          past_collaborations?: string[] | null;
          competitor_brands?: string[] | null;
          content_format_pref?: Database["public"]["Enums"]["content_format"] | null;
          onboarding_step?: number;
          onboarded_at?: string | null;
          gmail_connected?: boolean;
          gmail_email?: string | null;
          composio_gmail_connection_id?: string | null;
          email_sender_name?: string | null;
          email_signature?: string | null;
          email_include_tracking?: boolean;
          email_include_logo?: boolean;
          agent_enabled?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };

      brand_shopify_geo: {
        Row: {
          id: string;
          brand_id: string;
          city: string | null;
          state: string | null;
          country: string | null;
          sessions: number | null;
          orders: number | null;
          revenue: number | null;
          conversion_rate: number | null;
          population_weight: number | null;
          category_relevance: number | null;
          gap_score: number | null;
          problem_type: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          sessions?: number | null;
          orders?: number | null;
          revenue?: number | null;
          conversion_rate?: number | null;
          population_weight?: number | null;
          category_relevance?: number | null;
          gap_score?: number | null;
          problem_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          sessions?: number | null;
          orders?: number | null;
          revenue?: number | null;
          conversion_rate?: number | null;
          population_weight?: number | null;
          category_relevance?: number | null;
          gap_score?: number | null;
          problem_type?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      campaigns: {
        Row: {
          id: string;
          brand_id: string;
          name: string;
          description: string | null;
          goal: Database["public"]["Enums"]["campaign_goal"] | null;
          status: string;
          total_budget: number | null;
          budget_per_creator: number | null;
          currency: string | null;
          target_regions: string[] | null;
          target_niches: string[] | null;
          target_tiers: Database["public"]["Enums"]["creator_tier"][] | null;
          content_format: Database["public"]["Enums"]["content_format"] | null;
          min_followers: number | null;
          max_followers: number | null;
          start_date: string | null;
          end_date: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          name: string;
          description?: string | null;
          goal?: Database["public"]["Enums"]["campaign_goal"] | null;
          status?: string;
          total_budget?: number | null;
          budget_per_creator?: number | null;
          currency?: string | null;
          target_regions?: string[] | null;
          target_niches?: string[] | null;
          target_tiers?: Database["public"]["Enums"]["creator_tier"][] | null;
          content_format?: Database["public"]["Enums"]["content_format"] | null;
          min_followers?: number | null;
          max_followers?: number | null;
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          name?: string;
          description?: string | null;
          goal?: Database["public"]["Enums"]["campaign_goal"] | null;
          status?: string;
          total_budget?: number | null;
          budget_per_creator?: number | null;
          currency?: string | null;
          target_regions?: string[] | null;
          target_niches?: string[] | null;
          target_tiers?: Database["public"]["Enums"]["creator_tier"][] | null;
          content_format?: Database["public"]["Enums"]["content_format"] | null;
          min_followers?: number | null;
          max_followers?: number | null;
          start_date?: string | null;
          end_date?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      campaign_creators: {
        Row: {
          id: string;
          campaign_id: string;
          creator_id: string;
          status: string;
          match_score_at_assignment: number | null;
          agreed_rate: number | null;
          content_deliverables: string[] | null;
          posts_delivered: number | null;
          assigned_at: string;
          confirmed_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          creator_id: string;
          status?: string;
          match_score_at_assignment?: number | null;
          agreed_rate?: number | null;
          content_deliverables?: string[] | null;
          posts_delivered?: number | null;
          assigned_at?: string;
          confirmed_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          campaign_id?: string;
          creator_id?: string;
          status?: string;
          match_score_at_assignment?: number | null;
          agreed_rate?: number | null;
          content_deliverables?: string[] | null;
          posts_delivered?: number | null;
          assigned_at?: string;
          confirmed_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      creator_brand_matches: {
        Row: {
          id: string;
          creator_id: string;
          brand_id: string;
          match_score: number | null;
          niche_fit_score: number | null;
          audience_geo_score: number | null;
          price_tier_score: number | null;
          engagement_score: number | null;
          brand_safety_score: number | null;
          content_style_score: number | null;
          already_mentions_brand: boolean | null;
          mentions_competitor: boolean | null;
          geo_match_regions: Json | null;
          recommended_for: Database["public"]["Enums"]["campaign_goal"] | null;
          match_reasoning: string | null;
          computed_at: string | null;
          algorithm_version: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_id: string;
          brand_id: string;
          match_score?: number | null;
          niche_fit_score?: number | null;
          audience_geo_score?: number | null;
          price_tier_score?: number | null;
          engagement_score?: number | null;
          brand_safety_score?: number | null;
          content_style_score?: number | null;
          already_mentions_brand?: boolean | null;
          mentions_competitor?: boolean | null;
          geo_match_regions?: Json | null;
          recommended_for?: Database["public"]["Enums"]["campaign_goal"] | null;
          match_reasoning?: string | null;
          computed_at?: string | null;
          algorithm_version?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          creator_id?: string;
          brand_id?: string;
          match_score?: number | null;
          niche_fit_score?: number | null;
          audience_geo_score?: number | null;
          price_tier_score?: number | null;
          engagement_score?: number | null;
          brand_safety_score?: number | null;
          content_style_score?: number | null;
          already_mentions_brand?: boolean | null;
          mentions_competitor?: boolean | null;
          geo_match_regions?: Json | null;
          recommended_for?: Database["public"]["Enums"]["campaign_goal"] | null;
          match_reasoning?: string | null;
          computed_at?: string | null;
          algorithm_version?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      creator_lists: {
        Row: {
          id: string;
          brand_id: string;
          name: string;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          name: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          name?: string;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      creator_list_items: {
        Row: {
          id: string;
          list_id: string;
          creator_id: string;
          added_at: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          list_id: string;
          creator_id: string;
          added_at?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          list_id?: string;
          creator_id?: string;
          added_at?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      campaign_utm_links: {
        Row: {
          id: string;
          brand_id: string;
          campaign_id: string | null;
          creator_id: string | null;
          campaign_creator_id: string | null;
          utm_source: string | null;
          utm_medium: string | null;
          utm_campaign: string | null;
          full_url: string | null;
          clicks: number;
          orders_attributed: number;
          revenue_attributed: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          campaign_id?: string | null;
          creator_id?: string | null;
          campaign_creator_id?: string | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          full_url?: string | null;
          clicks?: number;
          orders_attributed?: number;
          revenue_attributed?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          campaign_id?: string | null;
          creator_id?: string | null;
          campaign_creator_id?: string | null;
          utm_source?: string | null;
          utm_medium?: string | null;
          utm_campaign?: string | null;
          full_url?: string | null;
          clicks?: number;
          orders_attributed?: number;
          revenue_attributed?: number;
          created_at?: string;
          updated_at?: string;
        };
      };

      audience_overlaps: {
        Row: {
          id: string;
          creator_a_id: string;
          creator_b_id: string;
          shared_commenters: number | null;
          jaccard_similarity: number | null;
          overlap_coefficient: number | null;
          overlap_level: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          creator_a_id: string;
          creator_b_id: string;
          shared_commenters?: number | null;
          jaccard_similarity?: number | null;
          overlap_coefficient?: number | null;
          overlap_level?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          creator_a_id?: string;
          creator_b_id?: string;
          shared_commenters?: number | null;
          jaccard_similarity?: number | null;
          overlap_coefficient?: number | null;
          overlap_level?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      /* ── Phase 2: Communication Tables ─────────────────────── */

      outreach_messages: {
        Row: {
          id: string;
          brand_id: string;
          campaign_id: string | null;
          creator_id: string;
          template_id: string | null;
          thread_id: string | null;
          channel: "email" | "whatsapp" | "instagram_dm";
          status: "draft" | "queued" | "sent" | "delivered" | "opened" | "replied" | "bounced" | "failed";
          subject: string | null;
          body: string;
          recipient_email: string | null;
          from_email: string | null;
          resend_message_id: string | null;
          gmail_thread_id: string | null;
          parent_message_id: string | null;
          followup_number: number;
          open_count: number;
          sender_name: string | null;
          drafted_by: "human" | "agent";
          opened_at: string | null;
          replied_at: string | null;
          sent_at: string | null;
          delivered_at: string | null;
          bounced_at: string | null;
          failed_at: string | null;
          queued_at: string | null;
          error_message: string | null;
          metadata: Record<string, unknown>;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          campaign_id?: string | null;
          creator_id: string;
          template_id?: string | null;
          thread_id?: string | null;
          channel?: "email" | "whatsapp" | "instagram_dm";
          status?: "draft" | "queued" | "sent" | "delivered" | "opened" | "replied" | "bounced" | "failed";
          subject?: string | null;
          body: string;
          recipient_email?: string | null;
          from_email?: string | null;
          resend_message_id?: string | null;
          gmail_thread_id?: string | null;
          parent_message_id?: string | null;
          followup_number?: number;
          open_count?: number;
          sender_name?: string | null;
          drafted_by?: "human" | "agent";
          opened_at?: string | null;
          replied_at?: string | null;
          sent_at?: string | null;
          delivered_at?: string | null;
          bounced_at?: string | null;
          failed_at?: string | null;
          queued_at?: string | null;
          error_message?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          campaign_id?: string | null;
          creator_id?: string;
          template_id?: string | null;
          thread_id?: string | null;
          channel?: "email" | "whatsapp" | "instagram_dm";
          status?: "draft" | "queued" | "sent" | "delivered" | "opened" | "replied" | "bounced" | "failed";
          subject?: string | null;
          body?: string;
          recipient_email?: string | null;
          from_email?: string | null;
          resend_message_id?: string | null;
          gmail_thread_id?: string | null;
          parent_message_id?: string | null;
          followup_number?: number;
          open_count?: number;
          sender_name?: string | null;
          drafted_by?: "human" | "agent";
          opened_at?: string | null;
          replied_at?: string | null;
          sent_at?: string | null;
          delivered_at?: string | null;
          bounced_at?: string | null;
          failed_at?: string | null;
          queued_at?: string | null;
          error_message?: string | null;
          metadata?: Record<string, unknown>;
          created_at?: string;
          updated_at?: string;
        };
      };

      outreach_templates: {
        Row: {
          id: string;
          brand_id: string;
          name: string;
          channel: "email" | "whatsapp" | "instagram_dm";
          category: string | null;
          subject: string | null;
          body: string;
          followup_enabled: boolean;
          followup_days: number;
          followup_subject: string | null;
          followup_body: string | null;
          max_followups: number;
          is_default: boolean;
          times_used: number;
          avg_response_rate: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          name: string;
          channel?: "email" | "whatsapp" | "instagram_dm";
          category?: string | null;
          subject?: string | null;
          body: string;
          followup_enabled?: boolean;
          followup_days?: number;
          followup_subject?: string | null;
          followup_body?: string | null;
          max_followups?: number;
          is_default?: boolean;
          times_used?: number;
          avg_response_rate?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          name?: string;
          channel?: "email" | "whatsapp" | "instagram_dm";
          category?: string | null;
          subject?: string | null;
          body?: string;
          followup_enabled?: boolean;
          followup_days?: number;
          followup_subject?: string | null;
          followup_body?: string | null;
          max_followups?: number;
          is_default?: boolean;
          times_used?: number;
          avg_response_rate?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      outreach_replies: {
        Row: {
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
        };
        Insert: {
          id?: string;
          brand_id: string;
          outreach_message_id: string;
          resend_message_id?: string | null;
          from_email?: string | null;
          to_email?: string | null;
          subject?: string | null;
          text_content?: string | null;
          html_content?: string | null;
          raw_payload?: Record<string, unknown>;
          received_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          outreach_message_id?: string;
          resend_message_id?: string | null;
          from_email?: string | null;
          to_email?: string | null;
          subject?: string | null;
          text_content?: string | null;
          html_content?: string | null;
          raw_payload?: Record<string, unknown>;
          received_at?: string;
          created_at?: string;
        };
      };

      message_threads: {
        Row: {
          id: string;
          brand_id: string;
          creator_id: string;
          subject: string | null;
          last_message_at: string | null;
          last_message_preview: string | null;
          last_message_direction: "outbound" | "inbound" | null;
          unread_count: number;
          status: "active" | "archived" | "snoozed";
          snooze_until: string | null;
          campaign_id: string | null;
          outreach_status: "none" | "draft" | "sent" | "opened" | "replied" | "negotiating" | "confirmed" | "declined" | "follow_up_scheduled";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          creator_id: string;
          subject?: string | null;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          last_message_direction?: "outbound" | "inbound" | null;
          unread_count?: number;
          status?: "active" | "archived" | "snoozed";
          snooze_until?: string | null;
          campaign_id?: string | null;
          outreach_status?: "none" | "draft" | "sent" | "opened" | "replied" | "negotiating" | "confirmed" | "declined" | "follow_up_scheduled";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          creator_id?: string;
          subject?: string | null;
          last_message_at?: string | null;
          last_message_preview?: string | null;
          last_message_direction?: "outbound" | "inbound" | null;
          unread_count?: number;
          status?: "active" | "archived" | "snoozed";
          snooze_until?: string | null;
          campaign_id?: string | null;
          outreach_status?: "none" | "draft" | "sent" | "opened" | "replied" | "negotiating" | "confirmed" | "declined" | "follow_up_scheduled";
          created_at?: string;
          updated_at?: string;
        };
      };

      notifications: {
        Row: {
          id: string;
          brand_id: string;
          type: string;
          title: string;
          body: string | null;
          priority: "low" | "medium" | "high";
          read: boolean;
          thread_id: string | null;
          campaign_id: string | null;
          creator_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          type: string;
          title: string;
          body?: string | null;
          priority?: "low" | "medium" | "high";
          read?: boolean;
          thread_id?: string | null;
          campaign_id?: string | null;
          creator_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          type?: string;
          title?: string;
          body?: string | null;
          priority?: "low" | "medium" | "high";
          read?: boolean;
          thread_id?: string | null;
          campaign_id?: string | null;
          creator_id?: string | null;
          created_at?: string;
        };
      };

      creator_unsubscribes: {
        Row: {
          id: string;
          brand_id: string;
          creator_id: string;
          unsubscribed_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          creator_id: string;
          unsubscribed_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          creator_id?: string;
          unsubscribed_at?: string;
        };
      };

      /* ── Phase 4: Agent Core tables ──────────────────────────── */

      agent_config: {
        Row: {
          id: string;
          brand_id: string;
          soul_md: string | null;
          brand_md: string | null;
          autonomy_level: "supervised" | "semi_auto" | "auto";
          can_search_creators: boolean;
          can_draft_outreach: boolean;
          can_send_outreach: boolean;
          can_manage_campaigns: boolean;
          can_negotiate: boolean;
          can_track_performance: boolean;
          can_manage_relationships: boolean;
          can_manage_budget: boolean;
          can_scan_content: boolean;
          can_generate_reports: boolean;
          action_autonomy: Json | null;
          budget_auto_threshold: number | null;
          model_provider: string;
          model_name: string;
          temperature: number;
          max_tokens: number;
          daily_message_limit: number;
          messages_today: number;
          limit_reset_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          soul_md?: string | null;
          brand_md?: string | null;
          autonomy_level?: "supervised" | "semi_auto" | "auto";
          can_search_creators?: boolean;
          can_draft_outreach?: boolean;
          can_send_outreach?: boolean;
          can_manage_campaigns?: boolean;
          can_negotiate?: boolean;
          can_track_performance?: boolean;
          can_manage_relationships?: boolean;
          can_manage_budget?: boolean;
          can_scan_content?: boolean;
          can_generate_reports?: boolean;
          action_autonomy?: Json | null;
          budget_auto_threshold?: number | null;
          model_provider?: string;
          model_name?: string;
          temperature?: number;
          max_tokens?: number;
          daily_message_limit?: number;
          messages_today?: number;
          limit_reset_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          soul_md?: string | null;
          brand_md?: string | null;
          autonomy_level?: "supervised" | "semi_auto" | "auto";
          can_search_creators?: boolean;
          can_draft_outreach?: boolean;
          can_send_outreach?: boolean;
          can_manage_campaigns?: boolean;
          can_negotiate?: boolean;
          can_track_performance?: boolean;
          can_manage_relationships?: boolean;
          can_manage_budget?: boolean;
          can_scan_content?: boolean;
          can_generate_reports?: boolean;
          action_autonomy?: Json | null;
          budget_auto_threshold?: number | null;
          model_provider?: string;
          model_name?: string;
          temperature?: number;
          max_tokens?: number;
          daily_message_limit?: number;
          messages_today?: number;
          limit_reset_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      agent_conversations: {
        Row: {
          id: string;
          brand_id: string;
          role: "user" | "assistant" | "system" | "tool";
          content: string;
          tool_calls: Json | null;
          tool_call_id: string | null;
          page_context: string | null;
          page_data: Json | null;
          token_count: number | null;
          model_used: string | null;
          latency_ms: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          role: "user" | "assistant" | "system" | "tool";
          content: string;
          tool_calls?: Json | null;
          tool_call_id?: string | null;
          page_context?: string | null;
          page_data?: Json | null;
          token_count?: number | null;
          model_used?: string | null;
          latency_ms?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          role?: "user" | "assistant" | "system" | "tool";
          content?: string;
          tool_calls?: Json | null;
          tool_call_id?: string | null;
          page_context?: string | null;
          page_data?: Json | null;
          token_count?: number | null;
          model_used?: string | null;
          latency_ms?: number | null;
          created_at?: string;
        };
      };

      agent_episodes: {
        Row: {
          id: string;
          brand_id: string;
          episode_type: string;
          summary: string;
          details: Json;
          creator_id: string | null;
          campaign_id: string | null;
          outcome: "positive" | "negative" | "neutral" | "pending" | null;
          embedding: number[] | null;
          conversation_msg_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          episode_type: string;
          summary: string;
          details?: Json;
          creator_id?: string | null;
          campaign_id?: string | null;
          outcome?: "positive" | "negative" | "neutral" | "pending" | null;
          embedding?: number[] | null;
          conversation_msg_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          episode_type?: string;
          summary?: string;
          details?: Json;
          creator_id?: string | null;
          campaign_id?: string | null;
          outcome?: "positive" | "negative" | "neutral" | "pending" | null;
          embedding?: number[] | null;
          conversation_msg_id?: string | null;
          created_at?: string;
        };
      };

      approval_queue: {
        Row: {
          id: string;
          brand_id: string;
          action_type: string;
          status: "pending" | "approved" | "rejected" | "expired" | "auto_approved";
          payload: Json;
          title: string;
          description: string | null;
          reasoning: string | null;
          creator_id: string | null;
          campaign_id: string | null;
          message_id: string | null;
          approved_by: string | null;
          approved_at: string | null;
          rejected_reason: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          action_type: string;
          status?: "pending" | "approved" | "rejected" | "expired" | "auto_approved";
          payload: Json;
          title: string;
          description?: string | null;
          reasoning?: string | null;
          creator_id?: string | null;
          campaign_id?: string | null;
          message_id?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          rejected_reason?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          brand_id?: string;
          action_type?: string;
          status?: "pending" | "approved" | "rejected" | "expired" | "auto_approved";
          payload?: Json;
          title?: string;
          description?: string | null;
          reasoning?: string | null;
          creator_id?: string | null;
          campaign_id?: string | null;
          message_id?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          rejected_reason?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };

      /* ── Phase 5: Agent Intelligence tables ───────────────────── */

      agent_knowledge: {
        Row: {
          id: string;
          brand_id: string;
          knowledge_type: string;
          fact: string;
          details: Json;
          confidence: number;
          evidence_count: number;
          reinforced_count: number;
          contradicted_count: number;
          last_reinforced_at: string | null;
          last_contradicted_at: string | null;
          decay_rate: number;
          source_episode_ids: string[];
          source_campaign_ids: string[];
          embedding: number[] | null;
          is_active: boolean;
          superseded_by: string | null;
          expires_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          brand_id: string;
          knowledge_type: string;
          fact: string;
          details?: Json;
          confidence?: number;
          evidence_count?: number;
          reinforced_count?: number;
          contradicted_count?: number;
          last_reinforced_at?: string | null;
          last_contradicted_at?: string | null;
          decay_rate?: number;
          source_episode_ids?: string[];
          source_campaign_ids?: string[];
          embedding?: number[] | null;
          is_active?: boolean;
          superseded_by?: string | null;
          expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          confidence?: number;
          evidence_count?: number;
          reinforced_count?: number;
          contradicted_count?: number;
          last_reinforced_at?: string | null;
          last_contradicted_at?: string | null;
          source_episode_ids?: string[];
          source_campaign_ids?: string[];
          embedding?: number[] | null;
          is_active?: boolean;
          superseded_by?: string | null;
          details?: Json;
          fact?: string;
          updated_at?: string;
        };
      };

      negotiations: {
        Row: {
          id: string;
          campaign_creator_id: string;
          campaign_id: string;
          brand_id: string;
          creator_id: string;
          round_number: number;
          brand_offer: number | null;
          creator_ask: number | null;
          agent_recommended: number | null;
          market_median: number | null;
          creator_cpi_percentile: number | null;
          sponsored_er_delta: number | null;
          action_taken: string;
          counter_amount: number | null;
          justification: string | null;
          status: string;
          created_at: string;
          resolved_at: string | null;
        };
        Insert: {
          id?: string;
          campaign_creator_id: string;
          campaign_id: string;
          brand_id: string;
          creator_id: string;
          round_number?: number;
          brand_offer?: number | null;
          creator_ask?: number | null;
          agent_recommended?: number | null;
          market_median?: number | null;
          creator_cpi_percentile?: number | null;
          sponsored_er_delta?: number | null;
          action_taken?: string;
          counter_amount?: number | null;
          justification?: string | null;
          status?: string;
          created_at?: string;
          resolved_at?: string | null;
        };
        Update: {
          action_taken?: string;
          counter_amount?: number | null;
          justification?: string | null;
          status?: string;
          resolved_at?: string | null;
        };
      };

      deal_memos: {
        Row: {
          id: string;
          campaign_creator_id: string;
          campaign_id: string;
          brand_id: string;
          creator_id: string;
          agreed_rate: number;
          content_deliverables: Json;
          usage_rights: string | null;
          exclusivity_period: string | null;
          payment_terms: string | null;
          special_notes: string | null;
          negotiation_rounds: number;
          generated_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          campaign_creator_id: string;
          campaign_id: string;
          brand_id: string;
          creator_id: string;
          agreed_rate: number;
          content_deliverables?: Json;
          usage_rights?: string | null;
          exclusivity_period?: string | null;
          payment_terms?: string | null;
          special_notes?: string | null;
          negotiation_rounds?: number;
          generated_by?: string;
          created_at?: string;
        };
        Update: {
          agreed_rate?: number;
          content_deliverables?: Json;
          usage_rights?: string | null;
          exclusivity_period?: string | null;
          payment_terms?: string | null;
          special_notes?: string | null;
        };
      };

      compliance_scans: {
        Row: {
          id: string;
          content_submission_id: string;
          campaign_id: string;
          brand_id: string;
          has_ad_disclosure: boolean | null;
          ad_disclosure_detail: string | null;
          has_brand_mention: boolean | null;
          brand_mention_detail: string | null;
          has_product_visibility: boolean | null;
          product_visibility_detail: string | null;
          has_discount_code: boolean | null;
          discount_code_detail: string | null;
          has_spoken_brand_mention: boolean | null;
          spoken_mention_detail: string | null;
          transcription_text: string | null;
          brief_requirements_met: Json;
          overall_pass: boolean;
          issues_found: string[];
          revision_draft: string | null;
          scan_model: string;
          scanned_at: string;
        };
        Insert: {
          id?: string;
          content_submission_id: string;
          campaign_id: string;
          brand_id: string;
          has_ad_disclosure?: boolean | null;
          ad_disclosure_detail?: string | null;
          has_brand_mention?: boolean | null;
          brand_mention_detail?: string | null;
          has_product_visibility?: boolean | null;
          product_visibility_detail?: string | null;
          has_discount_code?: boolean | null;
          discount_code_detail?: string | null;
          has_spoken_brand_mention?: boolean | null;
          spoken_mention_detail?: string | null;
          transcription_text?: string | null;
          brief_requirements_met?: Json;
          overall_pass?: boolean;
          issues_found?: string[];
          revision_draft?: string | null;
          scan_model?: string;
          scanned_at?: string;
        };
        Update: {
          has_ad_disclosure?: boolean | null;
          has_brand_mention?: boolean | null;
          has_product_visibility?: boolean | null;
          has_discount_code?: boolean | null;
          has_spoken_brand_mention?: boolean | null;
          transcription_text?: string | null;
          brief_requirements_met?: Json;
          overall_pass?: boolean;
          issues_found?: string[];
          revision_draft?: string | null;
        };
      };

      campaign_reports: {
        Row: {
          id: string;
          campaign_id: string;
          brand_id: string;
          report_type: string;
          executive_summary: Json;
          per_creator_breakdown: Json;
          geographic_impact: Json | null;
          top_content_analysis: Json | null;
          recommendations: Json;
          markdown_content: string | null;
          generated_at: string;
          model_used: string;
        };
        Insert: {
          id?: string;
          campaign_id: string;
          brand_id: string;
          report_type?: string;
          executive_summary: Json;
          per_creator_breakdown: Json;
          geographic_impact?: Json | null;
          top_content_analysis?: Json | null;
          recommendations: Json;
          markdown_content?: string | null;
          generated_at?: string;
          model_used?: string;
        };
        Update: {
          executive_summary?: Json;
          per_creator_breakdown?: Json;
          geographic_impact?: Json | null;
          top_content_analysis?: Json | null;
          recommendations?: Json;
          markdown_content?: string | null;
        };
      };
    };

    Views: {
      mv_creator_leaderboard: {
        Row: {
          creator_id: string | null;
          handle: string | null;
          display_name: string | null;
          avatar_url: string | null;
          category: string | null;
          city: string | null;
          country: string | null;
          is_verified: boolean | null;
          followers: number | null;
          tier: Database["public"]["Enums"]["creator_tier"] | null;
          is_active: boolean | null;
          cpi: number | null;
          engagement_quality: number | null;
          content_quality: number | null;
          audience_authenticity: number | null;
          avg_engagement_rate: number | null;
          engagement_trend: Database["public"]["Enums"]["trend_direction"] | null;
          posts_per_week: number | null;
          primary_niche: string | null;
          primary_tone: Database["public"]["Enums"]["content_tone"] | null;
          primary_language: string | null;
          primary_audience_language: string | null;
          primary_country: string | null;
          authenticity_score: number | null;
          engagement_quality_score: number | null;
          community_strength: number | null;
        };
      };
    };

    Functions: {
      fn_search_creators: {
        Args: {
          p_query?: string;
          p_niche?: string;
          p_min_followers?: number;
          p_max_followers?: number;
          p_min_cpi?: number;
          p_tier?: Database["public"]["Enums"]["creator_tier"];
          p_city?: string;
          p_country?: string;
          p_language?: string;
          p_limit?: number;
          p_offset?: number;
        };
        Returns: {
          id: string;
          handle: string;
          display_name: string | null;
          avatar_url: string | null;
          biography: string | null;
          followers: number | null;
          tier: Database["public"]["Enums"]["creator_tier"] | null;
          cpi: number | null;
          primary_niche: string | null;
          primary_tone: Database["public"]["Enums"]["content_tone"] | null;
          avg_engagement_rate: number | null;
          city: string | null;
          country: string | null;
          audience_country: string | null;
          primary_spoken_language: string | null;
          is_verified: boolean | null;
          total_count: number;
        }[];
      };
    };

    Enums: {
      creator_tier: "nano" | "micro" | "mid" | "macro" | "mega";
      content_type: "Image" | "Video" | "Carousel";
      trend_direction:
        | "growing"
        | "stable"
        | "declining"
        | "insufficient_data";
      content_tone:
        | "casual"
        | "professional"
        | "funny"
        | "emotional"
        | "educational"
        | "inspirational"
        | "sarcastic"
        | "raw"
        | "polished";
      campaign_goal: "awareness" | "conversion" | "ugc_generation";
      content_format: "reels" | "static" | "carousel" | "any";
    };

    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

/* ------------------------------------------------------------------ */
/*  Convenience type aliases                                           */
/* ------------------------------------------------------------------ */

export type Creator = Database["public"]["Tables"]["creators"]["Row"];
export type CreatorInsert = Database["public"]["Tables"]["creators"]["Insert"];
export type CreatorUpdate = Database["public"]["Tables"]["creators"]["Update"];

export type Post = Database["public"]["Tables"]["posts"]["Row"];
export type PostInsert = Database["public"]["Tables"]["posts"]["Insert"];
export type PostUpdate = Database["public"]["Tables"]["posts"]["Update"];

export type CreatorScore = Database["public"]["Tables"]["creator_scores"]["Row"];
export type CreatorScoreInsert = Database["public"]["Tables"]["creator_scores"]["Insert"];
export type CreatorScoreUpdate = Database["public"]["Tables"]["creator_scores"]["Update"];

export type CaptionIntelligence = Database["public"]["Tables"]["caption_intelligence"]["Row"];
export type CaptionIntelligenceInsert = Database["public"]["Tables"]["caption_intelligence"]["Insert"];
export type CaptionIntelligenceUpdate = Database["public"]["Tables"]["caption_intelligence"]["Update"];

export type TranscriptIntelligence = Database["public"]["Tables"]["transcript_intelligence"]["Row"];
export type TranscriptIntelligenceInsert = Database["public"]["Tables"]["transcript_intelligence"]["Insert"];
export type TranscriptIntelligenceUpdate = Database["public"]["Tables"]["transcript_intelligence"]["Update"];

export type AudienceIntelligence = Database["public"]["Tables"]["audience_intelligence"]["Row"];
export type AudienceIntelligenceInsert = Database["public"]["Tables"]["audience_intelligence"]["Insert"];
export type AudienceIntelligenceUpdate = Database["public"]["Tables"]["audience_intelligence"]["Update"];

export type Brand = Database["public"]["Tables"]["brands"]["Row"];
export type BrandInsert = Database["public"]["Tables"]["brands"]["Insert"];
export type BrandUpdate = Database["public"]["Tables"]["brands"]["Update"];

export type BrandShopifyGeo = Database["public"]["Tables"]["brand_shopify_geo"]["Row"];
export type BrandShopifyGeoInsert = Database["public"]["Tables"]["brand_shopify_geo"]["Insert"];
export type BrandShopifyGeoUpdate = Database["public"]["Tables"]["brand_shopify_geo"]["Update"];

export type Campaign = Database["public"]["Tables"]["campaigns"]["Row"];
export type CampaignInsert = Database["public"]["Tables"]["campaigns"]["Insert"];
export type CampaignUpdate = Database["public"]["Tables"]["campaigns"]["Update"];

export type CampaignCreator = Database["public"]["Tables"]["campaign_creators"]["Row"];
export type CampaignCreatorInsert = Database["public"]["Tables"]["campaign_creators"]["Insert"];
export type CampaignCreatorUpdate = Database["public"]["Tables"]["campaign_creators"]["Update"];

export type CreatorBrandMatch = Database["public"]["Tables"]["creator_brand_matches"]["Row"];
export type CreatorBrandMatchInsert = Database["public"]["Tables"]["creator_brand_matches"]["Insert"];
export type CreatorBrandMatchUpdate = Database["public"]["Tables"]["creator_brand_matches"]["Update"];

export type CreatorList = Database["public"]["Tables"]["creator_lists"]["Row"];
export type CreatorListInsert = Database["public"]["Tables"]["creator_lists"]["Insert"];
export type CreatorListUpdate = Database["public"]["Tables"]["creator_lists"]["Update"];

export type CreatorListItem = Database["public"]["Tables"]["creator_list_items"]["Row"];
export type CreatorListItemInsert = Database["public"]["Tables"]["creator_list_items"]["Insert"];
export type CreatorListItemUpdate = Database["public"]["Tables"]["creator_list_items"]["Update"];

export type CampaignUtmLink = Database["public"]["Tables"]["campaign_utm_links"]["Row"];
export type CampaignUtmLinkInsert = Database["public"]["Tables"]["campaign_utm_links"]["Insert"];
export type CampaignUtmLinkUpdate = Database["public"]["Tables"]["campaign_utm_links"]["Update"];

export type AudienceOverlap = Database["public"]["Tables"]["audience_overlaps"]["Row"];
export type AudienceOverlapInsert = Database["public"]["Tables"]["audience_overlaps"]["Insert"];
export type AudienceOverlapUpdate = Database["public"]["Tables"]["audience_overlaps"]["Update"];

export type CreatorLeaderboard = Database["public"]["Views"]["mv_creator_leaderboard"]["Row"];

/* ── Phase 2: Communication types ─────────────────────────────── */

export type OutreachMessage = Database["public"]["Tables"]["outreach_messages"]["Row"];
export type OutreachMessageInsert = Database["public"]["Tables"]["outreach_messages"]["Insert"];
export type OutreachMessageUpdate = Database["public"]["Tables"]["outreach_messages"]["Update"];

export type OutreachTemplate = Database["public"]["Tables"]["outreach_templates"]["Row"];
export type OutreachTemplateInsert = Database["public"]["Tables"]["outreach_templates"]["Insert"];
export type OutreachTemplateUpdate = Database["public"]["Tables"]["outreach_templates"]["Update"];

export type OutreachReply = Database["public"]["Tables"]["outreach_replies"]["Row"];
export type OutreachReplyInsert = Database["public"]["Tables"]["outreach_replies"]["Insert"];
export type OutreachReplyUpdate = Database["public"]["Tables"]["outreach_replies"]["Update"];

export type MessageThread = Database["public"]["Tables"]["message_threads"]["Row"];
export type MessageThreadInsert = Database["public"]["Tables"]["message_threads"]["Insert"];
export type MessageThreadUpdate = Database["public"]["Tables"]["message_threads"]["Update"];

export type Notification = Database["public"]["Tables"]["notifications"]["Row"];
export type NotificationInsert = Database["public"]["Tables"]["notifications"]["Insert"];
export type NotificationUpdate = Database["public"]["Tables"]["notifications"]["Update"];

export type CreatorUnsubscribe = Database["public"]["Tables"]["creator_unsubscribes"]["Row"];
export type CreatorUnsubscribeInsert = Database["public"]["Tables"]["creator_unsubscribes"]["Insert"];

/* ── Phase 4: Agent Core types ─────────────────────────────────── */

export type AgentConfig = Database["public"]["Tables"]["agent_config"]["Row"];
export type AgentConfigInsert = Database["public"]["Tables"]["agent_config"]["Insert"];
export type AgentConfigUpdate = Database["public"]["Tables"]["agent_config"]["Update"];

export type AgentConversation = Database["public"]["Tables"]["agent_conversations"]["Row"];
export type AgentConversationInsert = Database["public"]["Tables"]["agent_conversations"]["Insert"];

export type AgentEpisode = Database["public"]["Tables"]["agent_episodes"]["Row"];
export type AgentEpisodeInsert = Database["public"]["Tables"]["agent_episodes"]["Insert"];

export type ApprovalQueueItem = Database["public"]["Tables"]["approval_queue"]["Row"];
export type ApprovalQueueItemInsert = Database["public"]["Tables"]["approval_queue"]["Insert"];
export type ApprovalQueueItemUpdate = Database["public"]["Tables"]["approval_queue"]["Update"];

/* ── Phase 5: Agent Intelligence types ─────────────────────────── */

export type AgentKnowledge = Database["public"]["Tables"]["agent_knowledge"]["Row"];
export type AgentKnowledgeInsert = Database["public"]["Tables"]["agent_knowledge"]["Insert"];
export type AgentKnowledgeUpdate = Database["public"]["Tables"]["agent_knowledge"]["Update"];

export type Negotiation = Database["public"]["Tables"]["negotiations"]["Row"];
export type NegotiationInsert = Database["public"]["Tables"]["negotiations"]["Insert"];
export type NegotiationUpdate = Database["public"]["Tables"]["negotiations"]["Update"];

export type DealMemo = Database["public"]["Tables"]["deal_memos"]["Row"];
export type DealMemoInsert = Database["public"]["Tables"]["deal_memos"]["Insert"];

export type ComplianceScan = Database["public"]["Tables"]["compliance_scans"]["Row"];
export type ComplianceScanInsert = Database["public"]["Tables"]["compliance_scans"]["Insert"];

export type CampaignReport = Database["public"]["Tables"]["campaign_reports"]["Row"];
export type CampaignReportInsert = Database["public"]["Tables"]["campaign_reports"]["Insert"];

/* ------------------------------------------------------------------ */
/*  Enum type aliases                                                  */
/* ------------------------------------------------------------------ */

export type CreatorTier = Database["public"]["Enums"]["creator_tier"];
export type ContentType = Database["public"]["Enums"]["content_type"];
export type TrendDirection = Database["public"]["Enums"]["trend_direction"];
export type ContentTone = Database["public"]["Enums"]["content_tone"];
export type CampaignGoal = Database["public"]["Enums"]["campaign_goal"];
export type ContentFormat = Database["public"]["Enums"]["content_format"];
