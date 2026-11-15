// Cliente da API pública do core (prefixo /public, sem autenticação). Contrato: agendaspro-core/docs/contratos-f3.md.
// Base: VITE_API_BASE. Em dev/teste, VITE_USE_MOCK=true troca o fetch por src/services/mockApi.js.
import { env } from '../config/env.js'
import { ApiError, codeFromStatus } from './apiError.js'
import { availabilityQuery } from '../lib/bookingPayload.js'
import { newIdempotencyKey } from '../lib/idempotency.js'

export { ApiError, friendlyError, isAmbiguousFailure } from './apiError.js'
export { newIdempotencyKey }

const TIMEOUT_MS = 15000

const qs = (query) => {
  const p = new URLSearchParams()
  for (const [k, v] of Object.entries(query || {})) if (v !== undefined && v !== null && v !== '') p.set(k, String(v))
  // vírgula literal em listas (service_id=1,2); URLSearchParams a codificaria como %2C
  const s = p.toString().replace(/%2C/gi, ',')
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
      // `import.meta.env.DEV` é literal estático: em build de produção o bloco e o mock saem do bundle.
      if (import.meta.env.DEV) {
        const mock = await import('./mockApi.js')
        return mock.handle(method, path, { query: query || {}, body: body || {} })
      }
      throw new ApiError(0, 'mock_disabled', 'Modo de demonstração desativado.')
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
    } catch (e) {
      if (e?.name === 'AbortError') throw new ApiError(0, 'timeout', 'O servidor demorou para responder.')
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
      // Retry-After só é legível cross-origin se o core o expuser (Access-Control-Expose-Headers).
      const retry = Number.parseInt(res.headers?.get?.('retry-after'), 10)
      throw new ApiError(
        res.status,
        data?.error?.code || codeFromStatus(res.status),
        data?.error?.message || `Erro ${res.status}`,
        {
          retryAfter: Number.isFinite(retry) ? retry : undefined,
          correlationId: data?.error?.correlation_id,
        },
      )
    }
    if (data === null || typeof data !== 'object') {
      throw new ApiError(res.status, 'invalid_response', 'Resposta inesperada do servidor.')
    }
    return data
  }

  const enc = encodeURIComponent
  return {
    /** POST /public/leads -> 201 {ok:true} */
    createLead: (payload) => request('POST', '/leads', { body: payload }),
    /** GET /public/b/:slug -> {company, services, professionals} */
    getBusiness: (slug) => request('GET', `/b/${enc(slug)}`),
    /**
     * GET /public/b/:slug/availability -> {timezone, days:[{date, slots:[{start, professional_id}]}]}
     * `serviceIds` (1 a 5) vira service_id=1,2 (duração somada); `serviceId` aceito por compatibilidade.
     */
    getAvailability: (slug, { serviceIds, serviceId, professionalId, from, to }) =>
      request('GET', `/b/${enc(slug)}/availability`, {
        query: availabilityQuery({ serviceIds: serviceIds ?? [serviceId], professionalId, from, to }),
      }),
    /** POST /public/b/:slug/bookings -> 201 (ou 200 em reenvio idempotente) {booking, payment?, manage_token} */
    createBooking: (slug, payload) => request('POST', `/b/${enc(slug)}/bookings`, { body: payload }),
    /** GET /public/bookings/:token -> {booking, company, policy, payment?} (410 token_expired) */
    getBooking: (token) => request('GET', `/bookings/${enc(token)}`),
    cancelBooking: (token) => request('POST', `/bookings/${enc(token)}/cancel`, { body: {} }),
    rescheduleBooking: (token, start) => request('POST', `/bookings/${enc(token)}/reschedule`, { body: { start } }),
  }
}

export const publicApi = createPublicApi()
