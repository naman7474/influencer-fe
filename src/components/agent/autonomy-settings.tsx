"use client";

import { useState, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Settings2 } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type AutonomyLevel = "AUTO" | "AUTO-DRAFT" | "APPROVAL-REQUIRED" | "ALWAYS-MANUAL";

interface ActionConfig {
  key: string;
  label: string;
  description: string;
}

const ACTIONS: ActionConfig[] = [
  { key: "first_outreach", label: "First outreach email", description: "Initial cold email to a creator" },
  { key: "follow_up_no_response", label: "Follow-up (no response)", description: "Follow-up when creator hasn't replied" },
  { key: "follow_up_after_response", label: "Follow-up (after response)", description: "Follow-up after creator has replied" },
  { key: "negotiate_rates", label: "Negotiate rates", description: "Send counter-offer or accept rates" },
  { key: "send_brief", label: "Send campaign brief", description: "Send creative brief to confirmed creators" },
  { key: "content_revision", label: "Content revision request", description: "Request changes to submitted content" },
  { key: "gifting_order", label: "Create gifting order", description: "Create Shopify draft order for product gifting" },
  { key: "budget_commit_above_threshold", label: "Commit budget above threshold", description: "Approve spend above the budget threshold" },
];

const LEVELS: { value: AutonomyLevel; label: string; color: string }[] = [
  { value: "AUTO", label: "Auto", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "AUTO-DRAFT", label: "Auto-Draft", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "APPROVAL-REQUIRED", label: "Approval Required", color: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  { value: "ALWAYS-MANUAL", label: "Manual Only", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

const PRESETS: Record<string, Record<string, AutonomyLevel>> = {
  conservative: {
    first_outreach: "ALWAYS-MANUAL",
    follow_up_no_response: "ALWAYS-MANUAL",
    follow_up_after_response: "ALWAYS-MANUAL",
    negotiate_rates: "ALWAYS-MANUAL",
    send_brief: "ALWAYS-MANUAL",
    content_revision: "ALWAYS-MANUAL",
    gifting_order: "ALWAYS-MANUAL",
    budget_commit_above_threshold: "ALWAYS-MANUAL",
  },
  balanced: {
    first_outreach: "APPROVAL-REQUIRED",
    follow_up_no_response: "AUTO-DRAFT",
    follow_up_after_response: "APPROVAL-REQUIRED",
    negotiate_rates: "ALWAYS-MANUAL",
    send_brief: "APPROVAL-REQUIRED",
    content_revision: "AUTO-DRAFT",
    gifting_order: "APPROVAL-REQUIRED",
    budget_commit_above_threshold: "ALWAYS-MANUAL",
  },
  autonomous: {
    first_outreach: "AUTO-DRAFT",
    follow_up_no_response: "AUTO",
    follow_up_after_response: "AUTO-DRAFT",
    negotiate_rates: "APPROVAL-REQUIRED",
    send_brief: "AUTO-DRAFT",
    content_revision: "AUTO",
    gifting_order: "APPROVAL-REQUIRED",
    budget_commit_above_threshold: "ALWAYS-MANUAL",
  },
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface AutonomySettingsProps {
  actionAutonomy: Record<string, AutonomyLevel>;
  budgetThreshold: number;
  onChange: (actionAutonomy: Record<string, AutonomyLevel>, budgetThreshold: number) => void;
}

export function AutonomySettings({
  actionAutonomy,
  budgetThreshold,
  onChange,
}: AutonomySettingsProps) {
  const [localBudgetThreshold, setLocalBudgetThreshold] = useState(budgetThreshold);

  const handleActionChange = useCallback(
    (actionKey: string, level: AutonomyLevel) => {
      const updated = { ...actionAutonomy, [actionKey]: level };
      onChange(updated, localBudgetThreshold);
    },
    [actionAutonomy, localBudgetThreshold, onChange]
  );

  const handlePreset = useCallback(
    (presetName: string) => {
      const preset = PRESETS[presetName];
      if (preset) {
        onChange({ ...preset }, localBudgetThreshold);
      }
    },
    [localBudgetThreshold, onChange]
  );

  const handleBudgetChange = useCallback(
    (value: string) => {
      const num = Number(value) || 0;
      setLocalBudgetThreshold(num);
      onChange(actionAutonomy, num);
    },
    [actionAutonomy, onChange]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="size-4" />
          Action Permissions
        </CardTitle>
        <CardDescription>
          Control what the agent can do autonomously for each action type.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Presets */}
        <div className="flex flex-col gap-2">
          <Label className="text-xs text-muted-foreground">Quick Presets</Label>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePreset("conservative")}
            >
              Conservative
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePreset("balanced")}
            >
              Balanced
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePreset("autonomous")}
            >
              Autonomous
            </Button>
          </div>
        </div>

        {/* Per-action grid */}
        <div className="flex flex-col gap-3">
          {ACTIONS.map((action) => {
            const currentLevel = actionAutonomy[action.key] || "APPROVAL-REQUIRED";
            return (
              <div
                key={action.key}
                className="flex items-center justify-between gap-4 py-2 border-b border-border/50 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{action.label}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {action.description}
                  </p>
                </div>
                <Select
                  value={currentLevel}
                  onValueChange={(val) =>
                    handleActionChange(action.key, val as AutonomyLevel)
                  }
                >
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LEVELS.map((level) => (
                      <SelectItem key={level.value} value={level.value}>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 ${level.color}`}
                          >
                            {level.label}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            );
          })}
        </div>

        {/* Budget threshold */}
        {actionAutonomy.budget_commit_above_threshold !== "ALWAYS-MANUAL" && (
          <div className="flex flex-col gap-2 pt-2 border-t">
            <Label htmlFor="budget-threshold" className="text-sm">
              Budget Threshold (INR)
            </Label>
            <p className="text-xs text-muted-foreground">
              Actions committing more than this amount will require the selected
              approval level.
            </p>
            <Input
              id="budget-threshold"
              type="number"
              value={localBudgetThreshold}
              onChange={(e) => handleBudgetChange(e.target.value)}
              className="max-w-[200px]"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
