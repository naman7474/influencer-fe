import { createServiceRoleClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/gmail";

function getAppUrl(): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"
  );
}

export function inviteAcceptUrl(token: string): string {
  return `${getAppUrl().replace(/\/$/, "")}/invite/${encodeURIComponent(token)}`;
}

/**
 * Send the invite email. Currently routes through the inviting brand's
 * connected Gmail; if Gmail isn't connected, the function returns
 * gracefully so the invite still exists and can be shared via "copy link"
 * from the UI.
 */
export async function sendInviteEmail(args: {
  brandId: string;
  to: string;
  token: string;
  invitedByName: string;
}): Promise<{ delivered: boolean; reason?: string }> {
  const svc = createServiceRoleClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: brandRow } = await (svc as any)
    .from("brands")
    .select("brand_name, gmail_connected, gmail_email")
    .eq("id", args.brandId)
    .maybeSingle();

  const brand = brandRow as
    | { brand_name: string; gmail_connected: boolean; gmail_email: string | null }
    | null;
  if (!brand?.gmail_connected || !brand.gmail_email) {
    return { delivered: false, reason: "gmail_not_connected" };
  }

  const acceptUrl = inviteAcceptUrl(args.token);
  const html = `
    <p>Hi,</p>
    <p>${escapeHtml(args.invitedByName)} invited you to collaborate on
    <strong>${escapeHtml(brand.brand_name)}</strong>.</p>
    <p>
      <a href="${acceptUrl}" style="display:inline-block;padding:10px 16px;background:#000;color:#fff;border-radius:6px;text-decoration:none">
        Accept invite
      </a>
    </p>
    <p style="color:#666;font-size:12px">
      Or paste this link into your browser:<br>${acceptUrl}<br><br>
      This invite expires in 7 days.
    </p>
  `;

  try {
    await sendEmail(args.brandId, {
      to: args.to,
      subject: `Join ${brand.brand_name} on the platform`,
      body: html,
    });
    return { delivered: true };
  } catch (err) {
    const msg = (err as Error).message ?? "send_failed";
    const reason = /invalid_grant|expired or revoked|refresh failed/i.test(msg)
      ? "gmail_token_expired"
      : "send_failed";
    console.error("invite email send failed", msg);
    return { delivered: false, reason };
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
