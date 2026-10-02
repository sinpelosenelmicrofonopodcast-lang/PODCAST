type Network = "facebook" | "instagram" | "tiktok" | "youtube";

export function SocialBrandIcon({ network }: { network: Network }) {
  if (network === "facebook") {
    return (
      <span className="social-brand-icon social-brand-facebook" aria-hidden="true">
        <svg viewBox="0 0 24 24" role="img">
          <path d="M13.55 21v-8.2h2.76l.42-3.2h-3.18V7.55c0-.92.26-1.55 1.6-1.55h1.7V3.14c-.3-.04-1.3-.14-2.48-.14-2.45 0-4.13 1.49-4.13 4.24V9.6H7.47v3.2h2.77V21h3.31Z" fill="currentColor" />
        </svg>
      </span>
    );
  }

  if (network === "instagram") {
    return (
      <span className="social-brand-icon social-brand-instagram" aria-hidden="true">
        <svg viewBox="0 0 24 24" role="img">
          <rect x="4" y="4" width="16" height="16" rx="5" ry="5" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="12" cy="12" r="3.7" fill="none" stroke="currentColor" strokeWidth="2" />
          <circle cx="17.4" cy="6.7" r="1.15" fill="currentColor" />
        </svg>
      </span>
    );
  }

  if (network === "tiktok") {
    return (
      <span className="social-brand-icon social-brand-tiktok" aria-hidden="true">
        <svg viewBox="0 0 24 24" role="img">
          <path d="M14.2 3.2h3.05c.3 1.72 1.36 3.02 3.05 3.55v3.06a8.36 8.36 0 0 1-3.05-.83v5.94a6.02 6.02 0 1 1-6.03-6.02c.35 0 .69.03 1.02.09v3.05a3 3 0 1 0 2.01 2.83V3.2Z" fill="currentColor" />
        </svg>
      </span>
    );
  }

  return (
    <span className="social-brand-icon social-brand-youtube" aria-hidden="true">
      <svg viewBox="0 0 24 24" role="img">
        <path d="M21.4 7.05a3.1 3.1 0 0 0-2.18-2.2C17.3 4.34 12 4.34 12 4.34s-5.3 0-7.22.51A3.1 3.1 0 0 0 2.6 7.05C2.1 8.98 2.1 12 2.1 12s0 3.02.5 4.95a3.1 3.1 0 0 0 2.18 2.2c1.92.51 7.22.51 7.22.51s5.3 0 7.22-.51a3.1 3.1 0 0 0 2.18-2.2c.5-1.93.5-4.95.5-4.95s0-3.02-.5-4.95Z" fill="currentColor" />
        <path d="m10 15.35 5.2-3.35L10 8.65v6.7Z" fill="#fff" />
      </svg>
    </span>
  );
}
