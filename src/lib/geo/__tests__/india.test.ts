import { describe, it, expect } from "vitest";
import {
  resolveZone,
  languageToZone,
  isPanIndiaLanguage,
  buildCreatorZoneProfile,
  buildBrandZoneNeeds,
  computeZoneGeoScore,
  emptyZoneProfile,
  ZONE_LABELS,
  type IndiaZone,
} from "../india";

/* ------------------------------------------------------------------ */
/*  resolveZone                                                        */
/* ------------------------------------------------------------------ */

describe("resolveZone", () => {
  it("resolves cities to correct zones", () => {
    expect(resolveZone("Mumbai")).toBe("west");
    expect(resolveZone("Delhi")).toBe("north");
    expect(resolveZone("Bangalore")).toBe("south");
    expect(resolveZone("Bengaluru")).toBe("south");
    expect(resolveZone("Kolkata")).toBe("east");
    expect(resolveZone("Chennai")).toBe("south");
    expect(resolveZone("Hyderabad")).toBe("south");
    expect(resolveZone("Pune")).toBe("west");
    expect(resolveZone("Ahmedabad")).toBe("west");
    expect(resolveZone("Jaipur")).toBe("north");
  });

  it("resolves states to correct zones", () => {
    expect(resolveZone("Maharashtra")).toBe("west");
    expect(resolveZone("Tamil Nadu")).toBe("south");
    expect(resolveZone("Karnataka")).toBe("south");
    expect(resolveZone("West Bengal")).toBe("east");
    expect(resolveZone("Rajasthan")).toBe("north");
    expect(resolveZone("Gujarat")).toBe("west");
    expect(resolveZone("Kerala")).toBe("south");
    expect(resolveZone("Punjab")).toBe("north");
    expect(resolveZone("Odisha")).toBe("east");
  });

  it("resolves zone labels", () => {
    expect(resolveZone("North India")).toBe("north");
    expect(resolveZone("South India")).toBe("south");
    expect(resolveZone("East India")).toBe("east");
    expect(resolveZone("West India")).toBe("west");
    expect(resolveZone("north")).toBe("north");
    expect(resolveZone("south")).toBe("south");
  });

  it("is case-insensitive", () => {
    expect(resolveZone("MUMBAI")).toBe("west");
    expect(resolveZone("delhi")).toBe("north");
    expect(resolveZone("tAmIl NaDu")).toBe("south");
  });

  it("returns null for unknown locations", () => {
    expect(resolveZone("New York")).toBeNull();
    expect(resolveZone("London")).toBeNull();
    expect(resolveZone("")).toBeNull();
  });

  it("matches substrings containing city/state names", () => {
    expect(resolveZone("Greater Mumbai")).toBe("west");
    expect(resolveZone("New Delhi")).toBe("north");
  });
});

/* ------------------------------------------------------------------ */
/*  languageToZone                                                     */
/* ------------------------------------------------------------------ */

describe("languageToZone", () => {
  it("maps South Indian languages to south", () => {
    expect(languageToZone("Tamil")).toBe("south");
    expect(languageToZone("Kannada")).toBe("south");
    expect(languageToZone("Telugu")).toBe("south");
    expect(languageToZone("Malayalam")).toBe("south");
  });

  it("maps East Indian languages to east", () => {
    expect(languageToZone("Bengali")).toBe("east");
    expect(languageToZone("Odia")).toBe("east");
    expect(languageToZone("Assamese")).toBe("east");
  });

  it("maps West Indian languages to west", () => {
    expect(languageToZone("Marathi")).toBe("west");
    expect(languageToZone("Gujarati")).toBe("west");
  });

  it("maps Hindi to north", () => {
    expect(languageToZone("Hindi")).toBe("north");
    expect(languageToZone("Punjabi")).toBe("north");
  });

  it("returns null for English", () => {
    expect(languageToZone("English")).toBeNull();
  });

  it("is case-insensitive", () => {
    expect(languageToZone("TAMIL")).toBe("south");
    expect(languageToZone("marathi")).toBe("west");
  });
});

/* ------------------------------------------------------------------ */
/*  isPanIndiaLanguage                                                 */
/* ------------------------------------------------------------------ */

describe("isPanIndiaLanguage", () => {
  it("identifies Hindi as pan-India", () => {
    expect(isPanIndiaLanguage("Hindi")).toBe(true);
    expect(isPanIndiaLanguage("Hinglish")).toBe(true);
  });

  it("identifies English as pan-India", () => {
    expect(isPanIndiaLanguage("English")).toBe(true);
  });

  it("does not consider regional languages as pan-India", () => {
    expect(isPanIndiaLanguage("Tamil")).toBe(false);
    expect(isPanIndiaLanguage("Bengali")).toBe(false);
    expect(isPanIndiaLanguage("Marathi")).toBe(false);
  });
});

/* ------------------------------------------------------------------ */
/*  buildCreatorZoneProfile                                            */
/* ------------------------------------------------------------------ */

describe("buildCreatorZoneProfile", () => {
  it("returns empty profile with no signals", () => {
    const profile = buildCreatorZoneProfile({});
    expect(profile).toEqual(emptyZoneProfile());
  });

  it("uses spoken language signal (Tamil → south)", () => {
    const profile = buildCreatorZoneProfile({
      spokenLanguage: "Tamil",
    });
    expect(profile.south).toBeGreaterThan(0.5);
    expect(profile.north).toBe(0);
  });

  it("uses creator location signal (Mumbai → west)", () => {
    const profile = buildCreatorZoneProfile({
      creatorCity: "Mumbai",
    });
    expect(profile.west).toBeGreaterThan(0.5);
  });

  it("uses geo_regions from pipeline (array format)", () => {
    const profile = buildCreatorZoneProfile({
      geoRegions: [
        { region: "Maharashtra", confidence: 0.5 },
        { region: "Karnataka", confidence: 0.3 },
      ],
    });
    expect(profile.west).toBeGreaterThan(0);
    expect(profile.south).toBeGreaterThan(0);
  });

  it("combines multiple signals and normalizes to ~1.0", () => {
    const profile = buildCreatorZoneProfile({
      geoRegions: [{ region: "Maharashtra", confidence: 0.6 }],
      spokenLanguage: "Marathi",
      creatorCity: "Pune",
    });
    const total = profile.north + profile.south + profile.east + profile.west;
    expect(total).toBeCloseTo(1.0, 1);
    expect(profile.west).toBeGreaterThan(0.8); // All signals point west
  });

  it("distributes weight across zones when signals point to different zones", () => {
    const profile = buildCreatorZoneProfile({
      geoRegions: [{ region: "Tamil Nadu", confidence: 0.7 }], // south
      spokenLanguage: "Hindi", // north (weak)
      creatorCity: "Delhi", // north
    });
    expect(profile.south).toBeGreaterThan(0);
    expect(profile.north).toBeGreaterThan(0);
    expect(profile.south).toBeGreaterThan(profile.north); // geo_regions has highest weight
  });

  it("gives reduced weight to Hindi as pan-India language", () => {
    const hindiProfile = buildCreatorZoneProfile({
      spokenLanguage: "Hindi",
      creatorCity: "Mumbai",
    });
    const tamilProfile = buildCreatorZoneProfile({
      spokenLanguage: "Tamil",
      creatorCity: "Mumbai",
    });
    // Hindi should contribute less to north than Tamil does to south
    expect(hindiProfile.north).toBeLessThan(tamilProfile.south);
  });
});

/* ------------------------------------------------------------------ */
/*  buildBrandZoneNeeds                                                */
/* ------------------------------------------------------------------ */

describe("buildBrandZoneNeeds", () => {
  it("returns baseline needs with empty geo data", () => {
    const needs = buildBrandZoneNeeds([]);
    expect(needs.north.opportunity).toBe(0);
    expect(needs.south.opportunity).toBe(0);
  });

  it("assigns high opportunity to gap zones", () => {
    const needs = buildBrandZoneNeeds([
      { city: "Mumbai", state: "Maharashtra", problem_type: "awareness_gap", gap_score: 80 },
    ]);
    expect(needs.west.opportunity).toBeGreaterThan(0.5);
    expect(needs.west.type).toBe("gap");
  });

  it("assigns moderate opportunity to strong market zones", () => {
    const needs = buildBrandZoneNeeds([
      { city: "Bangalore", state: "Karnataka", problem_type: "strong_market", gap_score: 30 },
    ]);
    expect(needs.south.opportunity).toBeGreaterThan(0);
    expect(needs.south.opportunity).toBeLessThan(0.6);
    expect(needs.south.type).toBe("strong");
  });

  it("uses target regions when provided", () => {
    const needs = buildBrandZoneNeeds([], ["south", "east"]);
    expect(needs.south.opportunity).toBeGreaterThanOrEqual(0.8);
    expect(needs.east.opportunity).toBeGreaterThanOrEqual(0.8);
    expect(needs.north.opportunity).toBe(0);
  });

  it("gap zones take precedence over target regions", () => {
    const needs = buildBrandZoneNeeds(
      [{ city: "Mumbai", problem_type: "awareness_gap", gap_score: 90 }],
      ["west"]
    );
    expect(needs.west.type).toBe("gap");
    expect(needs.west.opportunity).toBeGreaterThan(0.8);
  });
});

/* ------------------------------------------------------------------ */
/*  computeZoneGeoScore                                                */
/* ------------------------------------------------------------------ */

describe("computeZoneGeoScore", () => {
  it("returns 0.3 when no creator signal", () => {
    const needs = buildBrandZoneNeeds([], ["south"]);
    expect(computeZoneGeoScore(emptyZoneProfile(), needs)).toBe(0.3);
  });

  it("returns 0.3 when no brand needs", () => {
    const profile = { north: 0.5, south: 0.3, east: 0.1, west: 0.1 };
    const needs = buildBrandZoneNeeds([]);
    expect(computeZoneGeoScore(profile, needs)).toBe(0.3);
  });

  it("scores high when creator audience matches brand gap zones", () => {
    const profile = { north: 0.1, south: 0.1, east: 0.1, west: 0.7 };
    const needs = buildBrandZoneNeeds([
      { city: "Mumbai", problem_type: "awareness_gap", gap_score: 80 },
    ]);
    const score = computeZoneGeoScore(profile, needs);
    expect(score).toBeGreaterThan(0.5);
  });

  it("scores low when creator audience is in wrong zones", () => {
    const profile = { north: 0.7, south: 0.1, east: 0.1, west: 0.1 };
    const needs = buildBrandZoneNeeds([
      { city: "Chennai", problem_type: "awareness_gap", gap_score: 80 },
    ]); // south gap
    const score = computeZoneGeoScore(profile, needs);
    expect(score).toBeLessThan(0.5);
  });

  it("scores moderately when creator matches strong markets", () => {
    const profile = { north: 0.1, south: 0.7, east: 0.1, west: 0.1 };
    const needs = buildBrandZoneNeeds([
      { city: "Bangalore", problem_type: "strong_market", gap_score: 50 },
    ]);
    const score = computeZoneGeoScore(profile, needs);
    expect(score).toBeGreaterThan(0.3);
  });

  it("scores higher for gap match than strong market match", () => {
    const profile = { north: 0.1, south: 0.7, east: 0.1, west: 0.1 };
    const gapNeeds = buildBrandZoneNeeds([
      { city: "Bangalore", problem_type: "awareness_gap", gap_score: 80 },
    ]);
    const strongNeeds = buildBrandZoneNeeds([
      { city: "Bangalore", problem_type: "strong_market", gap_score: 50 },
    ]);
    const gapScore = computeZoneGeoScore(profile, gapNeeds);
    const strongScore = computeZoneGeoScore(profile, strongNeeds);
    expect(gapScore).toBeGreaterThan(strongScore);
  });

  it("works with target regions as brand needs", () => {
    const profile = { north: 0.1, south: 0.6, east: 0.2, west: 0.1 };
    const needs = buildBrandZoneNeeds([], ["south"]);
    const score = computeZoneGeoScore(profile, needs);
    expect(score).toBeGreaterThan(0.5);
  });
});

/* ------------------------------------------------------------------ */
/*  ZONE_LABELS                                                        */
/* ------------------------------------------------------------------ */

describe("ZONE_LABELS", () => {
  it("has all four zones", () => {
    expect(Object.keys(ZONE_LABELS)).toHaveLength(4);
    expect(ZONE_LABELS.north).toBe("North India");
    expect(ZONE_LABELS.south).toBe("South India");
    expect(ZONE_LABELS.east).toBe("East India");
    expect(ZONE_LABELS.west).toBe("West India");
  });
});
