import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireBrandContext } from "@/lib/queries/brand";
import { getOnboardingState } from "@/lib/queries/onboarding";
import { OnboardingClient } from "./onboarding-client";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const brand = await requireBrandContext(supabase);

  if (brand.onboarding_step >= 3) {
    redirect("/dashboard");
  }

  const onboardingState = await getOnboardingState(supabase, brand.brand_id);

  return (
    <OnboardingClient
      initialState={onboardingState}
      initialBrandName={brand.brand_name}
    />
  );
}
