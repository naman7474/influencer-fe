/* ------------------------------------------------------------------ */
/*  India Geographic Zone System                                       */
/*  Maps states, cities, union territories, and languages to           */
/*  four macro-zones: North, South, East, West                         */
/* ------------------------------------------------------------------ */

export type IndiaZone = "north" | "south" | "east" | "west";

export const ZONE_LABELS: Record<IndiaZone, string> = {
  north: "North India",
  south: "South India",
  east: "East India",
  west: "West India",
};

/* ── State → Zone ─────────────────────────────────────────────────── */

const STATE_ZONE: Record<string, IndiaZone> = {
  // North
  delhi: "north",
  "new delhi": "north",
  "uttar pradesh": "north",
  haryana: "north",
  punjab: "north",
  rajasthan: "north",
  "himachal pradesh": "north",
  uttarakhand: "north",
  "jammu and kashmir": "north",
  "jammu & kashmir": "north",
  ladakh: "north",
  chandigarh: "north",

  // South
  "tamil nadu": "south",
  karnataka: "south",
  kerala: "south",
  "andhra pradesh": "south",
  telangana: "south",
  puducherry: "south",
  pondicherry: "south",
  "lakshadweep": "south",

  // East
  "west bengal": "south", // culturally distinct, but geographically east — override below
  odisha: "east",
  bihar: "east",
  jharkhand: "east",
  assam: "east",
  meghalaya: "east",
  manipur: "east",
  mizoram: "east",
  nagaland: "east",
  tripura: "east",
  "arunachal pradesh": "east",
  sikkim: "east",
  "andaman and nicobar": "east",

  // West
  maharashtra: "west",
  gujarat: "west",
  goa: "west",
  "madhya pradesh": "west",
  chhattisgarh: "west",
  "dadra and nagar haveli": "west",
  "daman and diu": "west",
};

// Fix: West Bengal is East India
STATE_ZONE["west bengal"] = "east";

/* ── Major Cities → Zone ──────────────────────────────────────────── */

const CITY_ZONE: Record<string, IndiaZone> = {
  // North
  delhi: "north",
  "new delhi": "north",
  noida: "north",
  gurgaon: "north",
  gurugram: "north",
  faridabad: "north",
  ghaziabad: "north",
  lucknow: "north",
  kanpur: "north",
  agra: "north",
  varanasi: "north",
  jaipur: "north",
  jodhpur: "north",
  udaipur: "north",
  chandigarh: "north",
  ludhiana: "north",
  amritsar: "north",
  dehradun: "north",
  shimla: "north",
  meerut: "north",
  prayagraj: "north",
  allahabad: "north",

  // South
  bangalore: "south",
  bengaluru: "south",
  chennai: "south",
  hyderabad: "south",
  kochi: "south",
  cochin: "south",
  thiruvananthapuram: "south",
  trivandrum: "south",
  coimbatore: "south",
  madurai: "south",
  mysore: "south",
  mysuru: "south",
  visakhapatnam: "south",
  vizag: "south",
  vijayawada: "south",
  mangalore: "south",
  mangaluru: "south",
  thrissur: "south",
  kozhikode: "south",
  calicut: "south",
  tirupati: "south",
  secunderabad: "south",
  hubli: "south",

  // East
  kolkata: "east",
  calcutta: "east",
  patna: "east",
  ranchi: "east",
  bhubaneswar: "east",
  guwahati: "east",
  siliguri: "east",
  jamshedpur: "east",
  cuttack: "east",
  imphal: "east",
  shillong: "east",
  gangtok: "east",

  // West
  mumbai: "west",
  bombay: "west",
  pune: "west",
  ahmedabad: "west",
  surat: "west",
  nagpur: "west",
  indore: "west",
  bhopal: "west",
  nashik: "west",
  vadodara: "west",
  baroda: "west",
  rajkot: "west",
  thane: "west",
  "navi mumbai": "west",
  aurangabad: "west",
  goa: "west",
  panaji: "west",
  raipur: "west",
};

/* ── Language → Zone ──────────────────────────────────────────────── */

const LANGUAGE_ZONE: Record<string, IndiaZone> = {
  // South Indian languages → strong south signal
  tamil: "south",
  kannada: "south",
  telugu: "south",
  malayalam: "south",
  tulu: "south",

  // East Indian languages
  bengali: "east",
  odia: "east",
  oriya: "east",
  assamese: "east",
  manipuri: "east",
  meitei: "east",

  // West Indian languages
  marathi: "west",
  gujarati: "west",
  konkani: "west",

  // North Indian languages
  punjabi: "north",
  rajasthani: "north",
  haryanvi: "north",
  bhojpuri: "north",
  maithili: "north",
  dogri: "north",
  kashmiri: "north",

  // Hindi is primarily north but spoken pan-India — weaker signal
  hindi: "north",
  hinglish: "north",
};

/* ── Confidence weights for each signal type ─────────────────────── */

const SIGNAL_WEIGHTS = {
  /** Audience geo regions inferred from comments (Gemini) */
  comment_geo: 0.45,
  /** Spoken language from reel transcripts */
  spoken_language: 0.30,
  /** Creator's own profile location */
  creator_location: 0.25,
} as const;

/* ── Public API ───────────────────────────────────────────────────── */

/** Reverse lookup: zone label → zone key */
const LABEL_TO_ZONE: Record<string, IndiaZone> = {
  "north india": "north",
  "south india": "south",
  "east india": "east",
  "west india": "west",
  north: "north",
  south: "south",
  east: "east",
  west: "west",
};

/**
 * Resolve a location string (city, state, zone label, or region name) to an India zone.
 * Returns null if unrecognized or non-Indian.
 */
export function resolveZone(location: string): IndiaZone | null {
  const key = location.toLowerCase().trim();

  // Check zone labels first (e.g., "North India", "south")
  if (LABEL_TO_ZONE[key]) return LABEL_TO_ZONE[key];

  // Try city (more specific)
  if (CITY_ZONE[key]) return CITY_ZONE[key];

  // Then state
  if (STATE_ZONE[key]) return STATE_ZONE[key];

  // Check if the string contains a known city/state
  for (const [city, zone] of Object.entries(CITY_ZONE)) {
    if (key.includes(city)) return zone;
  }
  for (const [state, zone] of Object.entries(STATE_ZONE)) {
    if (key.includes(state)) return zone;
  }

  return null;
}

/**
 * Resolve a spoken language to an India zone.
 * Returns null if the language has no regional association.
 */
export function languageToZone(language: string): IndiaZone | null {
  const key = language.toLowerCase().trim();
  return LANGUAGE_ZONE[key] ?? null;
}

/**
 * Check if a language is Hindi/English (pan-India, weak geo signal).
 */
export function isPanIndiaLanguage(language: string): boolean {
  const key = language.toLowerCase().trim();
  return ["hindi", "hinglish", "english", "urdu"].includes(key);
}

/**
 * Represents a creator's audience zone distribution (0-1 per zone).
 */
export type ZoneProfile = Record<IndiaZone, number>;

export function emptyZoneProfile(): ZoneProfile {
  return { north: 0, south: 0, east: 0, west: 0 };
}

/**
 * Build a creator's zone profile from multiple signals:
 * 1. Comment-inferred geo_regions (array of {region, confidence})
 * 2. Spoken language from transcript analysis
 * 3. Creator's profile location (city/country)
 *
 * Returns a ZoneProfile where values sum to ~1.0.
 */
export function buildCreatorZoneProfile(opts: {
  geoRegions?: unknown;
  spokenLanguage?: string | null;
  creatorCity?: string | null;
  creatorCountry?: string | null;
}): ZoneProfile {
  const profile = emptyZoneProfile();
  let totalWeight = 0;

  // ── Signal 1: Comment-inferred geo regions ──
  const geoZones = resolveGeoRegionsToZones(opts.geoRegions);
  if (Object.keys(geoZones).length > 0) {
    for (const [zone, conf] of Object.entries(geoZones)) {
      profile[zone as IndiaZone] += conf * SIGNAL_WEIGHTS.comment_geo;
    }
    totalWeight += SIGNAL_WEIGHTS.comment_geo;
  }

  // ── Signal 2: Spoken language ──
  if (opts.spokenLanguage) {
    const zone = languageToZone(opts.spokenLanguage);
    if (zone) {
      // Pan-India languages get reduced weight
      const langWeight = isPanIndiaLanguage(opts.spokenLanguage)
        ? SIGNAL_WEIGHTS.spoken_language * 0.3
        : SIGNAL_WEIGHTS.spoken_language;
      profile[zone] += langWeight;
      totalWeight += langWeight;
    }
  }

  // ── Signal 3: Creator's own location ──
  const locZone =
    resolveZone(opts.creatorCity ?? "") ??
    resolveZone(opts.creatorCountry ?? "");
  if (locZone) {
    profile[locZone] += SIGNAL_WEIGHTS.creator_location;
    totalWeight += SIGNAL_WEIGHTS.creator_location;
  }

  // Normalize so values sum to 1.0 (if we have any signal)
  if (totalWeight > 0) {
    for (const zone of Object.keys(profile) as IndiaZone[]) {
      profile[zone] = profile[zone] / totalWeight;
    }
  }

  return profile;
}

/**
 * Convert geo_regions (array or object from audience_intelligence)
 * into zone-level confidence scores.
 */
function resolveGeoRegionsToZones(raw: unknown): Partial<Record<IndiaZone, number>> {
  if (!raw) return {};

  const zoneTotals: Record<IndiaZone, number> = emptyZoneProfile();
  let hasAny = false;

  // Handle array format: [{region, confidence}]
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const region = String(obj.region ?? obj.country ?? "");
        const conf = Number(obj.confidence ?? obj.percentage ?? obj.pct ?? 0);
        const normalizedConf = conf > 1 ? conf / 100 : conf;

        const zone = resolveZone(region);
        if (zone) {
          zoneTotals[zone] += normalizedConf;
          hasAny = true;
        }
      }
    }
  }
  // Handle object format: {"maharashtra": 0.45}
  else if (typeof raw === "object") {
    for (const [region, val] of Object.entries(raw as Record<string, unknown>)) {
      const conf = Number(val ?? 0);
      const normalizedConf = conf > 1 ? conf / 100 : conf;
      const zone = resolveZone(region);
      if (zone) {
        zoneTotals[zone] += normalizedConf;
        hasAny = true;
      }
    }
  }

  if (!hasAny) return {};

  // Normalize so zone values sum to 1.0
  const total = Object.values(zoneTotals).reduce((a, b) => a + b, 0);
  if (total > 0) {
    for (const zone of Object.keys(zoneTotals) as IndiaZone[]) {
      zoneTotals[zone] = zoneTotals[zone] / total;
    }
  }

  return zoneTotals;
}

/**
 * Resolve brand_shopify_geo rows into zone-level opportunity data.
 * Returns opportunity score per zone (higher = more opportunity).
 */
export function buildBrandZoneNeeds(
  geoData: Array<{
    city?: string | null;
    state?: string | null;
    country?: string | null;
    problem_type?: string | null;
    gap_score?: number | null;
    sessions?: number | null;
    orders?: number | null;
  }>,
  targetRegions?: IndiaZone[]
): Record<IndiaZone, { opportunity: number; type: "gap" | "strong" | "target" }> {
  const result: Record<IndiaZone, { opportunity: number; type: "gap" | "strong" | "target" }> = {
    north: { opportunity: 0, type: "target" },
    south: { opportunity: 0, type: "target" },
    east: { opportunity: 0, type: "target" },
    west: { opportunity: 0, type: "target" },
  };

  // From Shopify geo data
  for (const row of geoData) {
    const zone =
      resolveZone(row.city ?? "") ??
      resolveZone(row.state ?? "");
    if (!zone) continue;

    const gapScore = Math.min(100, row.gap_score ?? 0) / 100; // Normalize to 0-1

    if (row.problem_type === "awareness_gap" || row.problem_type === "conversion_gap") {
      // Gap zones: high opportunity
      result[zone].opportunity = Math.max(result[zone].opportunity, 0.6 + gapScore * 0.4);
      result[zone].type = "gap";
    } else if (row.problem_type === "strong_market") {
      // Strong market: moderate opportunity (can still grow)
      if (result[zone].type !== "gap") {
        result[zone].opportunity = Math.max(result[zone].opportunity, 0.2 + gapScore * 0.3);
        result[zone].type = "strong";
      }
    }
  }

  // Brand-declared target regions override with high opportunity
  if (targetRegions?.length) {
    for (const zone of targetRegions) {
      if (result[zone].type !== "gap") {
        // Only override if not already a gap zone (gaps are highest priority)
        result[zone].opportunity = Math.max(result[zone].opportunity, 0.8);
        result[zone].type = "target";
      }
    }
  }

  return result;
}

/**
 * Compute zone-level geo match score.
 *
 * Scores how well a creator's audience zones align with a brand's zone needs.
 * Returns 0-1 where:
 *   1.0 = creator's audience is heavily concentrated in brand's highest-need zones
 *   0.3 = no signal / neutral
 *   0.0 = creator's audience is in completely irrelevant zones
 */
export function computeZoneGeoScore(
  creatorProfile: ZoneProfile,
  brandNeeds: Record<IndiaZone, { opportunity: number; type: "gap" | "strong" | "target" }>
): number {
  const hasCreatorSignal = Object.values(creatorProfile).some((v) => v > 0.05);
  const hasBrandNeeds = Object.values(brandNeeds).some((n) => n.opportunity > 0);

  if (!hasCreatorSignal || !hasBrandNeeds) return 0.3;

  let weightedScore = 0;
  let totalOpportunity = 0;

  for (const zone of ["north", "south", "east", "west"] as IndiaZone[]) {
    const opp = brandNeeds[zone].opportunity;
    const creatorPresence = creatorProfile[zone];

    // Weighted overlap: brand opportunity × creator presence
    weightedScore += opp * creatorPresence;
    totalOpportunity += opp;
  }

  if (totalOpportunity === 0) return 0.3;

  // Two components:
  // 1. Alignment: how well does creator's audience distribution match brand needs? (0-1)
  const alignment = weightedScore / totalOpportunity;
  // 2. Opportunity magnitude: average opportunity level across active zones (0-1)
  const activeZones = Object.values(brandNeeds).filter((n) => n.opportunity > 0).length;
  const avgOpportunity = totalOpportunity / Math.max(activeZones, 1);

  // Blend: 70% alignment + 30% opportunity magnitude
  const blended = alignment * 0.7 + avgOpportunity * 0.3;

  // Map to 0.1-1.0 range
  return Math.min(1.0, 0.1 + blended * 0.9);
}
