"use client";

import { Gift } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarterOrderForm } from "./barter-order-form";

interface GiftingDialogProps {
  campaignId: string;
  campaignCreatorId: string;
  creatorId: string;
  creatorHandle: string;
  creatorName: string | null;
  brandId: string;
  currency: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function GiftingDialog({
  campaignId,
  campaignCreatorId,
  creatorId,
  creatorHandle,
  creatorName,
  brandId,
  currency,
  onClose,
  onSuccess,
}: GiftingDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg border bg-background p-6 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Gift className="size-5" />
            Send Barter Order
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>

        <BarterOrderForm
          campaignId={campaignId}
          campaignCreatorId={campaignCreatorId}
          creatorId={creatorId}
          creatorHandle={creatorHandle}
          creatorName={creatorName}
          brandId={brandId}
          currency={currency}
          onSuccess={onSuccess}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
