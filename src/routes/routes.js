// Tabela única de rotas. `prerender: true` => página de marketing gerada em HTML estático no build
// (e incluída no sitemap). `/b/:slug` e `/agendamento/:token` são SPA (shell vazio + fallback do host).
import { niches } from '../data/niches.js'

export const routes = [
  {
    path: '/',
    name: 'home',
    component: () => import('../pages/HomePage.vue'),
    meta: { prerender: true, sitemap: { changefreq: 'weekly', priority: 1 } },
  },
  {
    path: '/precos',
    name: 'pricing',
    component: () => import('../pages/PricingPage.vue'),
    meta: { prerender: true, sitemap: { changefreq: 'monthly', priority: 0.9 } },
  },
  {
    path: '/recursos',
    name: 'features',
    component: () => import('../pages/FeaturesPage.vue'),
    meta: { prerender: true, sitemap: { changefreq: 'monthly', priority: 0.8 } },
  },
  {
    path: '/integracoes',
    name: 'integrations',
    component: () => import('../pages/IntegrationsPage.vue'),
    meta: { prerender: true, sitemap: { changefreq: 'monthly', priority: 0.7 } },
  },
  {
    path: '/para/:nicho',
    name: 'niche',
    component: () => import('../pages/NichePage.vue'),
    meta: { sitemap: { changefreq: 'monthly', priority: 0.8 } },
  },
  {
    path: '/contato',
    name: 'contact',
    component: () => import('../pages/ContactPage.vue'),
    meta: { prerender: true, sitemap: { changefreq: 'yearly', priority: 0.5 } },
  },
  {
    path: '/termos',
    name: 'terms',
    component: () => import('../pages/LegalPage.vue'),
    props: { doc: 'terms' },
    meta: { prerender: true, sitemap: { changefreq: 'yearly', priority: 0.3 } },
  },
  {
    path: '/privacidade',
    name: 'privacy',
    component: () => import('../pages/LegalPage.vue'),
    props: { doc: 'privacy' },
    meta: { prerender: true, sitemap: { changefreq: 'yearly', priority: 0.3 } },
  },
  {
    path: '/cookies',
    name: 'cookies',
    component: () => import('../pages/LegalPage.vue'),
    props: { doc: 'cookies' },
    meta: { prerender: true, sitemap: { changefreq: 'yearly', priority: 0.3 } },
  },
  {
    path: '/b/:slug',
    name: 'booking',
    component: () => import('../pages/PublicBookingPage.vue'),
    meta: { spa: true, minimal: true },
  },
  {
    path: '/agendamento/:token',
    name: 'manage-booking',
    component: () => import('../pages/ManageBookingPage.vue'),
    meta: { spa: true, minimal: true },
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'not-found',
    component: () => import('../pages/NotFoundPage.vue'),
  },
]

/** Entradas do sitemap: rotas estáticas + uma por nicho. Exclui SPA, 404. */
export function sitemapEntries() {
  const out = []
  for (const r of routes) {
    if (r.path === '/para/:nicho') {
      for (const n of niches) out.push({ path: `/para/${n.slug}`, ...r.meta.sitemap })
    } else if (r.meta?.prerender && r.meta.sitemap) {
      out.push({ path: r.path, ...r.meta.sitemap })
    }
  }
  return out
}

/** Caminhos que viram HTML estático no build (sitemap + 404). */
export const prerenderPaths = () => sitemapEntries().map((e) => e.path)
