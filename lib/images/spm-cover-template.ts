import { escapeSvgText, svgToDataUrl } from "@/lib/images/utils";

export function buildSpmCoverTemplate(input: { title: string; kicker?: string; brand?: string }) {
  const title = escapeSvgText(input.title);
  const kicker = escapeSvgText(input.kicker ?? "ÚLTIMA HORA");
  const brand = escapeSvgText(input.brand ?? "SIN PELOS EN EL MICRÓFONO");

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#090909"/>
      <stop offset="60%" stop-color="#2a0505"/>
      <stop offset="100%" stop-color="#6a0f00"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#bg)"/>
  <rect x="36" y="36" width="1208" height="648" rx="24" fill="rgba(0,0,0,0.35)" stroke="rgba(255,110,0,0.4)"/>
  <rect x="72" y="72" width="300" height="56" rx="28" fill="#ff3d00"/>
  <text x="222" y="109" text-anchor="middle" fill="#ffd54f" font-family="Arial Black, Arial" font-size="30">${kicker}</text>
  <text x="72" y="210" fill="#f4f4f4" font-family="Arial Black, Arial" font-size="72">${title.slice(0, 64)}</text>
  <text x="72" y="670" fill="#ffcc80" font-family="Arial Black, Arial" font-size="36">${brand}</text>
</svg>`.trim();

  return {
    width: 1280,
    height: 720,
    svg,
    dataUrl: svgToDataUrl(svg)
  };
}
