"use client";

import { useState } from "react";

type ShareButtonsProps = {
  path: string;
  text: string;
};

export function ShareButtons({ path, text }: ShareButtonsProps) {
  const [copied, setCopied] = useState(false);

  const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(text);

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: text, text, url });
        return;
      } catch {
        // ignore
      }
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  return (
    <div className="share">
      <button className="share-btn" type="button" onClick={handleShare} title="Compartir" aria-label="Compartir">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M16 8a3 3 0 1 0-2.83-4H13a3 3 0 0 0 0 6h.17A3 3 0 0 0 16 8ZM8 14a3 3 0 1 0 2.83 4H11a3 3 0 0 0 0-6h-.17A3 3 0 0 0 8 14Zm8 1a3 3 0 0 0-2.24 1.02l-4.1-2.46a4.98 4.98 0 0 0 0-3.12l4.1-2.46A3 3 0 1 0 13 6a2.98 2.98 0 0 0 .24 1.18l-4.1 2.46a3 3 0 1 0 0 5.72l4.1 2.46A3 3 0 1 0 16 15Z"
            fill="currentColor"
          />
        </svg>
      </button>
      <a
        className="share-btn"
        href={`https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`}
        target="_blank"
        rel="noreferrer"
        title="Facebook"
        aria-label="Compartir en Facebook"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M13 9h3V6h-3c-2.21 0-4 1.79-4 4v2H7v3h2v6h3v-6h3l1-3h-4v-2c0-.55.45-1 1-1Z"
            fill="currentColor"
          />
        </svg>
      </a>
      <a
        className="share-btn"
        href={`https://wa.me/?text=${encodedText}%20${encodedUrl}`}
        target="_blank"
        rel="noreferrer"
        title="WhatsApp"
        aria-label="Compartir en WhatsApp"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M20.52 3.48A11.9 11.9 0 0 0 12.05 0C5.5 0 .2 5.3.2 11.85c0 2.08.54 4.12 1.57 5.93L0 24l6.36-1.68a11.83 11.83 0 0 0 5.69 1.45h.01c6.55 0 11.85-5.3 11.85-11.85 0-3.16-1.23-6.13-3.39-8.29ZM12.05 21.3a9.4 9.4 0 0 1-4.8-1.31l-.34-.2-3.77.99 1-3.67-.22-.36a9.37 9.37 0 1 1 8.13 4.55Zm5.47-7.01c-.3-.15-1.77-.87-2.05-.97-.28-.1-.48-.15-.68.15-.2.3-.78.97-.96 1.17-.18.2-.36.23-.66.08-.3-.15-1.27-.47-2.42-1.5-.9-.8-1.5-1.8-1.68-2.1-.18-.3-.02-.47.13-.62.13-.13.3-.36.45-.54.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.07-.15-.68-1.64-.93-2.24-.24-.58-.49-.5-.68-.51l-.58-.01c-.2 0-.53.08-.8.38-.27.3-1.05 1.03-1.05 2.52s1.08 2.93 1.23 3.13c.15.2 2.12 3.24 5.14 4.55.72.31 1.28.5 1.72.64.72.23 1.37.2 1.88.12.57-.08 1.77-.72 2.02-1.42.25-.7.25-1.3.18-1.42-.07-.12-.28-.2-.58-.35Z"
            fill="currentColor"
          />
        </svg>
      </a>
      <a
        className="share-btn"
        href={`https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`}
        target="_blank"
        rel="noreferrer"
        title="X"
        aria-label="Compartir en X"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M18.2 3H21l-6.3 7.2L22 21h-6.7l-4.2-5.4L5.8 21H3l6.7-7.7L2 3h6.9l3.8 4.9L18.2 3Zm-1 16h1.6L8.6 5H7L17.2 19Z"
            fill="currentColor"
          />
        </svg>
      </a>
      <a
        className="share-btn"
        href={`https://t.me/share/url?url=${encodedUrl}&text=${encodedText}`}
        target="_blank"
        rel="noreferrer"
        title="Telegram"
        aria-label="Compartir en Telegram"
      >
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M21.9 2.1c.3-.3.7-.1.6.3l-3.6 17.4c-.1.4-.5.6-.9.4l-5.1-2.9-2.5 2.4c-.3.3-.8.2-.8-.3l.1-3.8 8.8-8.2c.3-.3 0-.7-.4-.5l-11 6.8-4.7-1.5c-.5-.2-.5-.8 0-1l19.5-9.1Z"
            fill="currentColor"
          />
        </svg>
      </a>
      <button className="share-btn" type="button" onClick={handleCopy} title="Copiar link" aria-label="Copiar link">
        {copied ? (
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path d="M9.2 16.2 4.8 11.8l-1.6 1.6 6 6 12-12-1.6-1.6-10 10Z" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <path
              d="M8 8V5a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v6a3 3 0 0 1-3 3h-3v-2h3a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v3H8Zm-3 4h6a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-6a1 1 0 0 1 1-1Zm1 2v4h4v-4H6Z"
              fill="currentColor"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
