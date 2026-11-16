// Leitura centralizada das variáveis VITE_* (valores em .env.example; .env real nunca é versionado).
const e = import.meta.env || {}

const trimSlash = (v) => String(v || '').replace(/\/+$/, '')
const bool = (v) => String(v || '').toLowerCase() === 'true'

// Mock e bypass do Turnstile existem SÓ em dev/teste. Em build de produção (PROD) ficam sempre desligados,
// mesmo que a variável esteja definida (o vite.config.js ainda aborta o build nesse caso).
const wantsMock = bool(e.VITE_USE_MOCK ?? e.VITE_USE_MOCKS) && !e.PROD

export const env = {
  /** URL pública deste site (canonical, OG, sitemap). */
  siteUrl: trimSlash(e.VITE_SITE_URL || 'https://agendaspro.com.br'),
  /** URL do painel (agendaspro-system). Destino de "Começar grátis" (/registro) e "Entrar" (/entrar). */
  appUrl: trimSlash(e.VITE_APP_URL || 'https://app.agendaspro.com.br'),
  /** Base da API do core (rotas /public/*). Vazio = mesma origem. */
  apiBase: trimSlash(e.VITE_API_BASE || ''),
  /** VITE_USE_MOCK=true (só dev/teste): a UI usa fixtures locais e não chama o backend. */
  useMocks: wantsMock,
  turnstileSiteKey: e.VITE_TURNSTILE_SITE_KEY || '',
  /** VITE_TURNSTILE_DEV_BYPASS=true (só dev/teste, sem site key): envia o token fixo de bypass. */
  turnstileDevBypass: bool(e.VITE_TURNSTILE_DEV_BYPASS) && !e.PROD,
  /** VITE_CHAT_ENABLED=true liga o widget de chat (o core também precisa de PUBLIC_CHAT_ENABLED=true). */
  chatEnabled: bool(e.VITE_CHAT_ENABLED),
  /** Domínios extras permitidos como link nas respostas do chat (CSV). Já valem: site, app, wa.me, instagram.com. */
  chatLinkHosts: String(e.VITE_CHAT_LINK_HOSTS || '')
    .split(',')
    .map((h) => h.trim().toLowerCase())
    .filter((h) => /^[a-z0-9.-]+$/.test(h)),
  whatsappNumber: String(e.VITE_WHATSAPP_NUMBER || '').replace(/\D/g, ''),
  /** Slug de uma página pública de exemplo (link "ver exemplo"). Em mock, usa a fixture. */
  demoSlug: e.VITE_DEMO_SLUG || (wantsMock ? 'clinica-exemplo' : ''),
  premiumPriceCents: Number.parseInt(e.VITE_PLAN_PREMIUM_PRICE_CENTS, 10) || 4990,
  ga4Id: e.VITE_GA4_ID || '',
  metaPixelId: e.VITE_META_PIXEL_ID || '',
  clarityId: e.VITE_CLARITY_ID || '',
  isDev: Boolean(e.DEV),
  isProd: Boolean(e.PROD),
}

export const appLink = (path) => `${env.appUrl}${path}`
