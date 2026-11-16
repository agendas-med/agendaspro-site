import { describe, it, expect, vi } from 'vitest'
import { createChatController } from './chatController.js'
import { ApiError } from '../services/apiError.js'
import { memoryStorage, readSaved, isChatMarkedDisabled, sessionKey } from './chatStorage.js'

const T0 = 1_800_000_000_000
const session = (over = {}) => ({
  session_token: 'cs1.abc.1.sig',
  expires_at: new Date(T0 + 30 * 60_000).toISOString(),
  limits: { max_messages: 20, max_tokens: 8000, max_chars: 500 },
  audience: 'business',
  company: null,
  ...over,
})
const reply = (over = {}) => ({ reply: 'Olá!', suggestions: ['Planos'], actions: [], proactive_hint: null, source: 'faq', remaining: { messages: 19, tokens: 7000 }, ...over })

function setup({ slug = null, api: apiOver = {}, storage = memoryStorage(), minIntervalMs = 0 } = {}) {
  const clock = { t: T0 }
  const api = {
    createSession: vi.fn().mockResolvedValue(session()),
    getSession: vi.fn(),
    sendMessage: vi.fn().mockResolvedValue(reply()),
    closeSession: vi.fn().mockResolvedValue({ ok: true }),
    rate: vi.fn().mockResolvedValue({ ok: true }),
    sendLead: vi.fn().mockResolvedValue({ ok: true, reply: 'Recebemos!' }),
    ...apiOver,
  }
  let n = 0
  const sleeps = []
  const c = createChatController({
    api,
    storage,
    slug,
    now: () => clock.t,
    sleep: async (ms) => void sleeps.push(ms),
    newId: () => `msg-id-${String(++n).padStart(4, '0')}`,
    minIntervalMs,
  })
  return { c, s: c.state, api, clock, storage, sleeps }
}
async function started(opts = {}, audience = 'business', token = 'tk') {
  const h = setup(opts)
  h.c.chooseAudience(audience)
  await h.c.start(token)
  return h
}
const err = (status, code, o) => new ApiError(status, code, 'm', o)

describe('fluxo de início', () => {
  it('não chama a API antes da escolha da audiência nem antes do token', async () => {
    const { c, s, api } = setup()
    expect(s.phase).toBe('gate')
    expect(await c.start('tk')).toBe(false)
    expect(api.createSession).not.toHaveBeenCalled()
    c.chooseAudience('business')
    expect(s.phase).toBe('verifying')
    expect(api.createSession).not.toHaveBeenCalled()
    c.chooseAudience('admin') // inválido: ignorado
    expect(s.audience).toBe('business')
  })

  it('cria a sessão com audiência, token do Turnstile e slug; guarda só token/exp/audiência', async () => {
    const { c, s, api, storage } = setup({ slug: 'clinica' })
    c.chooseAudience('customer')
    expect(await c.start('ts-token')).toBe(true)
    expect(api.createSession).toHaveBeenCalledWith({ audience: 'customer', turnstileToken: 'ts-token', companySlug: 'clinica' })
    expect(s.phase).toBe('chat')
    expect(s.messages).toHaveLength(1) // saudação local
    expect(s.messages[0].role).toBe('assistant')
    const saved = readSaved(storage, 'clinica')
    expect(saved.token).toBe('cs1.abc.1.sig')
    expect(JSON.stringify([...Object.values(storage)])).not.toContain('Olá')
  })

  it('o token nunca vai para o localStorage', async () => {
    globalThis.localStorage = { setItem: vi.fn(), getItem: vi.fn() }
    await started()
    expect(globalThis.localStorage.setItem).not.toHaveBeenCalled()
    delete globalThis.localStorage
  })

  it('chat_disabled esconde o chat e marca a aba', async () => {
    const { c, s, storage } = setup({ api: { createSession: vi.fn().mockRejectedValue(err(503, 'chat_disabled')) } })
    c.chooseAudience('business')
    await c.start('tk')
    expect(s.phase).toBe('disabled')
    expect(isChatMarkedDisabled(storage)).toBe(true)
  })

  it('falha do Turnstile no core: erro recuperável, sem repetir sozinho', async () => {
    const { c, s, api } = setup({ api: { createSession: vi.fn().mockRejectedValue(err(400, 'turnstile_failed')) } })
    c.chooseAudience('business')
    await c.start('tk')
    expect(s.phase).toBe('verifying')
    expect(s.startError.retryable).toBe(true)
    expect(await c.start('tk2')).toBe(false) // bloqueado até limpar o erro
    expect(api.createSession).toHaveBeenCalledTimes(1)
    c.clearStartError()
    await c.start('tk2')
    expect(api.createSession).toHaveBeenCalledTimes(2)
  })

  it('429 de sessões/IP e 404 encerram sem tentar de novo', async () => {
    for (const [status, code, reason] of [[429, 'rate_limited', 'rate_limited'], [404, 'not_found', 'not_found']]) {
      const { c, s } = setup({ api: { createSession: vi.fn().mockRejectedValue(err(status, code)) } })
      c.chooseAudience('customer')
      await c.start('tk')
      expect(s.phase).toBe('ended')
      expect(s.endReason).toBe(reason)
    }
  })

  it('resposta sem token/expiração é tratada como erro', async () => {
    const { c, s } = setup({ api: { createSession: vi.fn().mockResolvedValue({ foo: 1 }) } })
    c.chooseAudience('business')
    expect(await c.start('tk')).toBe(false)
    expect(s.startError).toBeTruthy()
  })
})

describe('envio de mensagens', () => {
  it('envia com client_msg_id válido, mostra a resposta, sugestões e limites restantes', async () => {
    const { c, s, api } = await started()
    expect(c.send('  Quanto custa?  ')).toBe(true)
    await vi.waitFor(() => expect(s.busy).toBe(false))
    const [token, body] = api.sendMessage.mock.calls[0]
    expect(token).toBe('cs1.abc.1.sig')
    expect(body.message).toBe('Quanto custa?')
    expect(body.clientMsgId).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
    const last = s.messages[s.messages.length - 1]
    expect(last).toMatchObject({ role: 'assistant', text: 'Olá!', suggestions: ['Planos'] })
    expect(s.remaining).toEqual({ messages: 19, tokens: 7000 })
  })

  it('streaming: deltas aparecem numa única bolha que vira a resposta final', async () => {
    const sendMessage = vi.fn(async (_t, { onDelta }) => {
      onDelta('Ol')
      onDelta('á!')
      return reply({ reply: 'Olá!' })
    })
    const { c, s } = await started({ api: { sendMessage } })
    c.send('oi')
    await vi.waitFor(() => expect(s.busy).toBe(false))
    const assistants = s.messages.filter((m) => m.role === 'assistant' && m.source !== 'local')
    expect(assistants).toHaveLength(1)
    expect(assistants[0].text).toBe('Olá!')
    expect(assistants[0].status).toBe('sent')
  })

  it('anti double-click: ignora segundo envio durante o primeiro e dentro do intervalo mínimo', async () => {
    let release
    const sendMessage = vi.fn(() => new Promise((r) => (release = () => r(reply()))))
    const { c, s } = await started({ api: { sendMessage }, minIntervalMs: 1200 })
    expect(c.send('a')).toBe(true)
    expect(c.send('b')).toBe(false)
    expect(sendMessage).toHaveBeenCalledTimes(1)
    release()
    await vi.waitFor(() => expect(s.busy).toBe(false))
    expect(c.send('c')).toBe(false) // debounce de cliente (relógio parado)
  })

  it('mensagem vazia ou acima do limite não chama a API', async () => {
    const { c, s, api } = await started()
    expect(c.send('   ')).toBe(false)
    expect(c.send('x'.repeat(501))).toBe(false)
    expect(s.inputError).toMatch(/500/)
    expect(api.sendMessage).not.toHaveBeenCalled()
  })

  it('429 com Retry-After: mensagem fica pendente, contagem regressiva e retry com o MESMO client_msg_id', async () => {
    const sendMessage = vi.fn().mockRejectedValueOnce(err(429, 'rate_limited', { retryAfter: 20 })).mockResolvedValue(reply())
    const { c, s, clock } = await started({ api: { sendMessage } })
    c.send('oi')
    await vi.waitFor(() => expect(s.busy).toBe(false))
    const failed = s.messages.find((m) => m.status === 'failed')
    expect(failed).toBeTruthy()
    expect(s.retryIn).toBe(20)
    expect(c.retry(failed.id)).toBe(false) // ainda esperando
    expect(c.send('outra')).toBe(false)
    clock.t += 21_000
    c.tick()
    expect(s.retryIn).toBe(0)
    expect(c.retry(failed.id)).toBe(true)
    await vi.waitFor(() => expect(s.busy).toBe(false))
    expect(sendMessage.mock.calls[1][1].clientMsgId).toBe(sendMessage.mock.calls[0][1].clientMsgId)
    expect(s.messages.some((m) => m.status === 'failed')).toBe(false)
  })

  it('mensagem com falha bloqueia novo envio até tentar de novo ou descartar (devolve o texto)', async () => {
    const sendMessage = vi.fn().mockRejectedValue(err(0, 'network_error'))
    const { c, s } = await started({ api: { sendMessage } })
    c.send('texto importante')
    await vi.waitFor(() => expect(s.busy).toBe(false))
    expect(c.send('outra')).toBe(false)
    c.discard(s.messages.find((m) => m.status === 'failed').id)
    expect(s.draft).toBe('texto importante')
    expect(s.messages.some((m) => m.status === 'failed')).toBe(false)
  })

  it('409 in_progress: espera Retry-After e reenvia com o mesmo id, sem duplicar a bolha', async () => {
    const sendMessage = vi.fn().mockRejectedValueOnce(err(409, 'in_progress', { retryAfter: 2 })).mockResolvedValue(reply())
    const { c, s, sleeps } = await started({ api: { sendMessage } })
    c.send('oi')
    await vi.waitFor(() => expect(s.busy).toBe(false))
    expect(sendMessage).toHaveBeenCalledTimes(2)
    expect(sleeps).toEqual([2000])
    expect(sendMessage.mock.calls[0][1].clientMsgId).toBe(sendMessage.mock.calls[1][1].clientMsgId)
    expect(s.messages.filter((m) => m.role === 'user')).toHaveLength(1)
  })

  it('413 do servidor: mensagem falha e mostra o aviso no campo', async () => {
    const { c, s } = await started({ api: { sendMessage: vi.fn().mockRejectedValue(err(413, 'message_too_long')) } })
    c.send('oi')
    await vi.waitFor(() => expect(s.busy).toBe(false))
    expect(s.messages.some((m) => m.status === 'failed')).toBe(true)
    expect(s.inputError).toBeTruthy()
  })

  it('cooldown no corpo da resposta inicia a pausa', async () => {
    const { c, s } = await started({ api: { sendMessage: vi.fn().mockResolvedValue(reply({ cooldown_seconds: 30 })) } })
    c.send('oi')
    await vi.waitFor(() => expect(s.busy).toBe(false))
    expect(s.retryIn).toBe(30)
    expect(c.send('de novo')).toBe(false)
  })

  it('degraded, actions e proactive_hint são normalizados', async () => {
    const payload = reply({
      degraded: true,
      source: 'fallback',
      actions: [{ type: 'script' }, { type: 'link', label: 'Planos', url: 'https://agendaspro.com.br/precos' }],
      proactive_hint: { type: 'cta', text: 'Que tal criar a conta?', action: 'signup' },
    })
    const { c, s } = await started({ api: { sendMessage: vi.fn().mockResolvedValue(payload) } })
    c.send('oi')
    await vi.waitFor(() => expect(s.busy).toBe(false))
    const last = s.messages[s.messages.length - 1]
    expect(last.degraded).toBe(true)
    expect(last.actions).toHaveLength(1)
    expect(last.hint).toEqual({ action: 'signup', text: 'Que tal criar a conta?' })
  })
})

describe('sessão expirada, bloqueada, encerrada e limites', () => {
  it('401: encerra a conversa SEM criar sessão nova sozinho e devolve o texto ao campo', async () => {
    const { c, s, api } = await started({ api: { sendMessage: vi.fn().mockRejectedValue(err(401, 'session_expired')) } })
    c.send('minha pergunta')
    await vi.waitFor(() => expect(s.busy).toBe(false))
    expect(s.phase).toBe('ended')
    expect(s.endReason).toBe('expired')
    expect(s.draft).toBe('minha pergunta')
    expect(api.createSession).toHaveBeenCalledTimes(1)
  })

  it('nova conversa mantém a audiência e volta para a verificação (token novo exigido)', async () => {
    const { c, s, api, storage } = await started({ api: { sendMessage: vi.fn().mockRejectedValue(err(401, 'session_expired')) } })
    c.send('oi')
    await vi.waitFor(() => expect(s.busy).toBe(false))
    expect(storage.getItem(sessionKey(null))).toBeNull()
    c.newConversation()
    expect(s.phase).toBe('verifying')
    expect(s.audience).toBe('business')
    expect(s.messages).toHaveLength(0)
    await c.start('novo-token')
    expect(api.createSession).toHaveBeenCalledTimes(2)
    expect(s.phase).toBe('chat')
  })

  it('403 bloqueada: encerra e não permite nova conversa', async () => {
    const { c, s } = await started({ api: { sendMessage: vi.fn().mockRejectedValue(err(403, 'session_blocked')) } })
    c.send('oi')
    await vi.waitFor(() => expect(s.busy).toBe(false))
    expect(s.endReason).toBe('blocked')
    c.newConversation()
    expect(s.phase).toBe('ended')
  })

  it('409 session_closed encerra', async () => {
    const { c, s } = await started({ api: { sendMessage: vi.fn().mockRejectedValue(err(409, 'session_closed')) } })
    c.send('oi')
    await vi.waitFor(() => expect(s.busy).toBe(false))
    expect(s.endReason).toBe('closed')
  })

  it('429 message_limit encerra; o lead continua possível (sessão ainda ativa no core)', async () => {
    const { c, s, api } = await started({ api: { sendMessage: vi.fn().mockRejectedValue(err(429, 'message_limit')) } })
    c.send('oi')
    await vi.waitFor(() => expect(s.busy).toBe(false))
    expect(s.endReason).toBe('message_limit')
    c.openLead()
    expect(s.leadOpen).toBe(true)
    const r = await c.submitLead({ name: 'Ana', whatsapp: '+5511912345678', consent: true })
    expect(r.ok).toBe(true)
    expect(api.sendLead).toHaveBeenCalledTimes(1)
  })

  it('503 chat_disabled no meio da conversa esconde o chat', async () => {
    const { c, s, storage } = await started({ api: { sendMessage: vi.fn().mockRejectedValue(err(503, 'chat_disabled')) } })
    c.send('oi')
    await vi.waitFor(() => expect(s.busy).toBe(false))
    expect(s.phase).toBe('disabled')
    expect(isChatMarkedDisabled(storage)).toBe(true)
  })

  it('tick encerra quando a sessão passa da expiração', async () => {
    const { c, s, clock } = await started()
    clock.t += 31 * 60_000
    c.tick()
    expect(s.phase).toBe('ended')
    expect(s.endReason).toBe('expired')
  })

  it('send recusa quando restam 0 mensagens', async () => {
    const { c, s, api } = await started({ api: { sendMessage: vi.fn().mockResolvedValue(reply({ remaining: { messages: 0, tokens: 100 } })) } })
    c.send('última')
    await vi.waitFor(() => expect(s.busy).toBe(false))
    expect(s.notice.kind).toBe('limit')
    expect(c.send('mais uma')).toBe(false)
    expect(api.sendMessage).toHaveBeenCalledTimes(1)
  })
})

describe('lead, avaliação e encerramento', () => {
  it('lead exige consentimento e só existe para empresas', async () => {
    const biz = await started()
    expect((await biz.c.submitLead({ name: 'Ana', whatsapp: '+5511912345678', consent: false })).ok).toBe(false)
    expect(biz.api.sendLead).not.toHaveBeenCalled()
    const r = await biz.c.submitLead({ name: ' Ana ', whatsapp: '+5511912345678', email: '', segment: '', message: '', consent: true })
    expect(r.ok).toBe(true)
    expect(biz.api.sendLead).toHaveBeenCalledWith('cs1.abc.1.sig', { name: 'Ana', whatsapp: '+5511912345678', consent: true })
    expect(biz.s.leadSent).toBe(true)

    const cust = await started({}, 'customer')
    cust.c.openLead()
    expect(cust.s.leadOpen).toBe(false)
  })

  it('lead_exists conta como enviado; erros de validação ficam no formulário', async () => {
    const a = await started({ api: { sendLead: vi.fn().mockRejectedValue(err(409, 'lead_exists')) } })
    expect((await a.c.submitLead({ name: 'Ana', whatsapp: '1', consent: true })).ok).toBe(true)
    expect(a.s.leadSent).toBe(true)
    const b = await started({ api: { sendLead: vi.fn().mockRejectedValue(err(400, 'validation_error')) } })
    expect((await b.c.submitLead({ name: 'Ana', whatsapp: '1', consent: true })).ok).toBe(false)
    expect(b.s.leadError).toBeTruthy()
    expect(b.s.leadSent).toBe(false)
  })

  it('encerrar -> ended/closed_by_user e avaliação (uma vez)', async () => {
    const { c, s, api } = await started()
    expect(await c.close()).toBe(true)
    expect(s.endReason).toBe('closed_by_user')
    expect(await c.rate({ rating: 0 })).toBe(false)
    expect(await c.rate({ rating: 5, comment: ' ótimo ' })).toBe(true)
    expect(api.rate).toHaveBeenCalledWith('cs1.abc.1.sig', { rating: 5, comment: 'ótimo' })
    expect(s.rated).toBe(true)
  })

  it('already_rated vira sucesso silencioso', async () => {
    const { c, s } = await started({ api: { rate: vi.fn().mockRejectedValue(err(409, 'already_rated')) } })
    await c.close()
    expect(await c.rate({ rating: 4 })).toBe(true)
    expect(s.rated).toBe(true)
  })
})

describe('restauração e troca de contexto', () => {
  it('recarregar a aba reidrata pelo GET /session (mensagens não ficam no navegador)', async () => {
    const first = await started()
    const getSession = vi.fn().mockResolvedValue({
      audience: 'business',
      status: 'active',
      expires_at: new Date(T0 + 20 * 60_000).toISOString(),
      company: null,
      limits: { max_messages: 20, max_tokens: 8000, max_chars: 500 },
      remaining: { messages: 15, tokens: 5000 },
      messages: [
        { id: 1, role: 'user', content: 'oi' },
        { id: 2, role: 'assistant', content: 'Olá!', suggestions: ['Planos'] },
      ],
    })
    const second = setup({ storage: first.storage, api: { getSession } })
    expect(await second.c.restore()).toBe(true)
    expect(getSession).toHaveBeenCalledWith('cs1.abc.1.sig')
    expect(second.s.phase).toBe('chat')
    expect(second.s.messages.map((m) => m.text)).toEqual(['oi', 'Olá!'])
    expect(second.s.remaining.messages).toBe(15)
  })

  it('sessão salva expirada nem chama a API; 401 na restauração volta para a escolha', async () => {
    const first = await started()
    const later = setup({ storage: first.storage })
    later.clock.t += 40 * 60_000
    expect(await later.c.restore()).toBe(false)
    expect(later.api.getSession).not.toHaveBeenCalled()

    const again = await started()
    const lost = setup({ storage: again.storage, api: { getSession: vi.fn().mockRejectedValue(err(401, 'session_expired')) } })
    await lost.c.restore()
    expect(lost.s.phase).toBe('gate')
    expect(readSaved(again.storage, null)).toBeNull()
  })

  it('setContext (site <-> /b/:slug) zera a conversa e volta para a escolha', async () => {
    const { c, s } = await started()
    c.setContext('clinica')
    expect(s.phase).toBe('gate')
    expect(s.messages).toHaveLength(0)
    expect(s.audience).toBeNull()
  })
})
