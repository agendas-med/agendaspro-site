// Leitura centralizada das variáveis VITE_* (valores em .env.example; .env real nunca é versionado).
const e = import.meta.env || {}

const trimSlash = (v) => String(v || '').replace(/\/+$/, '')
const bool = (v) => String(v || '').toLowerCase() === 'true'

export const env = {
  /** URL pública deste site (canonical, OG, sitemap). */
  siteUrl: trimSlash(e.VITE_SITE_URL || 'https://agendaspro.com.br'),
  /** URL do painel (agendaspro-system). Destino de "Começar grátis" (/registro) e "Entrar" (/entrar). */
  appUrl: trimSlash(e.VITE_APP_URL || 'https://app.agendaspro.com.br'),
  /** Base da API do core (rotas /public/*). Vazio = mesma origem. */
  apiBase: trimSlash(e.VITE_API_BASE || ''),
  /** Modo mock: a UI usa fixtures locais e não chama o backend. */
  useMocks: bool(e.VITE_USE_MOCKS),
  turnstileSiteKey: e.VITE_TURNSTILE_SITE_KEY || '',
  chatEnabled: bool(e.VITE_CHAT_ENABLED),
  whatsappNumber: String(e.VITE_WHATSAPP_NUMBER || '').replace(/\D/g, ''),
  /** Slug de uma página pública de exemplo (link "ver exemplo"). Em mock, usa a fixture. */
  demoSlug: e.VITE_DEMO_SLUG || (bool(e.VITE_USE_MOCKS) ? 'clinica-exemplo' : ''),
  premiumPriceCents: Number.parseInt(e.VITE_PLAN_PREMIUM_PRICE_CENTS, 10) || 4990,
  ga4Id: e.VITE_GA4_ID || '',
  metaPixelId: e.VITE_META_PIXEL_ID || '',
  clarityId: e.VITE_CLARITY_ID || '',
  isDev: Boolean(e.DEV),
}

/** Em dev/mock o Turnstile é dispensado com um token fixo; em produção sem chave nada é enviado. */
export const turnstileBypassToken = () => (env.isDev || env.useMocks ? 'dev-bypass' : '')

export const appLink = (path) => `${env.appUrl}${path}`
