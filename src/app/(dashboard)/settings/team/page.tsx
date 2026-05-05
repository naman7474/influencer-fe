import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getActiveMembership } from "@/lib/auth/membership";
import { TeamClient } from "./team-client";

export const metadata = {
  title: "Team | Settings",
};

export default async function TeamPage() {
  const ctx = await getActiveMembership();
  if (!ctx) redirect("/login");

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/settings"
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground w-fit"
      >
        <ArrowLeft className="size-4" />
        Back to Settings
      </Link>

      <div>
        <h1 className="font-serif italic text-2xl tracking-tight text-foreground">
          Team
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Invite teammates and manage their access to this brand.
        </p>
      </div>

      <TeamClient brandId={ctx.brandId} myRole={ctx.role} myUserId={ctx.userId} />
    </div>
  );
}
