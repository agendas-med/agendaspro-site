// Cliente do chat público (/public/chat/*). Contrato: agendaspro-core/docs/contratos-f5a.md.
// - Autenticação por "Authorization: Bearer <session_token>" (sem cookie, credentials: 'omit').
// - Mensagens por SSE via fetch + ReadableStream (POST com Bearer não funciona com EventSource), com
//   fallback automático para JSON (decidido pelo content-type; erros chegam antes do stream como HTTP+JSON).
// - Em dev, VITE_USE_MOCK=true troca o fetch por src/services/mockChat.js (import dinâmico atrás de DEV).
import { env } from '../config/env.js'
import { ApiError, codeFromStatus } from './apiError.js'
import { createSseParser, parseSseJson } from '../lib/chatSse.js'

const TIMEOUT_MS = 15000
// IA: até ~12 s + 1 retry no core; o stream inteiro precisa caber aqui.
const MESSAGE_TIMEOUT_MS = 45000

/**
 * @param {{baseUrl?:string, useMocks?:boolean, fetchImpl?:typeof fetch, timeoutMs?:number, messageTimeoutMs?:number}} opts
 */
export function createChatApi({
  baseUrl = env.apiBase,
  useMocks = env.useMocks,
  fetchImpl,
  timeoutMs = TIMEOUT_MS,
  messageTimeoutMs = MESSAGE_TIMEOUT_MS,
} = {}) {
  async function request(method, path, { token, body, stream = false, onDelta, timeout = timeoutMs, signal } = {}) {
    if (useMocks) {
      // `import.meta.env.DEV` é literal estático: em build de produção o bloco e o mock saem do bundle.
      if (import.meta.env.DEV) {
        const mock = await import('./mockChat.js')
        return mock.handle(method, path, { token, body: body || {}, onDelta: stream ? onDelta : undefined })
      }
      throw new ApiError(0, 'mock_disabled', 'Modo de demonstração desativado.')
    }
    const doFetch = fetchImpl || globalThis.fetch
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeout)
    if (signal) signal.addEventListener('abort', () => ctrl.abort(), { once: true })
    try {
      let res
      try {
        res = await doFetch(`${baseUrl}/public/chat${path}`, {
          method,
          headers: {
            Accept: stream ? 'text/event-stream, application/json' : 'application/json',
            ...(body ? { 'Content-Type': 'application/json' } : {}),
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: body ? JSON.stringify(body) : undefined,
          signal: ctrl.signal,
          credentials: 'omit',
          cache: 'no-store',
        })
      } catch (e) {
        if (e?.name === 'AbortError') throw new ApiError(0, 'timeout', 'O servidor demorou para responder.')
        throw new ApiError(0, 'network_error', 'Sem conexão com o servidor.')
      }

      if (!res.ok) throw await errorFrom(res)

      const type = String(res.headers?.get?.('content-type') || '')
      if (stream && /text\/event-stream/i.test(type)) return await readStream(res, onDelta)

      let data = null
      try {
        data = await res.json()
      } catch {
        /* corpo vazio ou não-JSON */
      }
      if (data === null || typeof data !== 'object') {
        throw new ApiError(res.status, 'invalid_response', 'Resposta inesperada do servidor.')
      }
      return data
    } catch (e) {
      // abort durante a leitura do stream
      if (e?.name === 'AbortError') throw new ApiError(0, 'timeout', 'O servidor demorou para responder.')
      throw e
    } finally {
      clearTimeout(timer)
    }
  }

  async function errorFrom(res) {
    let data = null
    try {
      data = await res.json()
    } catch {
      /* sem corpo JSON (proxy/CDN) */
    }
    // Retry-After é legível cross-origin porque o core o expõe (exposedHeaders).
    const retry = Number.parseInt(res.headers?.get?.('retry-after'), 10)
    return new ApiError(res.status, data?.error?.code || codeFromStatus(res.status), data?.error?.message || `Erro ${res.status}`, {
      retryAfter: Number.isFinite(retry) ? retry : undefined,
      correlationId: data?.error?.correlation_id,
    })
  }

  /** Lê o SSE até o evento `done`. Sem `done` => falha ambígua (o chamador reenvia com o mesmo client_msg_id). */
  async function readStream(res, onDelta) {
    const parser = createSseParser()
    let done = null
    const handle = (ev) => {
      const payload = parseSseJson(ev.data)
      if (ev.event === 'delta') {
        if (typeof payload?.text === 'string') onDelta?.(payload.text)
      } else if (ev.event === 'done') {
        done = payload
      } else if (ev.event === 'error') {
        throw new ApiError(res.status, payload?.code || payload?.error?.code || 'stream_error', payload?.message || 'Falha na resposta.')
      }
    }
    try {
      if (res.body?.getReader) {
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        for (;;) {
          const { value, done: finished } = await reader.read()
          if (finished) break
          parser.feed(decoder.decode(value, { stream: true }))
            .forEach(handle)
          if (done) {
            reader.cancel().catch(() => {})
            break
          }
        }
        parser.feed(decoder.decode()).forEach(handle)
      } else {
        // sem ReadableStream: lê tudo e processa de uma vez (sem deltas progressivos)
        parser.feed(await res.text()).forEach(handle)
      }
      if (!done) parser.end().forEach(handle)
    } catch (e) {
      if (e instanceof ApiError || e?.name === 'AbortError') throw e
      throw new ApiError(0, 'stream_interrupted', 'A resposta foi interrompida.')
    }
    if (!done || typeof done.reply !== 'string') throw new ApiError(0, 'stream_interrupted', 'A resposta foi interrompida.')
    return done
  }

  return {
    /** POST /public/chat/session -> 201 {session_token, expires_at, limits, audience, company} */
    createSession: ({ audience, turnstileToken, companySlug }) =>
      request('POST', '/session', {
        body: {
          audience,
          turnstile_token: turnstileToken || '',
          ...(audience === 'customer' && companySlug ? { company_slug: companySlug } : {}),
        },
      }),
    /** GET /public/chat/session -> {audience, status, expires_at, company, limits, remaining, messages[]} */
    getSession: (token) => request('GET', '/session', { token }),
    /**
     * POST /public/chat/message. `stream` pede SSE (com fallback JSON); `onDelta(texto)` recebe os pedaços.
     * Devolve o JSON completo ({reply, suggestions, actions, proactive_hint, source, remaining, ...}).
     */
    sendMessage: (token, { message, clientMsgId, stream = true, onDelta, signal }) =>
      request('POST', '/message', {
        token,
        body: { message, ...(clientMsgId ? { client_msg_id: clientMsgId } : {}) },
        stream,
        onDelta,
        timeout: messageTimeoutMs,
        signal,
      }),
    /** POST /public/chat/session/close -> {ok:true} */
    closeSession: (token) => request('POST', '/session/close', { token, body: {} }),
    /** POST /public/chat/rating {rating 1..5, comment?} -> {ok:true} (uma vez por sessão) */
    rate: (token, { rating, comment }) =>
      request('POST', '/rating', { token, body: { rating, ...(comment ? { comment } : {}) } }),
    /** POST /public/chat/lead (só audience=business) -> 201 {ok, reply} */
    sendLead: (token, payload) => request('POST', '/lead', { token, body: payload }),
  }
}

export const chatApi = createChatApi()
