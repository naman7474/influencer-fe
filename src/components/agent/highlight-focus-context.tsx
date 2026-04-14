"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface HighlightFocusValue {
  /** toolCallId of highlight currently requested to focus (panel watches & clears). */
  focusId: string | null;
  /** request focus; panel will scroll + flash and then clear. */
  focusHighlight: (id: string) => void;
  /** called by panel after it's finished the focus animation */
  clearFocus: () => void;
  /** resolve an @handle → highlight id using the current highlights list */
  resolveHandle: (handle: string) => string | null;
  /** registered by the panel/page so handle-pills can do handle → id lookups */
  setHandleResolver: (
    fn: ((handle: string) => string | null) | null
  ) => void;
}

const Ctx = createContext<HighlightFocusValue | null>(null);

export function HighlightFocusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [focusId, setFocusId] = useState<string | null>(null);
  const [handleResolver, setHandleResolverState] = useState<
    ((handle: string) => string | null) | null
  >(null);

  const focusHighlight = useCallback((id: string) => {
    setFocusId(id);
  }, []);

  const clearFocus = useCallback(() => {
    setFocusId(null);
  }, []);

  const resolveHandle = useCallback(
    (handle: string): string | null => {
      if (!handleResolver) return null;
      return handleResolver(handle);
    },
    [handleResolver]
  );

  // wrap setter in a callback that accepts a fn or null without triggering
  // React's lazy-init path (passing a function to setState would call it)
  const setHandleResolver = useCallback(
    (fn: ((handle: string) => string | null) | null) => {
      setHandleResolverState(() => fn);
    },
    []
  );

  const value = useMemo<HighlightFocusValue>(
    () => ({
      focusId,
      focusHighlight,
      clearFocus,
      resolveHandle,
      setHandleResolver,
    }),
    [focusId, focusHighlight, clearFocus, resolveHandle, setHandleResolver]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useHighlightFocus(): HighlightFocusValue {
  const ctx = useContext(Ctx);
  if (!ctx) {
    // Degrade gracefully when used outside provider (e.g. ChatPanel Sheet):
    // pills still render as non-interactive styled elements.
    return {
      focusId: null,
      focusHighlight: () => {},
      clearFocus: () => {},
      resolveHandle: () => null,
      setHandleResolver: () => {},
    };
  }
  return ctx;
}
