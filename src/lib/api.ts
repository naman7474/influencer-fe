import { NextResponse } from "next/server";
import type { ApiEnvelope, ApiErrorPayload, ApiMeta } from "@/types/api";

function buildMeta(meta?: ApiMeta): ApiMeta {
  return {
    generated_at: new Date().toISOString(),
    request_id: crypto.randomUUID(),
    ...meta,
  };
}

export function apiOk<T>(
  data: T,
  meta?: ApiMeta,
  status = 200
): NextResponse<ApiEnvelope<T>> {
  return NextResponse.json(
    {
      data,
      meta: buildMeta(meta),
      error: null,
    },
    { status }
  );
}

export function apiError(
  status: number,
  error: ApiErrorPayload,
  meta?: ApiMeta
): NextResponse<ApiEnvelope<null>> {
  return NextResponse.json(
    {
      data: null,
      meta: buildMeta(meta),
      error,
    },
    { status }
  );
}

export function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean);
}

export function paiseToCurrency(
  value: number | null | undefined
): number | null {
  if (value == null || Number.isNaN(value)) {
    return null;
  }

  return Number((value / 100).toFixed(2));
}

export function currencyToPaise(
  value: number | string | null | undefined
): number | null {
  if (value == null || value === "") {
    return null;
  }

  const numericValue =
    typeof value === "number" ? value : Number.parseFloat(String(value));

  if (Number.isNaN(numericValue)) {
    return null;
  }

  return Math.round(numericValue * 100);
}
