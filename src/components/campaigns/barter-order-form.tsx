"use client";

import { useCallback, useEffect, useState } from "react";
import { Gift, Loader2, Package, Search } from "lucide-react";
import { formatCurrency } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface BarterOrderFormProps {
  campaignId: string;
  campaignCreatorId: string;
  creatorId: string;
  creatorHandle: string;
  creatorName?: string | null;
  brandId: string;
  currency: string;
  onSuccess: () => void;
  onCancel?: () => void;
  /** Hide the "Sending to" header when used inline in a creator panel. */
  hideRecipient?: boolean;
}

interface BrandProduct {
  id: string;
  shopify_product_id: string;
  title: string;
  product_type: string | null;
  image_url: string | null;
  min_price: number | null;
  max_price: number | null;
  variants: string | null;
  status: string;
}

interface Variant {
  id: string;
  title: string;
  price: string;
  sku?: string;
  inventory_quantity?: number;
  available?: boolean;
}

export function BarterOrderForm({
  campaignId,
  campaignCreatorId,
  creatorId,
  creatorHandle,
  creatorName,
  brandId,
  currency,
  onSuccess,
  onCancel,
  hideRecipient = false,
}: BarterOrderFormProps) {
  const [products, setProducts] = useState<BrandProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<BrandProduct | null>(
    null,
  );
  const [selectedVariant, setSelectedVariant] = useState<Variant | null>(null);
  const [address, setAddress] = useState({
    address: "",
    city: "",
    state: "",
    pin: "",
    phone: "",
    country: "IN",
  });
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchProducts() {
      try {
        const res = await fetch(`/api/brands/${brandId}/products`);
        if (res.ok) {
          const data = await res.json();
          setProducts(data.products ?? []);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchProducts();
  }, [brandId]);

  const filteredProducts = products.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const variants: Variant[] = selectedProduct?.variants
    ? (() => {
        try {
          return JSON.parse(selectedProduct.variants);
        } catch {
          return [];
        }
      })()
    : [];

  const handleSubmit = useCallback(async () => {
    if (!selectedProduct) return;
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`/api/campaigns/${campaignId}/gifting`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignCreatorId,
          creatorId,
          productTitle: selectedProduct.title,
          variantId: selectedVariant?.id || null,
          retailValue: selectedVariant
            ? parseFloat(selectedVariant.price)
            : selectedProduct.min_price ?? 0,
          shippingAddress: address.address.trim() ? address : null,
          note: note.trim() || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "Failed to create barter order.");
        return;
      }

      onSuccess();
    } catch {
      setError("Failed to create barter order. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [
    campaignId,
    campaignCreatorId,
    creatorId,
    selectedProduct,
    selectedVariant,
    address,
    note,
    onSuccess,
  ]);

  return (
    <div className="flex flex-col gap-4">
      {!hideRecipient && (
        <p className="text-sm text-muted-foreground">
          Sending to:{" "}
          <span className="font-handle font-semibold">@{creatorHandle}</span>
          {creatorName && ` (${creatorName})`}
        </p>
      )}

      {/* Product Selection */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium">Select Product</label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded border bg-background pl-8 pr-3 py-2 text-sm"
          />
        </div>

        {loading ? (
          <div className="py-4 text-center">
            <Loader2 className="size-4 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No products found. Sync your product catalog first.
          </p>
        ) : (
          <div className="max-h-40 overflow-y-auto flex flex-col gap-1">
            {filteredProducts.slice(0, 20).map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => {
                  setSelectedProduct(p);
                  setSelectedVariant(null);
                }}
                className={`flex items-center gap-3 rounded-lg border px-3 py-2 cursor-pointer transition-colors text-left ${
                  selectedProduct?.id === p.id
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <Package className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.min_price
                      ? formatCurrency(p.min_price, currency)
                      : "--"}
                    {p.product_type && ` · ${p.product_type}`}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Variant Selection */}
      {selectedProduct && variants.length > 1 && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">Variant</label>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <Badge
                key={v.id}
                variant="secondary"
                className={`cursor-pointer ${
                  selectedVariant?.id === v.id
                    ? "border-primary bg-primary/10"
                    : ""
                }`}
                onClick={() => setSelectedVariant(v)}
              >
                {v.title} — {formatCurrency(parseFloat(v.price), currency)}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Shipping Address */}
      {selectedProduct && (
        <Card>
          <CardContent className="flex flex-col gap-3">
            <label className="text-sm font-medium">
              Shipping Address (optional)
            </label>
            <input
              type="text"
              placeholder="Address line"
              value={address.address}
              onChange={(e) =>
                setAddress((a) => ({ ...a, address: e.target.value }))
              }
              className="w-full rounded border bg-background px-3 py-1.5 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="City"
                value={address.city}
                onChange={(e) =>
                  setAddress((a) => ({ ...a, city: e.target.value }))
                }
                className="rounded border bg-background px-3 py-1.5 text-sm"
              />
              <input
                type="text"
                placeholder="State"
                value={address.state}
                onChange={(e) =>
                  setAddress((a) => ({ ...a, state: e.target.value }))
                }
                className="rounded border bg-background px-3 py-1.5 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="PIN code"
                value={address.pin}
                onChange={(e) =>
                  setAddress((a) => ({ ...a, pin: e.target.value }))
                }
                className="rounded border bg-background px-3 py-1.5 text-sm"
              />
              <input
                type="text"
                placeholder="Phone"
                value={address.phone}
                onChange={(e) =>
                  setAddress((a) => ({ ...a, phone: e.target.value }))
                }
                className="rounded border bg-background px-3 py-1.5 text-sm"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Note */}
      {selectedProduct && (
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium">
            Note to Creator (optional)
          </label>
          <textarea
            placeholder="Hi! Here's our product to try..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            className="w-full rounded border bg-background px-3 py-1.5 text-sm resize-none"
          />
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Actions */}
      <div className="flex justify-end gap-2">
        {onCancel && (
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button
          onClick={handleSubmit}
          disabled={!selectedProduct || submitting}
        >
          {submitting ? (
            <Loader2 className="size-3.5 animate-spin mr-1" />
          ) : (
            <Gift className="size-3.5 mr-1" />
          )}
          {submitting ? "Creating..." : "Send Barter Order"}
        </Button>
      </div>
    </div>
  );
}
