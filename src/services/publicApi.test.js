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
    expect(await api.createLead({ name: 'Ana', whatsapp: '+5511912345678', segment: 'clinicas', turnstile_token: 't' })).toEqual({ ok: true })
    expect((await api.createLead({ name: 'Ana', whatsapp: '+5511912345678', segment: 'clinicas' }).catch((x) => x)).code).toBe('turnstile_failed')
  })
})

describe('newIdempotencyKey', () => {
  it('gera chaves distintas', () => {
    expect(newIdempotencyKey()).not.toBe(newIdempotencyKey())
  })
})
