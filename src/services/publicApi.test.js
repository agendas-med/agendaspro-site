import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPublicApi, ApiError, newIdempotencyKey, friendlyError } from './publicApi.js'
import { resetMock } from './mockApi.js'
import { todayInTz, addDays } from '../lib/datetime.js'

const jsonRes = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  json: async () => body,
})

describe('createPublicApi (fetch real injetado)', () => {
  it('monta URL /public com query e sem enviar credenciais', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(200, { timezone: 'America/Sao_Paulo', days: [] }))
    const api = createPublicApi({ baseUrl: 'https://api.exemplo.test', useMocks: false, fetchImpl })
    await api.getAvailability('minha-clinica', { serviceId: 3, professionalId: '', from: '2026-01-01', to: '2026-01-07' })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.exemplo.test/public/b/minha-clinica/availability?service_id=3&from=2026-01-01&to=2026-01-07')
    expect(init.method).toBe('GET')
    expect(init.credentials).toBe('omit')
  })

  it('envia o corpo JSON do agendamento', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(201, { manage_token: 't' }))
    const api = createPublicApi({ baseUrl: 'https://api.exemplo.test', useMocks: false, fetchImpl })
    await api.createBooking('a b', { idempotency_key: 'k1' })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('https://api.exemplo.test/public/b/a%20b/bookings')
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(JSON.parse(init.body)).toEqual({ idempotency_key: 'k1' })
  })

  it('409 slot_taken vira ApiError com o código do contrato', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(409, { error: { code: 'slot_taken', message: 'Indisponível' } }))
    const api = createPublicApi({ baseUrl: 'x', useMocks: false, fetchImpl })
    const e = await api.createBooking('s', {}).catch((x) => x)
    expect(e).toBeInstanceOf(ApiError)
    expect(e.status).toBe(409)
    expect(e.code).toBe('slot_taken')
    expect(friendlyError(e)).toMatch(/outro horário/i)
  })

  it('429 lê Retry-After', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(jsonRes(429, null, { 'retry-after': '42' }))
    const api = createPublicApi({ baseUrl: 'x', useMocks: false, fetchImpl })
    const e = await api.createLead({}).catch((x) => x)
    expect(e.status).toBe(429)
    expect(e.code).toBe('rate_limited')
    expect(e.retryAfter).toBe(42)
  })

  it('falha de rede vira ApiError status 0', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'))
    const api = createPublicApi({ baseUrl: 'x', useMocks: false, fetchImpl })
    const e = await api.getBusiness('s').catch((x) => x)
    expect(e).toBeInstanceOf(ApiError)
    expect(e.status).toBe(0)
    expect(friendlyError(e)).toMatch(/conexão/i)
  })

  it('resposta de erro sem JSON ainda gera ApiError', async () => {
    const res = { ok: false, status: 502, headers: { get: () => null }, json: async () => { throw new Error('no json') } }
    const api = createPublicApi({ baseUrl: 'x', useMocks: false, fetchImpl: vi.fn().mockResolvedValue(res) })
    const e = await api.getBusiness('s').catch((x) => x)
    expect(e.status).toBe(502)
    expect(friendlyError(e)).toMatch(/instabilidade/i)
  })
})

describe('createPublicApi (contrato real: URL e erros)', () => {
  const mk = (res) => {
    const fetchImpl = typeof res === 'function' ? vi.fn(res) : vi.fn().mockResolvedValue(res)
    return { fetchImpl, api: createPublicApi({ baseUrl: 'https://api.exemplo.test', useMocks: false, fetchImpl }) }
  }

  it('availability com vários serviços usa service_id=1,2 com vírgula literal', async () => {
    const { fetchImpl, api } = mk(jsonRes(200, { days: [] }))
    await api.getAvailability('c', { serviceIds: [1, 2], professionalId: 5, from: '2026-01-01', to: '2026-01-07' })
    const url = fetchImpl.mock.calls[0][0]
    expect(url).toContain('service_id=1,2')
    expect(url).not.toContain('%2C')
    expect(url).toContain('professional_id=5')
  })

  it.each([
    [410, 'token_expired'],
    [413, 'payload_too_large'],
    [503, 'payment_unavailable'],
    [503, 'service_unavailable'],
    [409, 'idempotency_conflict'],
    [409, 'cancel_window_closed'],
    [409, 'not_allowed'],
    [409, 'already_cancelled'],
  ])('%i %s vira ApiError com código, correlationId e mensagem amigável', async (status, code) => {
    const { api } = mk(jsonRes(status, { error: { code, message: 'x', correlation_id: 'cid-1' } }))
    const e = await api.getBooking('t').catch((x) => x)
    expect(e).toBeInstanceOf(ApiError)
    expect(e.status).toBe(status)
    expect(e.code).toBe(code)
    expect(e.correlationId).toBe('cid-1')
    expect(friendlyError(e).length).toBeGreaterThan(10)
  })

  it('timeout (AbortError) vira ApiError timeout', async () => {
    const abort = Object.assign(new Error('aborted'), { name: 'AbortError' })
    const { api } = mk(() => Promise.reject(abort))
    const e = await api.getBusiness('s').catch((x) => x)
    expect(e).toBeInstanceOf(ApiError)
    expect(e.code).toBe('timeout')
  })

  it('2xx com corpo que não é objeto vira invalid_response', async () => {
    const { api } = mk(jsonRes(200, null))
    const e = await api.getBusiness('s').catch((x) => x)
    expect(e).toBeInstanceOf(ApiError)
    expect(e.code).toBe('invalid_response')
  })
})

describe('createPublicApi (mock)', () => {
  const api = createPublicApi({ useMocks: true })
  const customer = (name = 'Cliente Teste') => ({ name, phone: '+5511912345678' })
  const base = (over = {}) => ({
    service_ids: [2],
    professional_id: 11,
    start: `${addDays(todayInTz('America/Sao_Paulo'), 5)}T10:00`,
    customer: customer(),
    consent: true,
    idempotency_key: newIdempotencyKey(),
    turnstile_token: 'dev-bypass',
    ...over,
  })

  beforeEach(() => resetMock())

  it('carrega empresa, serviços, profissionais e tema', async () => {
    const r = await api.getBusiness('clinica-exemplo')
    expect(r.company.theme.primary_color).toMatch(/^#/)
    expect(r.company.powered_by).toBe(true)
    expect(r.services.length).toBeGreaterThan(0)
    expect(r.professionals.length).toBeGreaterThan(0)
    expect((await api.getBusiness('barbearia-exemplo')).company.powered_by).toBe(false)
  })

  it('slug desconhecido retorna 404', async () => {
    const e = await api.getBusiness('nao-existe').catch((x) => x)
    expect(e.status).toBe(404)
  })

  it('disponibilidade devolve dias com horários HH:MM', async () => {
    const from = addDays(todayInTz('America/Sao_Paulo'), 1)
    const r = await api.getAvailability('clinica-exemplo', { serviceId: 2, from, to: addDays(from, 13) })
    expect(r.days).toHaveLength(14)
    const slots = r.days.flatMap((d) => d.slots)
    expect(slots.length).toBeGreaterThan(0)
    expect(slots[0].start).toMatch(/^\d{2}:\d{2}$/)
  })

  it('cria agendamento sem sinal: confirmado, sem payment e com manage_token', async () => {
    const r = await api.createBooking('clinica-exemplo', base())
    expect(r.booking.status).toBe('confirmed')
    expect(r.payment).toBeUndefined()
    expect(r.manage_token).toBeTruthy()
  })

  it('serviço com sinal retorna Pix e fica pendente', async () => {
    const r = await api.createBooking('clinica-exemplo', base({ service_ids: [1] }))
    expect(r.booking.status).toBe('pending_payment')
    expect(r.payment.pix_copy_paste).toBeTruthy()
    expect(r.payment.pix_qr_base64).toMatch(/^data:image\//)
    expect(new Date(r.payment.expires_at).getTime()).toBeGreaterThan(Date.now())
  })

  it('idempotency_key repetida devolve o mesmo agendamento', async () => {
    const payload = base()
    const a = await api.createBooking('clinica-exemplo', payload)
    const b = await api.createBooking('clinica-exemplo', payload)
    expect(b.manage_token).toBe(a.manage_token)
  })

  it('mesmo horário com outra chave -> 409 slot_taken', async () => {
    await api.createBooking('clinica-exemplo', base())
    const e = await api.createBooking('clinica-exemplo', base({ idempotency_key: newIdempotencyKey() })).catch((x) => x)
    expect(e.status).toBe(409)
    expect(e.code).toBe('slot_taken')
  })

  it('gatilhos simulam 409, 429 e falha de rede', async () => {
    expect((await api.createBooking('clinica-exemplo', base({ customer: customer('Teste conflito') })).catch((x) => x)).status).toBe(409)
    expect((await api.createBooking('clinica-exemplo', base({ customer: customer('Teste limite') })).catch((x) => x)).status).toBe(429)
    expect((await api.createBooking('clinica-exemplo', base({ customer: customer('Teste rede') })).catch((x) => x)).status).toBe(0)
  })

  it('exige consentimento LGPD e token Turnstile', async () => {
    expect((await api.createBooking('clinica-exemplo', base({ consent: false })).catch((x) => x)).code).toBe('consent_required')
    expect((await api.createBooking('clinica-exemplo', base({ turnstile_token: '' })).catch((x) => x)).code).toBe('turnstile_failed')
  })

  it('consulta, remarca e cancela pelo manage_token', async () => {
    const created = await api.createBooking('clinica-exemplo', base())
    const view = await api.getBooking(created.manage_token)
    expect(view.booking.status).toBe('confirmed')
    expect(view.company.name).toBe('Clínica Exemplo')

    const novo = `${addDays(todayInTz('America/Sao_Paulo'), 6)}T11:00`
    const moved = await api.rescheduleBooking(created.manage_token, novo)
    expect(moved.booking.start).toBe(novo)

    const cancelled = await api.cancelBooking(created.manage_token)
    expect(cancelled.booking.status).toBe('cancelled')
    expect((await api.cancelBooking(created.manage_token).catch((x) => x)).code).toBe('already_cancelled')
    expect((await api.getBooking('token-invalido').catch((x) => x)).status).toBe(404)
  })

  it('lead exige Turnstile e campos obrigatórios', async () => {
    const lead = { name: 'Ana', whatsapp: '+5511912345678', segment: 'clinicas', consent: true, source: 'site' }
    expect(await api.createLead({ ...lead, turnstile_token: 't' })).toEqual({ ok: true })
    expect((await api.createLead(lead).catch((x) => x)).code).toBe('turnstile_failed')
    expect((await api.createLead({ ...lead, consent: false, turnstile_token: 't' }).catch((x) => x)).code).toBe('consent_required')
  })
})

describe('mock alinhado ao contrato do core', () => {
  const api = createPublicApi({ useMocks: true })
  const base = (over = {}) => ({
    service_ids: [2],
    professional_id: 11,
    start: `${addDays(todayInTz('America/Sao_Paulo'), 5)}T10:00`,
    customer: { name: 'Cliente Teste', phone: '+5511912345678' },
    consent: true,
    idempotency_key: newIdempotencyKey(),
    turnstile_token: 'dev-bypass',
    ...over,
  })
  const named = (name, over = {}) => base({ customer: { name, phone: '+5511912345678' }, ...over })
  const later = (n, hh = '11:00') => `${addDays(todayInTz('America/Sao_Paulo'), n)}T${hh}`

  beforeEach(() => resetMock())

  it('booking.id é string opaca e há deposit_cents/payment.amount_cents', async () => {
    const free = await api.createBooking('clinica-exemplo', base())
    expect(typeof free.booking.id).toBe('string')
    expect(free.booking.deposit_cents).toBe(0)
    const paid = await api.createBooking('clinica-exemplo', base({ service_ids: [1], start: later(6, '10:00') }))
    expect(paid.booking.deposit_cents).toBeGreaterThan(0)
    expect(paid.payment.amount_cents).toBe(paid.booking.deposit_cents)
    expect(paid.payment.provider).toBe('asaas')
  })

  it('mesma chave com payload diferente -> 409 idempotency_conflict', async () => {
    const payload = base()
    await api.createBooking('clinica-exemplo', payload)
    const e = await api.createBooking('clinica-exemplo', { ...payload, start: later(7) }).catch((x) => x)
    expect(e.status).toBe(409)
    expect(e.code).toBe('idempotency_conflict')
  })

  it('GET devolve payment enquanto pending_payment; policy só remarca se confirmado', async () => {
    const pend = await api.createBooking('clinica-exemplo', base({ service_ids: [1] }))
    const view = await api.getBooking(pend.manage_token)
    expect(view.booking.status).toBe('pending_payment')
    expect(view.payment.pix_copy_paste).toBeTruthy()
    expect(view.policy.can_cancel).toBe(true)
    expect(view.policy.can_reschedule).toBe(false)
    expect(view.policy.min_notice_hours).toBeGreaterThan(0)
    const ok = await api.getBooking((await api.createBooking('clinica-exemplo', base({ start: later(6) }))).manage_token)
    expect(ok.policy.can_reschedule).toBe(true)
    expect(ok.payment).toBeUndefined()
  })

  it('Pix vencido é aplicado na leitura: cancelled/payment_expired e a vaga volta', async () => {
    const created = await api.createBooking('clinica-exemplo', named('Teste expira', { service_ids: [1] }))
    const real = Date.now()
    const spy = vi.spyOn(Date, 'now').mockReturnValue(real + 60_000)
    try {
      const view = await api.getBooking(created.manage_token)
      expect(view.booking.status).toBe('cancelled')
      expect(view.booking.cancellation_reason).toBe('payment_expired')
      expect(view.payment).toBeUndefined()
    } finally {
      spy.mockRestore()
    }
    const again = await api.createBooking('clinica-exemplo', base({ service_ids: [1] }))
    expect(again.booking.status).toBe('pending_payment')
  })

  it('Pix pago é confirmado após o tempo simulado', async () => {
    const created = await api.createBooking('clinica-exemplo', base({ service_ids: [1] }))
    const spy = vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 20_000)
    try {
      expect((await api.getBooking(created.manage_token)).booking.status).toBe('confirmed')
    } finally {
      spy.mockRestore()
    }
  })

  it('cancelamento registra cancellation_reason=customer', async () => {
    const created = await api.createBooking('clinica-exemplo', base())
    const r = await api.cancelBooking(created.manage_token)
    expect(r.booking.cancellation_reason).toBe('customer')
  })

  it.each([
    ['pagamento', 503, 'payment_unavailable'],
    ['indisponivel', 503, 'service_unavailable'],
    ['grande', 413, 'payload_too_large'],
  ])('gatilho "%s" -> %i %s', async (name, status, code) => {
    const e = await api.createBooking('clinica-exemplo', named(`Teste ${name}`)).catch((x) => x)
    expect(e.status).toBe(status)
    expect(e.code).toBe(code)
  })

  it('gatilho "janela": cancelar e remarcar dão 409 cancel_window_closed e policy fecha', async () => {
    const created = await api.createBooking('clinica-exemplo', named('Teste janela'))
    const view = await api.getBooking(created.manage_token)
    expect(view.policy.can_cancel).toBe(false)
    expect(view.policy.can_reschedule).toBe(false)
    expect((await api.cancelBooking(created.manage_token).catch((x) => x)).code).toBe('cancel_window_closed')
    expect((await api.rescheduleBooking(created.manage_token, later(8)).catch((x) => x)).code).toBe('cancel_window_closed')
  })

  it('gatilho "linkvencido": token devolve 410 token_expired', async () => {
    const created = await api.createBooking('clinica-exemplo', named('Teste linkvencido'))
    const e = await api.getBooking(created.manage_token).catch((x) => x)
    expect(e.status).toBe(410)
    expect(e.code).toBe('token_expired')
  })

  it('remarcar agendamento pendente de pagamento -> 409 not_allowed', async () => {
    const created = await api.createBooking('clinica-exemplo', base({ service_ids: [1] }))
    expect((await api.rescheduleBooking(created.manage_token, later(8)).catch((x) => x)).code).toBe('not_allowed')
  })

  it('disponibilidade aceita service_id=1,2', async () => {
    const from = addDays(todayInTz('America/Sao_Paulo'), 1)
    const r = await api.getAvailability('clinica-exemplo', { serviceIds: [1, 2], from, to: addDays(from, 6) })
    expect(r.days).toHaveLength(7)
  })
})

describe('newIdempotencyKey', () => {
  it('gera chaves distintas', () => {
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey())
  })
})
