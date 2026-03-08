import { escapeSvgText, svgToDataUrl } from "@/lib/images/utils";

export function buildMemeTemplate(input: { top: string; bottom: string }) {
  const top = escapeSvgText(input.top).slice(0, 90);
  const bottom = escapeSvgText(input.bottom).slice(0, 120);

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350" viewBox="0 0 1080 1350">
  <rect width="1080" height="1350" fill="#111"/>
  <rect x="40" y="40" width="1000" height="1270" fill="#222" stroke="#ff6f00"/>
  <text x="540" y="140" text-anchor="middle" fill="#fff" font-size="68" font-family="Impact, Arial Black, Arial" stroke="#000" stroke-width="4">${top}</text>
  <text x="540" y="1230" text-anchor="middle" fill="#fff" font-size="68" font-family="Impact, Arial Black, Arial" stroke="#000" stroke-width="4">${bottom}</text>
</svg>`.trim();

  return {
    width: 1080,
    height: 1350,
    svg,
    dataUrl: svgToDataUrl(svg)
  };
}
