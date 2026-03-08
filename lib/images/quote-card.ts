import { escapeSvgText, svgToDataUrl } from "@/lib/images/utils";

export function buildQuoteCard(input: { quote: string; author?: string }) {
  const quote = escapeSvgText(input.quote).slice(0, 240);
  const author = escapeSvgText(input.author ?? "SPM News");

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 1080 1080">
  <defs>
    <linearGradient id="qbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#120000"/>
      <stop offset="100%" stop-color="#3f0909"/>
    </linearGradient>
  </defs>
  <rect width="1080" height="1080" fill="url(#qbg)"/>
  <rect x="56" y="56" width="968" height="968" rx="32" fill="rgba(0,0,0,0.45)" stroke="#ff6f00"/>
  <text x="88" y="170" fill="#ffcc80" font-size="62" font-family="Arial Black, Arial">“</text>
  <foreignObject x="88" y="180" width="904" height="700">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font: 700 58px/1.2 Arial, sans-serif; color: #f8f8f8;">${quote}</div>
  </foreignObject>
  <text x="88" y="960" fill="#ffd54f" font-size="40" font-family="Arial Black, Arial">${author}</text>
</svg>`.trim();

  return {
    width: 1080,
    height: 1080,
    svg,
    dataUrl: svgToDataUrl(svg)
  };
}
