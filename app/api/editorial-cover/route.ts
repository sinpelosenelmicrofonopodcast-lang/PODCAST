import { NextRequest, NextResponse } from "next/server";

function xmlText(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

function wrapTitle(title: string): string[] {
  const words = title.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current && (current + " " + word).length > 30) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) lines.push(current);
  return lines.slice(0, 4);
}

function drawing(theme: string): string {
  if (theme === "bosque") return `
    <path d="M855 510 1000 260 1145 510Z" stroke="#FFC689" stroke-width="10" fill="#FF6600" fill-opacity=".17"/>
    <path d="m890 520 75-165 75 165M970 520l90-220 105 220" fill="none" stroke="#FF6600" stroke-width="12"/>
    <path d="M1018 530V445m-45 18 45-90 45 90h-90z" fill="#FF6600" fill-opacity=".55" stroke="#F9B57D" stroke-width="7"/>
  `;
  if (theme === "incendio") return `
    <path d="M1020 250c85 100-15 100 70 210 50 68-5 123-80 123-83 0-126-57-94-124 24-49 75-74 64-130 33 19 42 39 40 65 32-45 18-87 0-144Z" fill="#FF6600" fill-opacity=".65" stroke="#FFD49A" stroke-width="9"/>
    <path d="M1003 430c35 50-19 52-8 112 30 20 77 0 70-44-8-23-31-45-34-83Z" fill="#FFE2AF"/>
  `;
  if (theme === "puente") return `
    <path d="M855 520h320M885 365v155m250-155v155M885 385q125 180 250 0M885 390h250" stroke="#F9B57D" stroke-width="10" fill="none"/>
    <path d="M885 420h250M900 420l-15-30m55 30-12-6m72 6-4-3m65 3 18-8m35 8 21-30" stroke="#FF6600" stroke-width="7"/>
    <path d="M810 540h410" stroke="#FF6600" stroke-width="24" stroke-linecap="round"/>
  `;
  return `
    <path d="M840 540h345M870 540V415h80v125m22 0V335h78v205m24 0V390h75v150" stroke="#FFC689" stroke-width="9" fill="#FF6600" fill-opacity=".14"/>
    <path d="m860 440 100-100 100 100" fill="none" stroke="#FF6600" stroke-width="17"/>
    <circle cx="1060" cy="290" r="60" stroke="#FF6600" stroke-width="10" fill="none"/>
  `;
}

export function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams;
  const title = (query.get("title") || "Noticias Sin Pelos").trim().slice(0, 148);
  const region = (query.get("region") || "NOTICIAS").replace(/[^\p{L}\p{N}\s/-]/gu, "").slice(0, 32).toUpperCase();
  const theme = (query.get("theme") || "ciudad").toLowerCase();
  const lines = wrapTitle(title).map((line, i) => `<text x="85" y="${254 + i * 71}" fill="#FFFFFF" font-size="${line.length > 30 ? 47 : 51}" font-weight="900" font-family="Arial, Helvetica, sans-serif">${xmlText(line)}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1280 720" width="1280" height="720" role="img" aria-label="${xmlText(title)}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#080808"/><stop offset="1" stop-color="#24110A"/></linearGradient>
      <radialGradient id="glow"><stop stop-color="#FF6600" stop-opacity=".42"/><stop offset="1" stop-color="#FF6600" stop-opacity="0"/></radialGradient>
    </defs>
    <rect width="1280" height="720" fill="url(#bg)"/>
    <circle cx="1090" cy="415" r="300" fill="url(#glow)"/>
    <path d="M0 0h20v720H0zM0 687h1280v33H0z" fill="#FF6600"/>
    <path d="M815 95h400M845 115h330M860 135h310" stroke="#FF6600" stroke-opacity=".22" stroke-width="6"/>
    <rect x="83" y="70" width="238" height="57" rx="9" fill="#FF6600"/>
    <text x="104" y="109" fill="#080808" font-size="35" font-weight="900" font-family="Arial, Helvetica, sans-serif">SIN PELOS</text>
    <text x="344" y="110" fill="#FFFFFF" font-size="35" font-weight="900" font-family="Arial, Helvetica, sans-serif">NOTICIAS</text>
    <path d="M84 152h690" stroke="#FF6600" stroke-width="5"/>
    <text x="85" y="198" fill="#FFB36C" font-size="29" font-weight="800" font-family="Arial, Helvetica, sans-serif">${xmlText(region)}</text>
    ${lines}
    ${drawing(theme)}
    <rect x="82" y="628" width="1115" height="2" fill="#FF6600" fill-opacity=".65"/>
    <text x="86" y="661" fill="#E8CFBD" font-size="20" font-weight="700" font-family="Arial, Helvetica, sans-serif">ILUSTRACIÓN EDITORIAL · SINPELOSENELMICROFONO.COM</text>
    <text x="1180" y="662" text-anchor="end" fill="#FF6600" font-size="23" font-weight="900" font-family="Arial, Helvetica, sans-serif">SPM</text>
  </svg>`;
  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; sandbox"
    }
  });
}
