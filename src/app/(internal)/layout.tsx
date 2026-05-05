import { notFound } from "next/navigation";
import { requireInternalAdmin } from "@/lib/internal/admin-guard";

export default async function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireInternalAdmin();
  if (!admin) notFound();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="border-b border-border bg-muted/30 px-6 py-2 text-xs text-muted-foreground">
        Internal admin · {admin}
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}
