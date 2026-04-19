"use client";

import {
  Search,
  Mail,
  Handshake,
  BarChart3,
  Target,
  ArrowUpRight,
  Zap,
  Sparkles,
} from "lucide-react";

/* ── Prompt groups ─────────────────────────────────────── */

const PROMPT_GROUPS = [
  {
    label: "Discover",
    icon: Search,
    prompts: [
      "Find beauty micro-influencers in Tamil Nadu, warm to us already",
      "Creators similar to @neeshicorner but under 100K",
      "Who's reviewed our competitors in the last 30 days?",
    ],
  },
  {
    label: "Outreach",
    icon: Mail,
    prompts: [
      "Draft outreach to @aarushi.glow, warm tone, PR + paid collab",
      "Follow up with everyone who didn't reply in 7 days",
      "Rewrite the Navratri pitch for a Hindi-speaking audience",
    ],
  },
  {
    label: "Negotiate",
    icon: Handshake,
    prompts: [
      "Benchmark rates for micro beauty creators in TN",
      "Counter @divya's ₹40k ask — we want ₹32k ceiling",
      "Draft a deal memo for the terms we agreed with @priyaunfiltered",
    ],
  },
  {
    label: "Measure",
    icon: BarChart3,
    prompts: [
      "ROI summary for Navratri Launch — by creator",
      "Where is the Diwali Glow budget going?",
      "Which creators are at risk of churn this quarter?",
    ],
  },
  {
    label: "Build",
    icon: Target,
    prompts: [
      "Create a new Diwali campaign from the shortlist",
      "Build a summer hydration campaign, ₹5L budget",
      "Turn last week's top 6 creators into a campaign",
    ],
  },
];

/* ── Quick start prompts ───────────────────────────────── */

/* ── Component ─────────────────────────────────────────── */

interface EmptyStateRedesignProps {
  onSend: (text: string) => void;
}

export function EmptyStateRedesign({ onSend }: EmptyStateRedesignProps) {
  return (
    <div className="max-w-[840px] mx-auto px-4 pt-10 pb-6">
      {/* Brand */}
      <div className="flex items-center gap-2.5 mb-1">
        <Sparkles className="h-5 w-5" style={{ color: "var(--primary)" }} />
        <span
          className="text-[11px] font-mono uppercase tracking-wider"
          style={{ color: "var(--fg-faint)" }}
        >
          Marketing Agent
        </span>
      </div>

      {/* Heading */}
      <h1
        className="mt-3 font-semibold"
        style={{ fontSize: 26, letterSpacing: -0.5, color: "var(--foreground)" }}
      >
        What are we working on?
      </h1>
      <p
        className="mt-1.5 text-[13.5px]"
        style={{ color: "var(--fg-dim)", lineHeight: 1.5 }}
      >
        Delegate real work — discovery, outreach, deals, campaign ops. Artifacts
        open in a canvas on the right and are yours to edit, approve, or push
        live.
      </p>

      {/* Prompt groups — 2-col grid */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-5">
        {PROMPT_GROUPS.map((g) => {
          const Icon = g.icon;
          return (
            <div key={g.label}>
              <div className="flex items-center gap-2 mb-2">
                <Icon
                  className="h-3 w-3"
                  style={{ color: "var(--fg-dim)" }}
                />
                <span
                  className="text-[11px] font-mono uppercase tracking-wider"
                  style={{ color: "var(--fg-dim)" }}
                >
                  {g.label}
                </span>
              </div>
              <div className="flex flex-col">
                {g.prompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => onSend(p)}
                    className="text-left text-[12.5px] py-1.5 px-2 -mx-2 rounded-md transition-colors group flex items-center gap-2 hover:bg-surface-2"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    <span className="flex-1 truncate group-hover:text-foreground transition-colors">
                      {p}
                    </span>
                    <ArrowUpRight
                      className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      style={{ color: "var(--fg-faint)" }}
                    />
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick start */}
      <div className="mt-10 pt-5 border-t">
        <div className="flex items-center gap-2 mb-3">
          <Zap className="h-3 w-3" style={{ color: "var(--fg-dim)" }} />
          <span
            className="text-[11px] font-mono uppercase tracking-wider"
            style={{ color: "var(--fg-dim)" }}
          >
            Quick start
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            "Find beauty micro-influencers who speak Tamil",
            "How are my active campaigns performing?",
            "What's the market rate for macro influencers?",
            "Which creators are at risk of churning?",
          ].map((prompt) => (
            <button
              key={prompt}
              onClick={() => onSend(prompt)}
              className="rounded-full border px-3 py-1.5 text-[12px] transition-all duration-150 hover:border-border-strong hover:bg-surface-2 hover:scale-[1.03] active:scale-[0.97]"
              style={{ color: "var(--muted-foreground)", background: "var(--card)" }}
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

