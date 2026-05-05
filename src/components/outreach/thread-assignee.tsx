"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { UserCircle } from "lucide-react";
import { toast } from "sonner";

type Member = {
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: string;
};

export function ThreadAssignee(props: {
  threadId: string;
  initialAssigneeId: string | null;
  onChange?: (userId: string | null) => void;
}) {
  const [assigneeId, setAssigneeId] = useState<string | null>(
    props.initialAssigneeId
  );
  const [members, setMembers] = useState<Member[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);

  async function loadMembers() {
    if (loaded) return;
    const r = await fetch("/api/team/members").then((r) => r.json());
    setMembers(r.members ?? []);
    setLoaded(true);
  }

  useEffect(() => {
    if (open) loadMembers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function assign(userId: string | null) {
    const res = await fetch(`/api/messages/threads/${props.threadId}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      toast.error(e.error ?? "Failed to assign");
      return;
    }
    setAssigneeId(userId);
    setOpen(false);
    props.onChange?.(userId);
  }

  const current = members.find((m) => m.user_id === assigneeId);
  const label = assigneeId
    ? current?.display_name ?? current?.email ?? "Assigned"
    : "Unassigned";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger render={<Button variant="ghost" size="sm" className="gap-1.5" />}>
        <UserCircle className="size-4" />
        <span className="text-xs">{label}</span>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-1">
        <button
          type="button"
          onClick={() => assign(null)}
          className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted"
        >
          Unassign
        </button>
        <div className="my-1 h-px bg-border" />
        {members.map((m) => (
          <button
            key={m.user_id}
            type="button"
            onClick={() => assign(m.user_id)}
            className="w-full text-left text-sm px-2 py-1.5 rounded hover:bg-muted flex flex-col"
          >
            <span>{m.display_name ?? m.email ?? m.user_id}</span>
            {m.email && (
              <span className="text-xs text-muted-foreground">{m.email}</span>
            )}
          </button>
        ))}
        {!loaded && (
          <p className="px-2 py-1 text-xs text-muted-foreground">Loading…</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
