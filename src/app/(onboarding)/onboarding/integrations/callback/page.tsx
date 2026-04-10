"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Check, XCircle, Loader2 } from "lucide-react";

export default function IntegrationsCallbackPage() {
  return (
    <Suspense>
      <CallbackContent />
    </Suspense>
  );
}

function CallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const [status, setStatus] = useState<"loading" | "success" | "error">(
    "loading"
  );
  const [message, setMessage] = useState("Processing your connection...");

  useEffect(() => {
    async function handleCallback() {
      const connectionStatus = searchParams.get("status");
      const errorMsg = searchParams.get("error");

      if (connectionStatus === "error" || errorMsg) {
        setStatus("error");
        setMessage(errorMsg || "Connection failed. Please try again.");
        setTimeout(() => {
          router.push("/onboarding/integrations");
        }, 3000);
        return;
      }

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          setStatus("error");
          setMessage("Session expired. Please sign in again.");
          setTimeout(() => {
            router.push("/login");
          }, 2000);
          return;
        }

        // Update the brand record to mark Shopify as connected
        const { error: updateError } = await supabase
          .from("brands")
          .update({ shopify_connected: true } as never)
          .eq("auth_user_id", user.id);

        if (updateError) {
          setStatus("error");
          setMessage("Failed to save connection status. Please try again.");
          setTimeout(() => {
            router.push("/onboarding/integrations");
          }, 3000);
          return;
        }

        setStatus("success");
        setMessage("Shopify connected successfully!");

        setTimeout(() => {
          router.push("/onboarding/integrations");
        }, 2000);
      } catch {
        setStatus("error");
        setMessage("Something went wrong. Redirecting...");
        setTimeout(() => {
          router.push("/onboarding/integrations");
        }, 3000);
      }
    }

    handleCallback();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex flex-col items-center gap-4 text-center">
        {status === "loading" && (
          <div className="flex size-14 items-center justify-center rounded-full bg-muted">
            <Loader2 className="size-7 animate-spin text-primary" />
          </div>
        )}
        {status === "success" && (
          <div className="flex size-14 items-center justify-center rounded-full bg-success/10">
            <Check className="size-7 text-success" />
          </div>
        )}
        {status === "error" && (
          <div className="flex size-14 items-center justify-center rounded-full bg-destructive/10">
            <XCircle className="size-7 text-destructive" />
          </div>
        )}

        <div className="space-y-1">
          <h2 className="text-lg font-heading font-semibold">{message}</h2>
          <p className="text-sm text-muted-foreground">
            {status === "loading"
              ? "Please wait while we verify..."
              : "Redirecting you back..."}
          </p>
        </div>
      </div>
    </div>
  );
}
