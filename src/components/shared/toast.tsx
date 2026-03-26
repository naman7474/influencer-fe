"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

type ToastFn = {
  (message: string, variant?: ToastVariant): void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
};

let toastId = 0;
const listeners: Set<(toast: ToastItem) => void> = new Set();

const baseToast = (message: string, variant: ToastVariant = "info") => {
  const item: ToastItem = { id: ++toastId, message, variant };
  listeners.forEach((fn) => fn(item));
};

export const toast = baseToast as ToastFn;
toast.success = (message: string) => baseToast(message, "success");
toast.error = (message: string) => baseToast(message, "error");
toast.info = (message: string) => baseToast(message, "info");

const variantStyles: Record<ToastVariant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  error: "border-rose-200 bg-rose-50 text-rose-800",
  info: "border-border bg-card text-foreground",
};

const variantIcons: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

export function Toaster() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((item: ToastItem) => {
    setToasts((prev) => [...prev.slice(-4), item]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== item.id));
    }, 3000);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  useEffect(() => {
    listeners.add(addToast);
    return () => {
      listeners.delete(addToast);
    };
  }, [addToast]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2">
      {toasts.map((item) => {
        const Icon = variantIcons[item.variant];
        return (
          <div
            key={item.id}
            className={cn(
              "flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm shadow-lg animate-in slide-in-from-bottom-2 fade-in duration-200",
              variantStyles[item.variant]
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="flex-1">{item.message}</span>
            <button
              onClick={() => removeToast(item.id)}
              className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
