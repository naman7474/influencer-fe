import { redirect } from "next/navigation";
import { createServerSupabaseClient, createServiceRoleClient } from "@/lib/supabase/server";
import { InviteAcceptClient } from "./accept-client";

type PageProps = { params: Promise<{ token: string }> };

export default async function InvitePage({ params }: PageProps) {
  const { token } = await params;

  const svc = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: inviteRow } = await (svc as any)
    .from("brand_invites")
    .select(
      "id, brand_id, email, role, expires_at, accepted_at, brands ( brand_name )"
    )
    .eq("token", token)
    .maybeSingle();
  const invite = inviteRow as
    | {
        id: string;
        brand_id: string;
        email: string;
        role: "owner" | "admin" | "member";
        expires_at: string;
        accepted_at: string | null;
        brands?: { brand_name?: string } | null;
      }
    | null;

  if (!invite) {
    return (
      <div className="mx-auto max-w-md py-16 px-6">
        <h1 className="text-xl font-semibold">Invite not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The link is invalid or has been revoked.
        </p>
      </div>
    );
  }

  if (invite.accepted_at) {
    return (
      <div className="mx-auto max-w-md py-16 px-6">
        <h1 className="text-xl font-semibold">Invite already accepted</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          You can sign in to access the brand.
        </p>
      </div>
    );
  }

  if (new Date(invite.expires_at).getTime() < Date.now()) {
    return (
      <div className="mx-auto max-w-md py-16 px-6">
        <h1 className="text-xl font-semibold">Invite expired</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Ask the inviter to send a fresh invite.
        </p>
      </div>
    );
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Not authenticated → push them to login with a redirect back to this page
  if (!user) {
    const next = `/invite/${encodeURIComponent(token)}`;
    redirect(`/login?next=${encodeURIComponent(next)}&email=${encodeURIComponent(invite.email)}`);
  }

  // Authenticated but with a different email
  if (user.email && user.email.toLowerCase() !== invite.email.toLowerCase()) {
    return (
      <div className="mx-auto max-w-md py-16 px-6">
        <h1 className="text-xl font-semibold">Wrong account</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          This invite was sent to <strong>{invite.email}</strong>, but you are
          signed in as <strong>{user.email}</strong>. Sign out and use the
          invited email to accept.
        </p>
      </div>
    );
  }

  const brandName = invite.brands?.brand_name ?? "this brand";

  return (
    <div className="mx-auto max-w-md py-16 px-6">
      <h1 className="text-xl font-semibold">Join {brandName}</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        You&apos;ve been invited to join as <strong>{invite.role}</strong>.
      </p>
      <div className="mt-6">
        <InviteAcceptClient token={token} />
      </div>
    </div>
  );
}
