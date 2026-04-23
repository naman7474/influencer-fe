/* ------------------------------------------------------------------ */
/*  India Population Weights                                            */
/*  Top metros + state-level fallback, normalized to [0,1] against      */
/*  the largest entry (Mumbai urban agglomeration). Used by the         */
/*  Shopify geo sync to judge whether a zone's Shopify-visible share    */
/*  looks like an "awareness gap" vs. a "strong market".                */
/*                                                                      */
/*  Source: 2011 Census urban-agglomeration estimates extrapolated to   */
/*  2024 using reported growth rates. Coarse but stable.                */
/* ------------------------------------------------------------------ */

/** Top city populations in millions (2024 estimate, urban agglomeration). */
export const CITY_POPULATION_MILLIONS: Record<string, number> = {
  mumbai: 22.0,
  delhi: 21.5,
  kolkata: 15.0,
  bangalore: 13.5,
  bengaluru: 13.5,
  chennai: 11.5,
  hyderabad: 10.5,
  ahmedabad: 8.4,
  pune: 7.4,
  surat: 7.0,
  jaipur: 4.2,
  lucknow: 3.9,
  kanpur: 3.3,
  nagpur: 3.1,
  indore: 3.1,
  thane: 2.5,
  bhopal: 2.4,
  visakhapatnam: 2.2,
  "pimpri-chinchwad": 2.1,
  patna: 2.5,
  vadodara: 2.2,
  ghaziabad: 2.4,
  ludhiana: 1.9,
  agra: 1.9,
  nashik: 2.0,
  faridabad: 1.6,
  meerut: 1.6,
  rajkot: 1.6,
  kalyan: 1.5,
  "kalyan-dombivli": 1.5,
  "vasai-virar": 1.4,
  varanasi: 1.3,
  srinagar: 1.3,
  aurangabad: 1.3,
  dhanbad: 1.3,
  amritsar: 1.2,
  "navi mumbai": 1.2,
  allahabad: 1.2,
  prayagraj: 1.2,
  ranchi: 1.2,
  howrah: 1.1,
  coimbatore: 2.3,
  jabalpur: 1.1,
  gwalior: 1.1,
  vijayawada: 1.5,
  jodhpur: 1.1,
  madurai: 1.5,
  raipur: 1.1,
  kota: 1.0,
  chandigarh: 1.1,
  guwahati: 1.0,
  solapur: 1.0,
  "hubli-dharwad": 1.0,
  mysore: 1.0,
  mysuru: 1.0,
  tiruchirapalli: 0.9,
  bareilly: 0.9,
  aligarh: 0.9,
  tiruppur: 0.9,
  gurgaon: 1.2,
  gurugram: 1.2,
  moradabad: 0.9,
  noida: 0.8,
  jalandhar: 0.9,
  bhubaneswar: 1.0,
  salem: 0.9,
  warangal: 0.8,
  mira: 0.8,
  "mira-bhayandar": 0.8,
  thiruvananthapuram: 1.0,
  bhiwandi: 0.8,
  saharanpur: 0.7,
  gorakhpur: 0.7,
  guntur: 0.7,
  bikaner: 0.7,
  amravati: 0.7,
  jamshedpur: 1.4,
  bhilai: 1.1,
  cuttack: 0.7,
  firozabad: 0.6,
  kochi: 0.6,
  nellore: 0.6,
  bhavnagar: 0.6,
  dehradun: 0.6,
  durgapur: 0.6,
  asansol: 0.6,
  rourkela: 0.5,
  nanded: 0.5,
  kolhapur: 0.6,
  ajmer: 0.5,
  akola: 0.5,
  gulbarga: 0.5,
  jamnagar: 0.6,
  ujjain: 0.5,
  loni: 0.5,
  siliguri: 0.5,
  jhansi: 0.5,
  ulhasnagar: 0.5,
  jammu: 0.7,
  sangli: 0.5,
};

/** State populations in millions (2024 estimate). */
export const STATE_POPULATION_MILLIONS: Record<string, number> = {
  "uttar pradesh": 241,
  maharashtra: 125,
  bihar: 127,
  "west bengal": 100,
  "madhya pradesh": 86,
  "tamil nadu": 77,
  rajasthan: 82,
  karnataka: 68,
  gujarat: 72,
  "andhra pradesh": 54,
  odisha: 46,
  telangana: 40,
  kerala: 35,
  jharkhand: 40,
  assam: 35,
  punjab: 31,
  chhattisgarh: 31,
  haryana: 30,
  delhi: 21.5,
  "jammu and kashmir": 13.6,
  uttarakhand: 11.4,
  "himachal pradesh": 7.5,
  tripura: 4.1,
  meghalaya: 3.4,
  manipur: 3.2,
  nagaland: 2.2,
  goa: 1.6,
  "arunachal pradesh": 1.6,
  "puducherry": 1.7,
  chandigarh: 1.1,
  mizoram: 1.2,
  sikkim: 0.7,
  "dadra and nagar haveli": 0.6,
  "andaman and nicobar islands": 0.4,
  lakshadweep: 0.07,
};

/**
 * Largest city used as the 1.0 reference. Picked deliberately (Mumbai
 * UA ~ 22M) so Delhi/Mumbai/Bangalore read as near-equivalent weights.
 */
const REFERENCE_CITY_POP = 22.0;
const REFERENCE_STATE_POP = 241.0;

/**
 * Returns a population weight in [0, 1] for a given city/state name.
 * Lookup strategy:
 *  1. Exact city match (lowercased, trimmed)
 *  2. Exact state match
 *  3. Fallback to 0 so the caller can tell "unknown" from "small".
 */
export function computePopulationWeight(
  cityOrState: string
): number {
  if (!cityOrState) return 0;
  const key = cityOrState.toLowerCase().trim();
  const cityPop = CITY_POPULATION_MILLIONS[key];
  if (cityPop != null) {
    return Math.min(1.0, cityPop / REFERENCE_CITY_POP);
  }
  const statePop = STATE_POPULATION_MILLIONS[key];
  if (statePop != null) {
    return Math.min(1.0, statePop / REFERENCE_STATE_POP);
  }
  return 0;
}
