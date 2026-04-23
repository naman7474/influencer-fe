import {
  Target,
  Megaphone,
  Video,
} from "lucide-react";
import type { Database } from "@/lib/types/database";

/* ------------------------------------------------------------------ */
/*  Database enum aliases                                              */
/* ------------------------------------------------------------------ */

export type CampaignGoal = Database["public"]["Enums"]["campaign_goal"];
export type ContentFormat = Database["public"]["Enums"]["content_format"];
export type CreatorTier = Database["public"]["Enums"]["creator_tier"];

/* ------------------------------------------------------------------ */
/*  Wizard state                                                       */
/* ------------------------------------------------------------------ */

export interface WizardState {
  name: string;
  description: string;
  goal: CampaignGoal;
  totalBudget: string;
  budgetPerCreatorMin: string;
  budgetPerCreatorMax: string;
  targetRegions: string[];
  targetNiches: string[];
  creatorTiers: CreatorTier[];
  contentFormat: ContentFormat;
  startDate: string;
  endDate: string;
}

export interface SelectedCreator {
  id: string;
  handle: string;
  display_name: string | null;
  avatar_url: string | null;
  followers: number | null;
  tier: string | null;
  matchScore: number | null;
}

export type CreatorSource = "recommendations" | "discovery" | "saved_list";

export const INITIAL_WIZARD_STATE: WizardState = {
  name: "",
  description: "",
  goal: "awareness",
  totalBudget: "",
  budgetPerCreatorMin: "",
  budgetPerCreatorMax: "",
  targetRegions: [],
  targetNiches: [],
  creatorTiers: [],
  contentFormat: "any",
  startDate: "",
  endDate: "",
};

/* ------------------------------------------------------------------ */
/*  Constants — India D2C focused                                      */
/* ------------------------------------------------------------------ */

export const GOAL_OPTIONS: { value: CampaignGoal; label: string; description: string; icon: typeof Target }[] = [
  {
    value: "awareness",
    label: "Brand Awareness",
    description: "Introduce your brand to new audiences",
    icon: Megaphone,
  },
  {
    value: "conversion",
    label: "Sales & Conversions",
    description: "Drive purchases via discount codes & affiliate links",
    icon: Target,
  },
  {
    value: "ugc_generation",
    label: "UGC Generation",
    description: "Collect authentic content for ads & social proof",
    icon: Video,
  },
];

export const FORMAT_OPTIONS: { value: ContentFormat; label: string; description: string }[] = [
  { value: "reels", label: "Reels", description: "Short-form video content" },
  { value: "static", label: "Static Posts", description: "Photo posts on feed" },
  { value: "carousel", label: "Carousel", description: "Multi-image swipe posts" },
  { value: "any", label: "Any Format", description: "Let creators choose" },
];

export const TIER_OPTIONS: { value: CreatorTier; label: string; range: string }[] = [
  { value: "nano", label: "Nano", range: "1K–10K" },
  { value: "micro", label: "Micro", range: "10K–50K" },
  { value: "mid", label: "Mid", range: "50K–200K" },
  { value: "macro", label: "Macro", range: "200K–1M" },
  { value: "mega", label: "Mega", range: "1M+" },
];

export const REGION_OPTIONS = [
  "Pan India",
  "Delhi NCR",
  "Mumbai",
  "Bangalore",
  "Hyderabad",
  "Chennai",
  "Kolkata",
  "Pune",
  "Ahmedabad",
  "Jaipur",
  "Maharashtra",
  "Karnataka",
  "Tamil Nadu",
  "Kerala",
  "Uttar Pradesh",
  "Gujarat",
  "Rajasthan",
  "West Bengal",
  "Telangana",
  "Punjab",
];

export const NICHE_OPTIONS = [
  "Beauty",
  "Fashion",
  "Lifestyle",
  "Health",
  "Fitness",
  "Food",
  "Entertainment",
  "Education",
  "Parenting",
  "Tech",
  "Travel",
  "Home & Decor",
];

/* ------------------------------------------------------------------ */
/*  Utilities                                                          */
/* ------------------------------------------------------------------ */

export function toggleMulti<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}
