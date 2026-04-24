"use client";

import { useState } from "react";

interface FallbackImgProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallback: React.ReactNode;
}

/**
 * An <img> that renders `fallback` when the image fails to load.
 */
export function FallbackImg({ fallback, ...imgProps }: FallbackImgProps) {
  const [failed, setFailed] = useState(false);

  if (failed) return <>{fallback}</>;

  return (
    <img
      {...imgProps}
      onError={(e) => {
        setFailed(true);
        imgProps.onError?.(e);
      }}
    />
  );
}
