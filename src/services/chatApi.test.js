import { describe, it, expect, vi } from 'vitest'
import { createChatApi } from './chatApi.js'
import { ApiError } from './apiError.js'

const jsonRes = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => ({ 'content-type': 'application/json', ...headers })[k.toLowerCase()] ?? null },
  json: async () => body,
})

function sseRes(chunks, status = 200) {
  const enc = new TextEncoder()
  let i = 0
  return {
    ok: true,
    status,
    headers: { get: (k) => (k.toLowerCase() === 'content-type' ? 'text/event-stream; charset=utf-8' : null) },
    body: {
      getReader: () => ({
        read: async () => (i < chunks.length ? { value: enc.encode(chunks[i++]), done: false } : { value: undefined, done: true }),
        cancel: async () => {},
      }),
    },
  }
}

const make = (fetchImpl, extra = {}) => createChatApi({ baseUrl: 'https://api.exemplo.test', useMocks: false, fetchImpl, ...extra })

describe('sessão', () => {
  it('cria sessão sem credenciais; company_slug só com audiência cliente', async () => {
    const f = vi.fn().mockResolvedValue(jsonRes(201, { session_token: 'cs1.a.1.b' }))
    const api = make(f)
    await api.createSession({ audience: 'customer', turnstileToken: 'tk', companySlug: 'clinica' })
    let [url, init] = f.mock.calls[0]
    expect(url).toBe('https://api.exemplo.test/public/chat/session')
    expect(init.credentials).toBe('omit')
    expect(init.headers.Authorization).toBeUndefined()
    expect(JSON.parse(init.body)).toEqual({ audience: 'customer', turnstile_token: 'tk', company_slug: 'clinica' })
    await api.createSession({ audience: 'business', turnstileToken: 'tk', companySlug: 'clinica' })
    ;[url, init] = f.mock.calls[1]
    expect(JSON.parse(init.body)).toEqual({ audience: 'business', turnstile_token: 'tk' })
  })

  it('rotas autenticadas enviam Bearer; token nunca vai na URL', async () => {
    const f = vi.fn().mockResolvedValue(jsonRes(200, { ok: true }))
    const api = make(f)
    await api.getSession('cs1.x.1.y')
    await api.closeSession('cs1.x.1.y')
    await api.rate('cs1.x.1.y', { rating: 5 })
    for (const [url, init] of f.mock.calls) {
      expect(init.headers.Authorization).toBe('Bearer cs1.x.1.y')
      expect(url).not.toContain('cs1')
    }
  })
})

describe('erros do contrato', () => {
  it('429 expõe Retry-After', async () => {
    const f = vi.fn().mockResolvedValue(jsonRes(429, { error: { code: 'rate_limited', message: 'x' } }, { 'retry-after': '12' }))
    const e = await make(f).sendMessage('t', { message: 'oi', stream: false }).catch((x) => x)
    expect(e).toBeInstanceOf(ApiError)
    expect(e.code).toBe('rate_limited')
    expect(e.retryAfter).toBe(12)
  })
  it('413, 503 chat_disabled e 401 mantêm código e status', async () => {
    for (const [status, code] of [[413, 'message_too_long'], [503, 'chat_disabled'], [401, 'session_expired'], [409, 'in_progress']]) {
      const f = vi.fn().mockResolvedValue(jsonRes(status, { error: { code, message: 'm' } }))
      const e = await make(f).sendMessage('t', { message: 'oi', stream: false }).catch((x) => x)
      expect([e.status, e.code]).toEqual([status, code])
    }
  })
  it('falha de rede e timeout viram ApiError status 0', async () => {
    const net = await make(vi.fn().mockRejectedValue(new TypeError('fail'))).getSession('t').catch((x) => x)
    expect([net.status, net.code]).toEqual([0, 'network_error'])
    const f = vi.fn((_u, init) => new Promise((_r, rej) => init.signal.addEventListener('abort', () => rej(Object.assign(new Error('a'), { name: 'AbortError' })))))
    const to = await make(f, { timeoutMs: 10 }).getSession('t').catch((x) => x)
    expect([to.status, to.code]).toEqual([0, 'timeout'])
  })
  it('resposta 200 não-JSON => invalid_response', async () => {
    const f = vi.fn().mockResolvedValue({ ok: true, status: 200, headers: { get: () => 'text/html' }, json: async () => { throw new Error('x') } })
    const e = await make(f).getSession('t').catch((x) => x)
    expect(e.code).toBe('invalid_response')
  })
})

describe('mensagens', () => {
  it('envia client_msg_id e pede SSE; entrega deltas e o done final', async () => {
    const chunks = [
      'event: delta\ndata: {"text":"Ol"}\n\nevent: del',
      'ta\ndata: {"text":"á"}\n\n',
      'event: done\ndata: {"reply":"Olá","suggestions":[],"remaining":{"messages":9,"tokens":100}}\n\n',
    ]
    const f = vi.fn().mockResolvedValue(sseRes(chunks))
    const deltas = []
    const r = await make(f).sendMessage('t', { message: 'oi', clientMsgId: 'abcdefgh-1', onDelta: (d) => deltas.push(d) })
    expect(deltas).toEqual(['Ol', 'á'])
    expect(r.reply).toBe('Olá')
    const [, init] = f.mock.calls[0]
    expect(init.headers.Accept).toContain('text/event-stream')
    expect(JSON.parse(init.body)).toEqual({ message: 'oi', client_msg_id: 'abcdefgh-1' })
  })
  it('fallback JSON quando o servidor responde application/json', async () => {
    const f = vi.fn().mockResolvedValue(jsonRes(200, { reply: 'Oi', remaining: { messages: 1, tokens: 1 } }))
    const deltas = []
    const r = await make(f).sendMessage('t', { message: 'oi', onDelta: (d) => deltas.push(d) })
    expect(r.reply).toBe('Oi')
    expect(deltas).toEqual([])
  })
  it('stream cortado antes do done => stream_interrupted (ambíguo, reenviar com o mesmo id)', async () => {
    const f = vi.fn().mockResolvedValue(sseRes(['event: delta\ndata: {"text":"Ol"}\n\n']))
    const e = await make(f).sendMessage('t', { message: 'oi' }).catch((x) => x)
    expect(e.code).toBe('stream_interrupted')
  })
  it('evento error no stream vira ApiError', async () => {
    const f = vi.fn().mockResolvedValue(sseRes(['event: error\ndata: {"code":"boom","message":"x"}\n\n']))
    const e = await make(f).sendMessage('t', { message: 'oi' }).catch((x) => x)
    expect(e).toBeInstanceOf(ApiError)
    expect(e.code).toBe('boom')
  })
})

describe('mock', () => {
  it('useMocks sem DEV não chama a rede (em teste DEV=true usa o mock; aqui só garantimos que não usa fetch)', async () => {
    const f = vi.fn()
    const api = createChatApi({ useMocks: true, fetchImpl: f })
    const r = await api.createSession({ audience: 'business', turnstileToken: 'dev-bypass' })
    expect(r.session_token).toMatch(/^cs1\./)
    expect(f).not.toHaveBeenCalled()
  })
})
