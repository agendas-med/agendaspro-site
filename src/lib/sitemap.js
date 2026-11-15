// Geração de sitemap.xml e robots.txt a partir das rotas estáticas (usado no build).
const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/**
 * @param {{path:string, changefreq?:string, priority?:number}[]} entries
 * @param {{siteUrl:string, lastmod?:string}} opts lastmod no formato YYYY-MM-DD
 */
export function buildSitemap(entries, { siteUrl, lastmod } = {}) {
  const base = String(siteUrl || '').replace(/\/+$/, '')
  const seen = new Set()
  const urls = []
  for (const e of entries) {
    const path = e.path === '/' ? '/' : `/${String(e.path).replace(/^\/+|\/+$/g, '')}`
    if (seen.has(path)) continue
    seen.add(path)
    const parts = [`    <loc>${esc(base + path)}</loc>`]
    if (lastmod) parts.push(`    <lastmod>${esc(lastmod)}</lastmod>`)
    if (e.changefreq) parts.push(`    <changefreq>${esc(e.changefreq)}</changefreq>`)
    if (typeof e.priority === 'number') parts.push(`    <priority>${e.priority.toFixed(1)}</priority>`)
    urls.push(`  <url>\n${parts.join('\n')}\n  </url>`)
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

export function buildRobots({ siteUrl }) {
  const base = String(siteUrl || '').replace(/\/+$/, '')
  return [
    'User-agent: *',
    'Allow: /',
    'Disallow: /agendamento/',
    'Disallow: /spa/',
    '',
    `Sitemap: ${base}/sitemap.xml`,
    '',
  ].join('\n')
}
