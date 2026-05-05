"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

type Member = {
  user_id: string;
  role: "owner" | "admin" | "member";
  joined_at: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

type Invite = {
  id: string;
  email: string;
  role: "owner" | "admin" | "member";
  expires_at: string;
  created_at: string;
  display_name: string | null;
  invite_url: string;
};

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Invite link copied");
  } catch {
    toast.error("Couldn't copy — please copy manually");
  }
}

const ROLE_LABEL: Record<Member["role"], string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export function TeamClient(props: {
  brandId: string;
  myRole: Member["role"];
  myUserId: string;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  const isAdmin = props.myRole === "owner" || props.myRole === "admin";

  async function refresh() {
    setLoading(true);
    const [m, i] = await Promise.all([
      fetch("/api/team/members").then((r) => r.json()),
      isAdmin
        ? fetch("/api/team/invite").then((r) => r.json())
        : Promise.resolve({ invites: [] }),
    ]);
    setMembers(m.members ?? []);
    setInvites(i.invites ?? []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changeRole(userId: string, role: Member["role"]) {
    const res = await fetch(`/api/team/members/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      toast.error(e.error ?? "Failed to update role");
      return;
    }
    toast.success("Role updated");
    refresh();
  }

  async function removeMember(userId: string) {
    if (!confirm("Remove this member?")) return;
    const res = await fetch(`/api/team/members/${userId}`, { method: "DELETE" });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      toast.error(e.error ?? "Failed to remove member");
      return;
    }
    toast.success("Member removed");
    refresh();
  }

  async function revokeInvite(id: string) {
    const res = await fetch(`/api/team/invites/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to revoke");
      return;
    }
    refresh();
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Members</CardTitle>
            <CardDescription>People with access to this brand.</CardDescription>
          </div>
          {isAdmin && (
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger render={<Button>Invite teammate</Button>} />
              <InviteDialog
                myRole={props.myRole}
                onSent={() => {
                  setInviteOpen(false);
                  refresh();
                }}
              />
            </Dialog>
          )}
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <ul className="divide-y">
              {members.map((m) => (
                <li
                  key={m.user_id}
                  className="flex items-center justify-between py-3 gap-4"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {m.display_name ?? m.email ?? m.user_id}
                      {m.user_id === props.myUserId && (
                        <span className="text-muted-foreground"> (you)</span>
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {m.email}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    {isAdmin && m.user_id !== props.myUserId ? (
                      <Select
                        value={m.role}
                        onValueChange={(v) =>
                          changeRole(m.user_id, v as Member["role"])
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {props.myRole === "owner" && (
                            <SelectItem value="owner">Owner</SelectItem>
                          )}
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="member">Member</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="secondary">{ROLE_LABEL[m.role]}</Badge>
                    )}
                    {isAdmin && m.user_id !== props.myUserId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeMember(m.user_id)}
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </li>
              ))}
              {members.length === 0 && (
                <li className="py-3 text-sm text-muted-foreground">
                  No members yet.
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>

      {isAdmin && invites.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Pending invites</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {invites.map((inv) => (
                <li
                  key={inv.id}
                  className="flex items-center justify-between py-3 gap-4"
                >
                  <div className="flex flex-col">
                    <span className="text-sm font-medium">
                      {inv.display_name ?? inv.email}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {inv.display_name ? `${inv.email} · ` : ""}
                      Expires {new Date(inv.expires_at).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">{ROLE_LABEL[inv.role]}</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(inv.invite_url)}
                    >
                      Copy link
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revokeInvite(inv.id)}
                    >
                      Revoke
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}

function InviteDialog(props: {
  myRole: Member["role"];
  onSent: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Member["role"]>("member");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<
    | { invite_url: string; email_delivered: boolean; email_error: string | null }
    | null
  >(null);

  async function submit() {
    setSubmitting(true);
    const res = await fetch("/api/team/invite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, role, display_name: name }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      toast.error(e.error ?? "Invite failed");
      return;
    }
    const json = await res.json();
    setResult({
      invite_url: json.invite_url,
      email_delivered: json.email_delivered,
      email_error: json.email_error,
    });
    if (json.email_delivered) toast.success(`Invite emailed to ${email}`);
    else toast.message(`Invite created — share the link below`);
    props.onSent();
  }

  function reset() {
    setName("");
    setEmail("");
    setResult(null);
  }

  if (result) {
    return (
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Invite created</DialogTitle>
          <DialogDescription>
            {result.email_delivered
              ? `An invite email was sent to ${email}.`
              : `We couldn't send the email (${result.email_error ?? "unknown"}). Share this link with them directly:`}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2 py-2">
          <Label>Invite link</Label>
          <div className="flex items-center gap-2">
            <Input value={result.invite_url} readOnly className="font-mono text-xs" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => copyToClipboard(result.invite_url)}
            >
              Copy
            </Button>
          </div>
          {!result.email_delivered && result.email_error === "gmail_not_connected" && (
            <p className="text-xs text-muted-foreground">
              Tip: connect Gmail in Settings → Integrations to email future invites
              automatically.
            </p>
          )}
          {!result.email_delivered && result.email_error === "gmail_token_expired" && (
            <p className="text-xs text-muted-foreground">
              Your Gmail connection expired. Reconnect it in Settings → Integrations
              to email future invites automatically.
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={reset}>
            Invite another
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Invite a teammate</DialogTitle>
        <DialogDescription>
          They&apos;ll get an email with a link to join. Invites expire in 7 days.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-2">
        <div className="grid gap-2">
          <Label htmlFor="invite-name">Name</Label>
          <Input
            id="invite-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
          />
          <p className="text-xs text-muted-foreground">
            Used until they sign in and edit their own profile.
          </p>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com"
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="invite-role">Role</Label>
          <Select value={role} onValueChange={(v) => setRole(v as Member["role"])}>
            <SelectTrigger id="invite-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {props.myRole === "owner" && <SelectItem value="owner">Owner</SelectItem>}
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="member">Member</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={!email || submitting}>
          {submitting ? "Sending…" : "Send invite"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
