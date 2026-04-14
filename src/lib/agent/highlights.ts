import type { UIMessage } from "ai";

/* ── Highlight taxonomy ──────────────────────────────────── */

export type HighlightKind =
  | "creators_found"
  | "creator_profile"
  | "campaign_created"
  | "campaign_overview"
  | "outreach_drafted"
  | "approval_pending"
  | "rate_benchmark"
  | "negotiation"
  | "deal_memo"
  | "budget"
  | "roi"
  | "content_tracked"
  | "brief_generated"
  | "relationship_insight"
  | "generic";

export interface Highlight {
  /** stable id — toolCallId from the Vercel AI SDK tool part */
  id: string;
  kind: HighlightKind;
  title: string;
  subtitle?: string;
  /** creator handles referenced in this highlight — enables @handle deep-linking */
  handles: string[];
  timestamp: number;
  toolName: string;
  /** raw tool output — passed to the detail card component */
  toolOutput: Record<string, unknown>;
}

/** Maps every known tool name to the highlight kind it produces. */
const TOOL_KIND: Record<string, HighlightKind> = {
  // Discovery → creators_found
  creator_search: "creators_found",
  lookalike_finder: "creators_found",
  warm_lead_detector: "creators_found",
  competitor_mapper: "creators_found",
  geo_opportunity_finder: "creators_found",
  audience_overlap_check: "creators_found",

  get_creator_details: "creator_profile",

  // Campaigns
  campaign_builder: "campaign_created",
  campaign_overview: "campaign_overview",
  campaign_status_manager: "campaign_overview",

  // Outreach
  outreach_drafter: "outreach_drafted",
  propose_outreach: "approval_pending",

  // Negotiation
  rate_benchmarker: "rate_benchmark",
  counter_offer_generator: "negotiation",
  deal_memo_generator: "deal_memo",
  budget_optimizer: "budget",

  // Tracking
  roi_calculator: "roi",
  content_tracker: "content_tracked",

  // Briefs
  brief_generator: "brief_generated",

  // Relationship
  relationship_scorer: "relationship_insight",
  ambassador_identifier: "relationship_insight",
  churn_predictor: "relationship_insight",
  reengagement_recommender: "relationship_insight",
};

/* ── Helpers to dig handles / counts out of tool output ──── */

function asNum(v: unknown): number | undefined {
  return typeof v === "number" ? v : undefined;
}
function asStr(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}
function asObj(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : undefined;
}
function asArr(v: unknown): Array<Record<string, unknown>> | undefined {
  return Array.isArray(v) ? (v as Array<Record<string, unknown>>) : undefined;
}

/** Extract any creator @handles present anywhere in the output. */
function collectHandles(output: Record<string, unknown>): string[] {
  const out = new Set<string>();
  const visit = (v: unknown, keyHint?: string) => {
    if (!v) return;
    if (typeof v === "string") {
      if (keyHint === "handle" && v.length > 0 && v.length < 60) out.add(v);
      return;
    }
    if (Array.isArray(v)) {
      for (const item of v) visit(item);
      return;
    }
    if (typeof v === "object") {
      for (const [k, child] of Object.entries(v as Record<string, unknown>)) {
        visit(child, k);
      }
    }
  };
  visit(output);
  return Array.from(out);
}

/* ── Title / subtitle builder ───────────────────────────── */

interface Labels {
  title: string;
  subtitle?: string;
}

function buildLabels(
  kind: HighlightKind,
  toolName: string,
  out: Record<string, unknown>
): Labels {
  switch (kind) {
    case "creators_found": {
      const count = asNum(out.count) ?? asArr(out.results)?.length ?? 0;
      const total = asNum(out.total_in_database);
      const toolLabel: Record<string, string> = {
        creator_search: "creators",
        lookalike_finder: "similar creators",
        warm_lead_detector: "warm leads",
        competitor_mapper: "competitor creators",
        geo_opportunity_finder: "geo opportunities",
        audience_overlap_check: "overlap matches",
      };
      return {
        title: `Found ${count} ${toolLabel[toolName] ?? "creators"}`,
        subtitle: total && total > count ? `${total} total` : undefined,
      };
    }
    case "creator_profile": {
      const creator = asObj(out.creator) ?? out;
      const handle = asStr(creator.handle);
      return {
        title: handle ? `@${handle}` : "Creator profile",
        subtitle: asStr(creator.display_name) ?? asStr(creator.niche),
      };
    }
    case "campaign_created": {
      const name =
        asStr(out.name) ??
        asStr(asObj(out.campaign)?.name) ??
        "New campaign";
      return {
        title: `Campaign drafted: ${name}`,
        subtitle: asStr(out.status) ?? "draft",
      };
    }
    case "campaign_overview": {
      const count = asArr(out.campaigns)?.length ?? 0;
      return {
        title: `${count} campaign${count === 1 ? "" : "s"}`,
      };
    }
    case "outreach_drafted": {
      const handle = asStr(out.creator_handle) ?? asStr(out.handle);
      const subject = asStr(out.subject);
      return {
        title: handle ? `Outreach drafted for @${handle}` : "Outreach draft ready",
        subtitle: subject,
      };
    }
    case "approval_pending": {
      return {
        title: "Awaiting approval",
        subtitle: asStr(out.message) ?? "Review in Approvals",
      };
    }
    case "rate_benchmark": {
      const tier = asStr(out.tier);
      const rate = asObj(out.market_rate);
      const median = asNum(rate?.median);
      return {
        title: tier ? `Rate benchmark — ${tier}` : "Rate benchmark",
        subtitle:
          median != null ? `Median ₹${median.toLocaleString("en-IN")}` : undefined,
      };
    }
    case "negotiation": {
      const neg = asObj(out.negotiation);
      const handle =
        asStr(neg?.creator_handle) ??
        asStr(asObj(neg?.creator)?.handle);
      return {
        title: handle ? `Counter-offer for @${handle}` : "Counter-offer drafted",
      };
    }
    case "deal_memo": {
      const memo = asObj(out.deal_memo);
      const handle = asStr(asObj(memo?.creator)?.handle);
      return {
        title: handle ? `Deal memo — @${handle}` : "Deal memo ready",
      };
    }
    case "budget": {
      const campaign = asStr(out.campaign) ?? "campaign";
      const bs = asObj(out.budget_summary);
      const used = asNum(bs?.budget_used_percent);
      return {
        title: `Budget — ${campaign}`,
        subtitle: used != null ? `${used}% used` : undefined,
      };
    }
    case "roi": {
      const campaign = asStr(out.campaign) ?? "campaign";
      const kpis = asObj(out.kpis);
      const roi = kpis?.roi;
      return {
        title: `ROI — ${campaign}`,
        subtitle: roi != null ? `${String(roi)}x` : undefined,
      };
    }
    case "content_tracked": {
      const count = asArr(out.posts)?.length ?? 0;
      return {
        title: `${count} post${count === 1 ? "" : "s"} tracked`,
      };
    }
    case "brief_generated": {
      return {
        title: "Campaign brief generated",
        subtitle: asStr(out.title) ?? asStr(out.campaign),
      };
    }
    case "relationship_insight": {
      const labelMap: Record<string, string> = {
        relationship_scorer: "Relationship score",
        ambassador_identifier: "Ambassador candidates",
        churn_predictor: "Churn risk analysis",
        reengagement_recommender: "Re-engagement targets",
      };
      const count = asArr(out.creators)?.length ?? asArr(out.candidates)?.length;
      return {
        title: labelMap[toolName] ?? "Relationship insight",
        subtitle:
          count != null ? `${count} creator${count === 1 ? "" : "s"}` : undefined,
      };
    }
    case "generic":
    default: {
      return {
        title: toolName.replace(/_/g, " "),
        subtitle: asStr(out.message)?.slice(0, 80),
      };
    }
  }
}

/* ── Core: extract highlights from a message list ────────── */

/**
 * Walks the UIMessage[] from Vercel AI SDK and returns a highlight
 * entry for every completed tool call (state = "result" | "output").
 * Newest-first order (reverse-chronological).
 */
export function extractHighlights(messages: UIMessage[]): Highlight[] {
  const highlights: Highlight[] = [];
  let clock = 0;

  for (const msg of messages) {
    if (msg.role !== "assistant") continue;
    for (const part of msg.parts ?? []) {
      const p = part as unknown as Record<string, unknown>;
      const toolCallId = p.toolCallId;
      if (!toolCallId || typeof toolCallId !== "string") continue;

      // Vercel AI SDK v6: completed tool parts use "output-available".
      // Legacy aliases kept for defensive compatibility.
      const state = p.state as string | undefined;
      const isComplete =
        state === "output-available" ||
        state === "result" ||
        state === "output";
      if (!isComplete) continue;

      // In v6 the tool part type is `tool-${name}` for static tools,
      // or `dynamic-tool` with a separate `toolName` field.
      const typeStr = typeof p.type === "string" ? p.type : "";
      const toolName =
        (p.toolName as string | undefined) ??
        (typeStr.startsWith("tool-") ? typeStr.slice(5) : "");
      if (!toolName) continue;

      const raw = (p.output ?? p.result) as Record<string, unknown> | undefined;
      if (!raw) continue;

      // Some tools return { status: "pending", approval_id } — treat as approval_pending
      // regardless of their original kind (e.g. campaign_builder wrapped in approval).
      const isPendingApproval =
        asStr(raw.status) === "pending" && asStr(raw.approval_id) != null;

      const kind: HighlightKind = isPendingApproval
        ? "approval_pending"
        : TOOL_KIND[toolName] ?? "generic";

      const { title, subtitle } = buildLabels(kind, toolName, raw);

      highlights.push({
        id: toolCallId,
        kind,
        title,
        subtitle,
        handles: collectHandles(raw),
        timestamp: clock++,
        toolName,
        toolOutput: raw,
      });
    }
  }

  return highlights.reverse();
}

/**
 * Build a lookup from toolCallId → highlight for O(1) pill resolution.
 */
export function indexHighlights(list: Highlight[]): Map<string, Highlight> {
  const m = new Map<string, Highlight>();
  for (const h of list) m.set(h.id, h);
  return m;
}

/**
 * Find the most recent highlight that references `@handle`.
 */
export function findHighlightByHandle(
  list: Highlight[],
  handle: string
): Highlight | null {
  const lower = handle.toLowerCase();
  for (const h of list) {
    if (h.handles.some((x) => x.toLowerCase() === lower)) return h;
  }
  return null;
}
