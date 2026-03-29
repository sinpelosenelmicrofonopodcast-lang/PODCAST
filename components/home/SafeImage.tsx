"use client";

import { useEffect, useMemo, useState } from "react";
import { buildImageFallbackUrl, buildRenderableImageUrl } from "@/lib/imageUrl";

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
  const fallbackSrc = useMemo(() => buildImageFallbackUrl(alt), [alt]);
  const primarySrc = useMemo(() => buildRenderableImageUrl(src, alt), [src, alt]);
  const [currentSrc, setCurrentSrc] = useState<string>(primarySrc || fallbackSrc);

  useEffect(() => {
    setCurrentSrc(primarySrc || fallbackSrc);
  }, [primarySrc, fallbackSrc]);

  return (
    <>
      <img
        src={currentSrc}
        alt={alt}
        loading={loading}
        className={className}
        onError={() => {
          if (currentSrc !== fallbackSrc) setCurrentSrc(fallbackSrc);
        }}
      />
      <noscript>
        <img src={primarySrc || fallbackSrc} alt={alt} loading={loading} className={className ?? fallbackClassName} />
      </noscript>
    </>
  );
}
