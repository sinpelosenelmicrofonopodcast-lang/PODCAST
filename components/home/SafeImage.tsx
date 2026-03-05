"use client";

import { useMemo, useState } from "react";
import { normalizeImageUrl } from "@/lib/imageUrl";

export function SafeImage({
  src,
  alt,
  loading = "lazy",
  className,
  fallbackClassName = "home-media-image-fallback"
}: {
  src: string | null | undefined;
  alt: string;
  loading?: "lazy" | "eager";
  className?: string;
  fallbackClassName?: string;
}) {
  const normalized = useMemo(() => normalizeImageUrl(src), [src]);
  const [failed, setFailed] = useState<boolean>(!normalized);

  if (!normalized || failed) {
    return <div className={fallbackClassName} aria-hidden="true" />;
  }

  return (
    <img
      src={normalized}
      alt={alt}
      loading={loading}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
