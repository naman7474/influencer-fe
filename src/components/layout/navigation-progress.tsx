"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * Thin Canva-gradient progress bar pinned to the top of the viewport.
 *
 * Two triggers:
 *   1. A click on any in-app navigation element (`<a href="/...">` or
 *      `<Link>`-rendered anchor) starts a creep animation up to ~80%.
 *   2. When `pathname` or `searchParams` change, the bar finishes to 100%
 *      and fades out.
 *
 * No dependencies, no per-link wrapper required. Works alongside Next 16's
 * `useLinkStatus()` for finer-grained per-link spinners — this one is the
 * coarse, page-level signal.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = React.useState(0);
  const [visible, setVisible] = React.useState(false);
  const creepIntervalRef = React.useRef<ReturnType<typeof setInterval> | null>(
    null,
  );
  const fadeTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const stopCreep = React.useCallback(() => {
    if (creepIntervalRef.current) {
      clearInterval(creepIntervalRef.current);
      creepIntervalRef.current = null;
    }
  }, []);

  const start = React.useCallback(() => {
    if (fadeTimeoutRef.current) {
      clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }
    setVisible(true);
    setProgress(8);
    stopCreep();
    creepIntervalRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 80) return p;
        // Slow asymptotic climb: bigger jumps when low, smaller when near 80.
        const remaining = 80 - p;
        const step = Math.max(0.5, remaining * 0.06);
        return Math.min(80, p + step);
      });
    }, 120);
  }, [stopCreep]);

  const finish = React.useCallback(() => {
    stopCreep();
    setProgress(100);
    if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    fadeTimeoutRef.current = setTimeout(() => {
      setVisible(false);
      setProgress(0);
    }, 220);
  }, [stopCreep]);

  // 1) Catch in-app anchor clicks → start creep.
  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      // Ignore modified clicks (open in new tab/window).
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      ) {
        return;
      }
      const target = (e.target as HTMLElement | null)?.closest?.(
        "a[href]",
      ) as HTMLAnchorElement | null;
      if (!target) return;
      // Skip downloads, target=_blank, off-origin, hash-only links, mailto/tel.
      if (target.target && target.target !== "_self") return;
      if (target.hasAttribute("download")) return;
      const href = target.getAttribute("href") ?? "";
      if (!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }
      try {
        const url = new URL(target.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        // Same path + query → no real navigation
        if (
          url.pathname === window.location.pathname &&
          url.search === window.location.search
        ) {
          return;
        }
      } catch {
        return;
      }
      start();
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [start]);

  // 2) On pathname/search change → finish.
  const isFirstRender = React.useRef(true);
  React.useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    finish();
  }, [pathname, searchParams, finish]);

  React.useEffect(() => {
    return () => {
      stopCreep();
      if (fadeTimeoutRef.current) clearTimeout(fadeTimeoutRef.current);
    };
  }, [stopCreep]);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]"
      style={{
        opacity: visible ? 1 : 0,
        transition: "opacity 200ms ease",
      }}
    >
      <div
        className="h-full"
        style={{
          width: `${progress}%`,
          background: "var(--gradient-canva)",
          boxShadow: "0 0 8px rgba(125, 42, 232, 0.4)",
          transition: "width 180ms cubic-bezier(0.2, 0.7, 0.2, 1)",
        }}
      />
    </div>
  );
}
