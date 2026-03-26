import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireBrandContext } from "@/lib/queries/brand";
import { InboundClient } from "./inbound-client";

export default async function InboundPage() {
  const supabase = await createClient();
  const brand = await requireBrandContext(supabase);

  if (!brand.instagram_connected) {
    return (
      <div className="space-y-6">
        <section>
          <p className="text-xs font-medium text-muted-foreground">Inbound</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Instagram inbound creators
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Connect your Instagram Business account first to scan inbound DMs.
          </p>
        </section>
        <div className="rounded-2xl border border-dashed bg-muted/20 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Instagram is not connected for this brand yet.
          </p>
          <Link
            href="/settings"
            className="mt-4 inline-flex h-8 items-center justify-center rounded-lg bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            Open settings
          </Link>
        </div>
      </div>
    );
  }

  const { data, error } = await supabase
    .from("inbound_creators")
    .select("id, sender_handle, sender_name, sender_avatar_url, message_preview, last_message_at, status, cpi_score, match_score")
    .eq("brand_id", brand.brand_id)
    .order("last_message_at", { ascending: false });

  if (error) {
    throw error;
  }

  return <InboundClient initialRows={data ?? []} />;
}
