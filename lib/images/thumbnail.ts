import { escapeSvgText, svgToDataUrl } from "@/lib/images/utils";

export function buildThumbnail(input: { title: string; subtitle?: string }) {
  const title = escapeSvgText(input.title).slice(0, 80);
  const subtitle = escapeSvgText(input.subtitle ?? "Sin Pelos").slice(0, 120);

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#160000"/>
  <rect x="30" y="30" width="1220" height="660" rx="30" fill="#2e0d0d" stroke="#ff6f00"/>
  <text x="70" y="220" fill="#fff" font-size="72" font-family="Arial Black, Arial">${title}</text>
  <text x="70" y="640" fill="#ffd54f" font-size="36" font-family="Arial, sans-serif">${subtitle}</text>
</svg>`.trim();

  return {
    width: 1280,
    height: 720,
    svg,
    dataUrl: svgToDataUrl(svg)
  };
}
