// Presentation only: preserve the approved article and all original source URLs.
export function newsSources(raw: string, primary: string) {
  let body = raw;
  const sourceUrls = primary ? [primary] : [];
  const footer = /\n\s*\n(?:Fuentes|Sources):\s*\n([\s\S]+)$/i.exec(raw);
  if (footer) {
    const lines = footer[1].split(/\n/).map(line => line.trim()).filter(Boolean);
    const urls = lines.map(line => line.match(/https?:\/\/\S+$/)?.[0]);
    // Only remove a footer when every line is an attributable source link.
    if (lines.length && urls.every(Boolean)) {
      body = raw.slice(0, footer.index).trimEnd();
      sourceUrls.push(...urls.filter((url): url is string => !!url));
    }
  }
  return { body, sourceUrls: [...new Set(sourceUrls)].filter(url => {
    try { const parsed = new URL(url); return ['https:', 'http:'].includes(parsed.protocol) && !parsed.username && !parsed.password; }
    catch { return false; }
  }) };
}
