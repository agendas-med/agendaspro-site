// Analytics com consentimento (LGPD). Nenhum script de terceiros é carregado antes do aceite:
//  - categoria "analytics": GA4 e Microsoft Clarity
//  - categoria "marketing": Meta Pixel
// IDs vêm de env; vazio = desligado. Eventos: generate_lead, sign_up_click, whatsapp_click, booking_confirmed.
import { ref, readonly } from 'vue'
import { env } from '../config/env.js'

const STORAGE_KEY = 'ap_consent_v1'

const state = ref({ decided: false, analytics: false, marketing: false })
const bannerOpen = ref(false)
const loaded = { ga: false, meta: false, clarity: false }

export const consent = readonly(state)
export const consentBannerOpen = readonly(bannerOpen)

/** true se há algum ID configurado (senão o banner de consentimento nem precisa aparecer). */
export const analyticsConfigured = () => Boolean(env.ga4Id || env.metaPixelId || env.clarityId)

function readStored() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const v = JSON.parse(raw)
    return { analytics: Boolean(v.analytics), marketing: Boolean(v.marketing) }
  } catch {
    return null
  }
}

function injectScript(src) {
  const s = document.createElement('script')
  s.async = true
  s.src = src
  document.head.appendChild(s)
}

function loadGa(id) {
  if (loaded.ga || !id) return
  loaded.ga = true
  window.dataLayer = window.dataLayer || []
  window.gtag = function gtag() {
    window.dataLayer.push(arguments)
  }
  window.gtag('js', new Date())
  window.gtag('config', id, { send_page_view: false })
  injectScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(id)}`)
}

function loadMeta(id) {
  if (loaded.meta || !id) return
  loaded.meta = true
  if (!window.fbq) {
    const n = (window.fbq = function fbq() {
      if (n.callMethod) n.callMethod.apply(n, arguments)
      else n.queue.push(arguments)
    })
    if (!window._fbq) window._fbq = n
    n.push = n
    n.loaded = true
    n.version = '2.0'
    n.queue = []
  }
  injectScript('https://connect.facebook.net/en_US/fbevents.js')
  window.fbq('init', id)
}

function loadClarity(id) {
  if (loaded.clarity || !id) return
  loaded.clarity = true
  window.clarity =
    window.clarity ||
    function clarity() {
      ;(window.clarity.q = window.clarity.q || []).push(arguments)
    }
  injectScript(`https://www.clarity.ms/tag/${encodeURIComponent(id)}`)
}

function applyConsent() {
  if (state.value.analytics) {
    loadGa(env.ga4Id)
    loadClarity(env.clarityId)
  }
  if (state.value.marketing) loadMeta(env.metaPixelId)
}

/** Chamado uma vez no cliente (após montar). Restaura a escolha ou abre o banner. */
export function initConsent() {
  const stored = readStored()
  if (stored) {
    state.value = { decided: true, ...stored }
    applyConsent()
    trackPageView(window.location.pathname)
  } else if (analyticsConfigured()) {
    bannerOpen.value = true
  }
}

export function saveConsent({ analytics, marketing }) {
  const hadTracking = state.value.analytics || state.value.marketing
  state.value = { decided: true, analytics: Boolean(analytics), marketing: Boolean(marketing) }
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ analytics: state.value.analytics, marketing: state.value.marketing, ts: Date.now() }),
    )
  } catch {
    /* armazenamento indisponível: a escolha vale só nesta sessão */
  }
  bannerOpen.value = false
  const revoked =
    (hadTracking && !state.value.analytics && (loaded.ga || loaded.clarity)) ||
    (hadTracking && !state.value.marketing && loaded.meta)
  if (revoked) {
    window.location.reload() // scripts de terceiros já carregados só param com recarga
    return
  }
  applyConsent()
  trackPageView(window.location.pathname)
}

export const acceptAll = () => saveConsent({ analytics: true, marketing: true })
export const rejectNonEssential = () => saveConsent({ analytics: false, marketing: false })
export const openConsentBanner = () => {
  bannerOpen.value = true
}

export function trackPageView(path) {
  if (typeof window === 'undefined') return
  if (loaded.ga && window.gtag) window.gtag('event', 'page_view', { page_path: path, page_location: window.location.href })
  if (loaded.meta && window.fbq && state.value.marketing) window.fbq('track', 'PageView')
}

const META_EVENTS = {
  generate_lead: ['track', 'Lead'],
  whatsapp_click: ['track', 'Contact'],
  sign_up_click: ['trackCustom', 'SignUpClick'],
  booking_confirmed: ['trackCustom', 'BookingConfirmed'],
}

/** Envia um evento de conversão às ferramentas ativas (sem dados pessoais nos parâmetros). */
export function track(name, params = {}) {
  if (typeof window === 'undefined') return
  if (loaded.ga && window.gtag) window.gtag('event', name, params)
  if (loaded.clarity && window.clarity) window.clarity('event', name)
  const m = META_EVENTS[name]
  if (loaded.meta && window.fbq && m) window.fbq(m[0], m[1])
}
