import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { ApprovalsClient } from "./approvals-client";

export const metadata = {
  title: "Approvals | CreatorGoose",
};

export default async function ApprovalsPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  const { data: brandRow } = await supabase
    .from("brands")
    .select("id, agent_enabled")
    .eq("auth_user_id", user.id)
    .single();
  const brand = brandRow as { id: string; agent_enabled: boolean } | null;

  if (!brand?.agent_enabled) {
    redirect("/settings");
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Approvals
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review and approve actions proposed by your AI agent.
        </p>
      </div>

      <ApprovalsClient brandId={brand.id} />
    </div>
  );
}
