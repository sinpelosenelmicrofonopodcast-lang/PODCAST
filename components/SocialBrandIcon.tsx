type Network = "facebook" | "instagram" | "tiktok" | "youtube";

const officialLogos: Record<Network, string> = {
  facebook: "/brand/facebook.png",
  instagram: "/brand/instagram.png",
  tiktok: "/brand/tiktok.png",
  youtube: "/brand/youtube.png"
};

// Original transparent brand marks are served locally so the site's icons
// never depend on an expiring or permission-restricted Google Drive URL.
export function SocialBrandIcon({ network }: { network: Network }) {
  return (
    <span className={`social-brand-icon social-brand-${network}`} aria-hidden="true">
      <img src={officialLogos[network]} alt="" width={32} height={32} loading="eager" decoding="async" />
    </span>
  );
}
