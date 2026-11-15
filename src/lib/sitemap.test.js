import { describe, it, expect } from 'vitest'
import { buildSitemap, buildRobots } from './sitemap.js'
import { sitemapEntries, prerenderPaths } from '../routes/routes.js'

describe('buildSitemap', () => {
  const siteUrl = 'https://exemplo.test/'

  it('gera XML válido com loc absoluta, lastmod, changefreq e priority', () => {
    const xml = buildSitemap(
      [
        { path: '/', changefreq: 'weekly', priority: 1 },
        { path: '/precos', priority: 0.8 },
      ],
      { siteUrl, lastmod: '2026-01-15' },
    )
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">')
    expect(xml).toContain('<loc>https://exemplo.test/</loc>')
    expect(xml).toContain('<loc>https://exemplo.test/precos</loc>')
    expect(xml).toContain('<lastmod>2026-01-15</lastmod>')
    expect(xml).toContain('<changefreq>weekly</changefreq>')
    expect(xml).toContain('<priority>1.0</priority>')
    expect(xml).toContain('<priority>0.8</priority>')
  })

  it('remove duplicadas e normaliza barras', () => {
    const xml = buildSitemap([{ path: '/a/' }, { path: 'a' }, { path: '/a' }], { siteUrl })
    expect(xml.match(/<loc>/g)).toHaveLength(1)
    expect(xml).toContain('<loc>https://exemplo.test/a</loc>')
  })

  it('escapa caracteres especiais do XML', () => {
    const xml = buildSitemap([{ path: '/x?a=1&b=2' }], { siteUrl })
    expect(xml).toContain('&amp;')
    expect(xml).not.toContain('a=1&b=2')
  })
})

describe('buildRobots', () => {
  it('permite o site, bloqueia áreas privadas e aponta o sitemap', () => {
    const txt = buildRobots({ siteUrl: 'https://exemplo.test/' })
    expect(txt).toContain('User-agent: *')
    expect(txt).toContain('Allow: /')
    expect(txt).toContain('Disallow: /agendamento/')
    expect(txt).toContain('Sitemap: https://exemplo.test/sitemap.xml')
  })
})

describe('rotas do sitemap', () => {
  it('inclui páginas de marketing e nichos, e exclui rotas SPA/404', () => {
    const paths = sitemapEntries().map((e) => e.path)
    expect(paths).toContain('/')
    expect(paths).toContain('/precos')
    expect(paths).toContain('/recursos')
    expect(paths).toContain('/integracoes')
    expect(paths).toContain('/para/clinicas')
    expect(paths).toContain('/para/barbearia')
    expect(paths).toContain('/termos')
    expect(paths.some((p) => p.startsWith('/b/'))).toBe(false)
    expect(paths.some((p) => p.startsWith('/agendamento'))).toBe(false)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('o prerender cobre as mesmas páginas do sitemap', () => {
    const pre = prerenderPaths()
    for (const e of sitemapEntries()) expect(pre).toContain(e.path)
  })
})
