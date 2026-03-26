import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Toaster } from "@/components/shared/toast";
import { getBrandContext } from "@/lib/queries/brand";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const brand = await getBrandContext(supabase);

  if (!brand || brand.onboarding_step < 3) {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen bg-background">
      <Sidebar showInbound={brand.instagram_connected} />
      <div className="lg:pl-60">
        <Topbar />
        <main className="px-4 py-6 lg:px-6">{children}</main>
      </div>
      <Toaster />
    </div>
  );
}
