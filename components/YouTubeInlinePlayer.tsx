"use client";

import { useMemo, useState } from "react";

type Props = {
  videoId: string;
  title?: string | null;
  thumbnailUrl?: string | null;
  className?: string;
};

export function YouTubeInlinePlayer({ videoId, title, thumbnailUrl, className }: Props) {
  const [playing, setPlaying] = useState(false);

  const thumb = useMemo(() => {
    if (thumbnailUrl) return thumbnailUrl;
    return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
  }, [thumbnailUrl, videoId]);

  const embedSrc = useMemo(() => {
    const qs = new URLSearchParams({
      rel: "0",
      modestbranding: "1",
      playsinline: "1"
    });
    return `https://www.youtube-nocookie.com/embed/${videoId}?${qs.toString()}`;
  }, [videoId]);

  return (
    <div className={className ?? "yt-inline"}>
      {playing ? (
        <iframe
          className="yt-iframe"
          src={embedSrc}
          title={title ?? "YouTube video"}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      ) : (
        <button
          type="button"
          className="yt-thumb"
          onClick={() => setPlaying(true)}
          aria-label="Reproducir aquí"
        >
          <img className="yt-thumb-img" src={thumb} alt={title ?? "Video"} />
          <span className="yt-play" aria-hidden="true">
            Reproducir aquí
          </span>
        </button>
      )}
    </div>
  );
}

