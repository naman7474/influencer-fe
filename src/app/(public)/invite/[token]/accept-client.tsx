"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function InviteAcceptClient({ token }: { token: string }) {
  const router = useRouter();
  const [accepting, setAccepting] = useState(false);

  async function accept() {
    setAccepting(true);
    const res = await fetch(`/api/team/invite/${encodeURIComponent(token)}/accept`, {
      method: "POST",
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      toast.error(e.error ?? "Failed to accept invite");
      setAccepting(false);
      return;
    }
    toast.success("You're in!");
    router.push("/dashboard");
  }

  return (
    <Button onClick={accept} disabled={accepting}>
      {accepting ? "Accepting…" : "Accept invite"}
    </Button>
  );
}
