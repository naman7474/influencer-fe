import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

// 1×1 transparent GIF
const PIXEL = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00,
  0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21, 0xf9, 0x04, 0x01, 0x00,
  0x00, 0x00, 0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00,
  0x00, 0x02, 0x02, 0x44, 0x01, 0x00, 0x3b,
]);

const PIXEL_HEADERS = {
  "Content-Type": "image/gif",
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
  Pragma: "no-cache",
  Expires: "0",
};

/**
 * GET /api/track/open/[messageId]
 * Records an email open event and returns a 1×1 transparent GIF.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;

    if (!messageId) {
      return new NextResponse(PIXEL, { headers: PIXEL_HEADERS });
    }

    const supabase = await createServerSupabaseClient();

    // Fetch the message to check if this is the first open
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: messageRow } = await (supabase as any)
      .from("outreach_messages")
      .select("id, opened_at, thread_id, brand_id")
      .eq("id", messageId)
      .single();

    const message = messageRow as { id: string; opened_at: string | null; thread_id: string | null; brand_id: string } | null;
    if (message) {
      // Increment open count
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase as any).rpc("increment_open_count", { msg_id: messageId });

      // If first open, set opened_at and update status
      if (!message.opened_at) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("outreach_messages")
          .update({
            opened_at: new Date().toISOString(),
            status: "opened",
          })
          .eq("id", messageId);

        // Update thread outreach_status (only upgrade, never downgrade)
        if (message.thread_id) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from("message_threads")
            .update({ outreach_status: "opened" })
            .eq("id", message.thread_id)
            .in("outreach_status", ["sent"]);
        }
      }
    }
  } catch (err) {
    // Silently fail — don't break email rendering
    console.error("Track open error:", err);
  }

  // Always return the pixel, even on error
  return new NextResponse(PIXEL, { headers: PIXEL_HEADERS });
}
