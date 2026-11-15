// Backend fictício para desenvolver e testar a UI sem o core (VITE_USE_MOCKS=true).
// Simula os contratos /public/* do LAUNCH-PLAN. Todos os dados são FICTÍCIOS (sem pessoas/números reais).
//
// Gatilhos determinísticos (use no campo "nome" do cliente ao agendar):
//   "conflito" -> 409 slot_taken   "limite" -> 429 rate_limited   "erro" -> 500   "rede" -> falha de rede
//   "expira"   -> Pix que expira em 25 s e nunca é pago
// Serviços com requires_payment geram Pix; o Pix de exemplo é "pago" automaticamente após ~12 s.
import { ApiError } from './apiError.js'
import { addDays, todayInTz } from '../lib/datetime.js'

const TZ = 'America/Sao_Paulo'

const BUSINESSES = {
  'clinica-exemplo': {
    company: {
      name: 'Clínica Exemplo',
      slug: 'clinica-exemplo',
      logo_url: null,
      description: 'Página de demonstração do AgendasPro. Dados fictícios.',
      address: 'Rua Exemplo, 123 — Centro, Cidade Exemplo/UF',
      phone: '(00) 00000-0000',
      timezone: TZ,
      hours: 'Seg a sex, 9h às 18h',
      instagram_url: null,
      theme: { primary_color: '#0e7490' },
      powered_by: true,
    },
    services: [
      { id: 1, name: 'Consulta de avaliação', description: 'Primeira consulta com avaliação completa.', duration_min: 40, price_cents: 15000, deposit_cents: 3000, requires_payment: true },
      { id: 2, name: 'Retorno', description: 'Retorno em até 30 dias da consulta.', duration_min: 20, price_cents: 8000, deposit_cents: 0, requires_payment: false },
      { id: 3, name: 'Procedimento rápido', description: null, duration_min: 30, price_cents: 12000, deposit_cents: 2500, requires_payment: true },
    ],
    professionals: [
      { id: 11, name: 'Profissional Exemplo A', photo_url: null, service_ids: [1, 2, 3] },
      { id: 12, name: 'Profissional Exemplo B', photo_url: null, service_ids: [1, 2] },
      { id: 13, name: 'Profissional Exemplo C', photo_url: null, service_ids: [3] },
    ],
  },
  'barbearia-exemplo': {
    company: {
      name: 'Barbearia Exemplo',
      slug: 'barbearia-exemplo',
      logo_url: null,
      description: 'Segunda página de demonstração (sem cobrança de sinal, sem marca AgendasPro).',
      address: 'Av. Exemplo, 456 — Bairro Exemplo',
      phone: null,
      timezone: TZ,
      hours: 'Ter a sáb, 10h às 19h',
      instagram_url: null,
      theme: { primary_color: '#b45309' },
      powered_by: false,
    },
    services: [
      { id: 21, name: 'Corte', description: null, duration_min: 30, price_cents: 5000, deposit_cents: 0, requires_payment: false },
      { id: 22, name: 'Barba', description: null, duration_min: 30, price_cents: 4000, deposit_cents: 0, requires_payment: false },
    ],
    professionals: [
      { id: 31, name: 'Barbeiro Exemplo 1', photo_url: null, service_ids: [21, 22] },
      { id: 32, name: 'Barbeiro Exemplo 2', photo_url: null, service_ids: [21, 22] },
    ],
  },
}

// Estado em memória do mock (apenas dev/teste)
const store = { bookings: new Map(), taken: new Set(), seq: 1000, byKey: new Map() }

export function resetMock() {
  store.bookings.clear()
  store.taken.clear()
  store.byKey.clear()
  store.seq = 1000
}

const err = (status, code, message, extra) => new ApiError(status, code, message, extra)

function hash(str) {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const pad = (n) => String(n).padStart(2, '0')

function dayOfWeek(ymd) {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay()
}

function nowParts() {
  const now = new Date()
  const date = todayInTz(TZ, now)
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(now)
  return { date, time }
}

function slotKey(slug, profId, start) {
  return `${slug}|${profId}|${start}`
}

function slotsForDay(slug, biz, date, serviceId, professionalId) {
  if (biz.company.slug === 'barbearia-exemplo' ? dayOfWeek(date) === 0 || dayOfWeek(date) === 1 : dayOfWeek(date) === 0 || dayOfWeek(date) === 6) return []
  const profs = biz.professionals.filter((p) => p.service_ids.includes(serviceId) && (!professionalId || p.id === professionalId))
  const now = nowParts()
  const out = []
  for (let h = 9; h < 18; h++) {
    for (const m of [0, 30]) {
      if (h === 12) continue
      const time = `${pad(h)}:${pad(m)}`
      if (date < now.date || (date === now.date && time <= addMinutes(now.time, 120))) continue
      const start = `${date}T${time}`
      for (const p of profs) {
        if (hash(`${slug}${date}${time}${p.id}`) % 10 < 4) continue // ~60% livres
        if (store.taken.has(slotKey(slug, p.id, start))) continue
        out.push({ start: time, professional_id: p.id })
      }
    }
  }
  return out
}

function addMinutes(hhmm, mins) {
  const [h, m] = hhmm.split(':').map(Number)
  const t = h * 60 + m + mins
  return t >= 24 * 60 ? '23:59' : `${pad(Math.floor(t / 60))}:${pad(t % 60)}`
}

function qrSvgDataUri() {
  // padrão ilustrativo (NÃO é um QR Code real/pagável)
  let cells = ''
  for (let y = 0; y < 21; y++)
    for (let x = 0; x < 21; x++) if (hash(`q${x}-${y}`) % 3 === 0) cells += `<rect x="${x}" y="${y}" width="1" height="1"/>`
  const finder = (x, y) => `<rect x="${x}" y="${y}" width="7" height="7"/><rect x="${x + 1}" y="${y + 1}" width="5" height="5" fill="#fff"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-1 -1 23 23"><rect x="-1" y="-1" width="23" height="23" fill="#fff"/><g fill="#000">${cells}${finder(0, 0)}${finder(14, 0)}${finder(0, 14)}</g></svg>`
  return `data:image/svg+xml;base64,${btoa(svg)}`
}

function endOf(start, durationMin) {
  const [date, time] = start.split('T')
  return `${date}T${addMinutes(time, durationMin)}`
}

function publicBooking(b) {
  // confirma o Pix de exemplo depois de alguns segundos
  if (b.status === 'pending_payment' && b.payAt && Date.now() >= b.payAt) b.status = 'confirmed'
  return {
    id: b.id,
    status: b.status,
    start: b.start,
    end: b.end,
    service_ids: b.service_ids,
    service_names: b.service_names,
    professional_id: b.professional_id,
    professional_name: b.professional_name,
  }
}

function getBiz(slug) {
  const biz = BUSINESSES[slug]
  if (!biz) throw err(404, 'not_found', 'Página de agendamento não encontrada.')
  return biz
}

function findByToken(token) {
  const b = store.bookings.get(token)
  if (!b) throw err(404, 'not_found', 'Agendamento não encontrado ou link expirado.')
  return b
}

function checkTriggers(name) {
  const n = String(name || '').toLowerCase()
  if (n.includes('rede')) throw err(0, 'network_error', 'Sem conexão com o servidor.')
  if (n.includes('limite')) throw err(429, 'rate_limited', 'Muitas tentativas. Aguarde um instante.', { retryAfter: 30 })
  if (n.includes('erro')) throw err(500, 'internal_error', 'Erro interno simulado.')
  if (n.includes('conflito')) throw err(409, 'slot_taken', 'Horário indisponível.')
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms))

/** Roteador do mock: mesmo contrato do core. `path` é relativo a /public. */
export async function handle(method, path, { query = {}, body = {} } = {}) {
  await delay(typeof process !== 'undefined' && process.env?.VITEST ? 0 : 250)
  let m

  if (method === 'POST' && path === '/leads') {
    checkTriggers(body.name)
    if (!body.turnstile_token) throw err(400, 'turnstile_failed', 'Verificação de segurança falhou.')
    if (!body.name || !body.whatsapp || !body.segment) throw err(400, 'validation_error', 'Preencha nome, WhatsApp e segmento.')
    return { ok: true }
  }

  if (method === 'GET' && (m = path.match(/^\/b\/([^/]+)$/))) {
    const biz = getBiz(m[1])
    return { company: biz.company, services: biz.services, professionals: biz.professionals }
  }

  if (method === 'GET' && (m = path.match(/^\/b\/([^/]+)\/availability$/))) {
    const slug = m[1]
    const biz = getBiz(slug)
    const serviceId = Number(query.service_id)
    if (!biz.services.some((s) => s.id === serviceId)) throw err(400, 'validation_error', 'Serviço inválido.')
    const from = query.from
    const to = query.to
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from || '') || !/^\d{4}-\d{2}-\d{2}$/.test(to || '')) throw err(400, 'validation_error', 'Período inválido.')
    const days = []
    for (let d = from, i = 0; d <= to && i < 14; d = addDays(d, 1), i++) {
      days.push({ date: d, slots: slotsForDay(slug, biz, d, serviceId, query.professional_id ? Number(query.professional_id) : null) })
    }
    return { timezone: TZ, days }
  }

  if (method === 'POST' && (m = path.match(/^\/b\/([^/]+)\/bookings$/))) {
    const slug = m[1]
    const biz = getBiz(slug)
    const { service_ids, professional_id, start, customer, consent, idempotency_key } = body
    if (!idempotency_key) throw err(400, 'validation_error', 'idempotency_key obrigatório.')
    if (store.byKey.has(idempotency_key)) return store.byKey.get(idempotency_key)
    if (!body.turnstile_token) throw err(400, 'turnstile_failed', 'Verificação de segurança falhou.')
    checkTriggers(customer?.name)
    if (!consent) throw err(400, 'consent_required', 'É necessário aceitar o tratamento de dados.')
    if (!customer?.name || !customer?.phone) throw err(400, 'validation_error', 'Informe nome e WhatsApp.')
    const services = (service_ids || []).map((id) => biz.services.find((s) => s.id === id)).filter(Boolean)
    if (!services.length) throw err(400, 'validation_error', 'Selecione um serviço.')
    const prof = biz.professionals.find((p) => p.id === professional_id) || biz.professionals.find((p) => p.service_ids.includes(services[0].id))
    const key = slotKey(slug, prof.id, start)
    if (store.taken.has(key)) throw err(409, 'slot_taken', 'Horário indisponível.')
    store.taken.add(key)
    const id = ++store.seq
    const token = `mock.${id}.${hash(`${id}${start}`).toString(36)}`
    const duration = services.reduce((a, s) => a + s.duration_min, 0)
    const needsPay = services.some((s) => s.requires_payment)
    const expiring = String(customer.name).toLowerCase().includes('expira')
    const booking = {
      id,
      slug,
      status: needsPay ? 'pending_payment' : 'confirmed',
      start,
      end: endOf(start, duration),
      service_ids: services.map((s) => s.id),
      service_names: services.map((s) => s.name),
      professional_id: prof.id,
      professional_name: prof.name,
      payAt: needsPay && !expiring ? Date.now() + 12000 : null,
    }
    store.bookings.set(token, booking)
    const res = { booking: publicBooking(booking), manage_token: token }
    if (needsPay) {
      res.payment = {
        provider: 'asaas',
        pix_qr_base64: qrSvgDataUri(),
        pix_copy_paste: `00020126EXEMPLO-FICTICIO-NAO-PAGAVEL${id}5204000053039865802BR`,
        expires_at: new Date(Date.now() + (expiring ? 25000 : 15 * 60000)).toISOString(),
      }
    }
    store.byKey.set(idempotency_key, res)
    return res
  }

  if ((m = path.match(/^\/bookings\/([^/]+)(\/cancel|\/reschedule)?$/))) {
    const b = findByToken(decodeURIComponent(m[1]))
    const biz = getBiz(b.slug)
    const view = () => ({
      booking: publicBooking(b),
      company: { name: biz.company.name, slug: b.slug, address: biz.company.address, phone: biz.company.phone, timezone: TZ },
      policy: { can_cancel: b.status !== 'cancelled', can_reschedule: b.status !== 'cancelled', min_notice_hours: 2 },
    })
    if (method === 'GET' && !m[2]) return view()
    if (method === 'POST' && m[2] === '/cancel') {
      if (b.status === 'cancelled') throw err(409, 'already_cancelled', 'Este agendamento já foi cancelado.')
      b.status = 'cancelled'
      store.taken.delete(slotKey(b.slug, b.professional_id, b.start))
      return view()
    }
    if (method === 'POST' && m[2] === '/reschedule') {
      if (b.status === 'cancelled') throw err(409, 'already_cancelled', 'Este agendamento foi cancelado.')
      const start = body.start
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(start || '')) throw err(400, 'validation_error', 'Horário inválido.')
      const k = slotKey(b.slug, b.professional_id, start)
      if (store.taken.has(k)) throw err(409, 'slot_taken', 'Horário indisponível.')
      store.taken.delete(slotKey(b.slug, b.professional_id, b.start))
      store.taken.add(k)
      const dur = b.service_ids.reduce((a, id) => a + (biz.services.find((s) => s.id === id)?.duration_min || 30), 0)
      b.start = start
      b.end = endOf(start, dur)
      return view()
    }
  }

  throw err(404, 'not_found', 'Rota inexistente no mock.')
}
