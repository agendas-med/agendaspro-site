// Cliente da API pública do core (prefixo /public, sem autenticação). Contratos: LAUNCH-PLAN.
// Base: VITE_API_BASE. Em VITE_USE_MOCKS=true as chamadas vão para src/services/mockApi.js.
import { env } from '../config/env.js'
import { ApiError } from './apiError.js'

export { ApiError, friendlyError } from './apiError.js'

const TIMEOUT_MS = 15000

const qs = (query) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  const s = p.toString()
  return s ? `?${s}` : ''
}

/**
 * Fábrica injetável (testes): baseUrl, useMocks e fetch podem ser trocados.
 * @param {{baseUrl?:string, useMocks?:boolean, fetchImpl?:typeof fetch, timeoutMs?:number}} opts
 */
export function createPublicApi({
  baseUrl = env.apiBase,
  useMocks = env.useMocks,
  fetchImpl,
  timeoutMs = TIMEOUT_MS,
} = {}) {
  async function request(method, path, { query, body } = {}) {
    if (useMocks) {
      // Em build de produção sem VITE_USE_MOCKS=true esta condição é estática e o mock sai do bundle.
      if (import.meta.env.PROD && import.meta.env.VITE_USE_MOCKS !== 'true') {
        throw new ApiError(0, 'mock_disabled', 'Modo de demonstração desativado.')
      } else {
        const mock = await import('./mockApi.js')
        return mock.handle(method, path, { query: query || {}, body: body || {} })
      }
    }
    const doFetch = fetchImpl || globalThis.fetch
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    let res
    try {
      res = await doFetch(`${baseUrl}/public${path}${qs(query)}`, {
        method,
        headers: {
          Accept: 'application/json',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: ctrl.signal,
        credentials: 'omit',
      })
    } catch {
      throw new ApiError(0, 'network_error', 'Sem conexão com o servidor.')
    } finally {
      clearTimeout(timer)
    }

    let data = null
    try {
      data = await res.json()
    } catch {
      /* corpo vazio ou não-JSON */
    }
    if (!res.ok) {
      const retry = Number.parseInt(res.headers?.get?.('retry-after'), 10)
      throw new ApiError(
        res.status,
        data?.error?.code || (res.status === 429 ? 'rate_limited' : 'http_error'),
        data?.error?.message || `Erro ${res.status}`,
        { retryAfter: Number.isFinite(retry) ? retry : undefined },
      )
    }
    return data
  }

  const enc = encodeURIComponent
  return {
    /** POST /public/leads -> {ok:true} */
    createLead: (payload) => request('POST', '/leads', { body: payload }),
    /** GET /public/b/:slug */
    getBusiness: (slug) => request('GET', `/b/${enc(slug)}`),
    /** GET /public/b/:slug/availability -> {timezone, days:[{date, slots:[{start, professional_id}]}]} */
    getAvailability: (slug, { serviceId, professionalId, from, to }) =>
      request('GET', `/b/${enc(slug)}/availability`, {
        query: { service_id: serviceId, professional_id: professionalId, from, to },
      }),
    /** POST /public/b/:slug/bookings -> 201 {booking, payment?, manage_token} | 409 slot_taken | 429 */
    createBooking: (slug, payload) => request('POST', `/b/${enc(slug)}/bookings`, { body: payload }),
    getBooking: (token) => request('GET', `/bookings/${enc(token)}`),
    cancelBooking: (token) => request('POST', `/bookings/${enc(token)}/cancel`, { body: {} }),
    rescheduleBooking: (token, start) => request('POST', `/bookings/${enc(token)}/reschedule`, { body: { start } }),
  }
}

export const publicApi = createPublicApi()

/** UUID v4 para idempotency_key. */
export function newIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`
}
