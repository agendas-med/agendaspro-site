// MOCK DO CHAT — SÓ DESENVOLVIMENTO. Importado dinamicamente por chatApi.js atrás de `import.meta.env.DEV`
// (com VITE_USE_MOCK=true); não deve existir no bundle de produção (marcador verificado após o build).
// Gatilhos de teste (digite na conversa): "429" -> rate_limited com Retry-After; "pausa" -> cooldown;
// "rapido" -> too_fast; "erro" -> falha 500; "lento" -> resposta demorada; "expirar" -> sessão expira;
// "bloquear" -> session_blocked; "limite" -> última mensagem permitida (message_limit na seguinte);
// "degradar" -> resposta degraded; "planos" -> action plans; "horarios" -> action slots.
import { ApiError } from './apiError.js'

export const CHAT_MOCK_MARKER = '__AGENDASPRO_CHAT_MOCK_DEV_ONLY__'

const SESSION_MS = 30 * 60 * 1000
const state = { sessions: new Map(), counter: 0 }
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

const getSession = (token) => {
  const s = state.sessions.get(token)
  if (!s) throw new ApiError(401, 'invalid_session', 'Sessão inválida.')
  if (s.forceExpired || Date.now() >= s.expiresAt) throw new ApiError(401, 'session_expired', 'Sessão expirada.')
  return s
}

function reply(s, text) {
  const t = text.toLowerCase()
  const business = s.audience === 'business'
  const base = { suggestions: [], actions: [], proactive_hint: null, source: 'faq', degraded: false }
  if (/planos?|pre[cç]o|quanto|comiss/.test(t) && business) {
    return {
      ...base,
      reply:
        'O AgendasPro tem plano **Gratuito** (comissão de 5% por agendamento pago) e **Premium** (comissão de 0,5%).\nVeja os valores abaixo e comece sem cartão de crédito.',
      suggestions: ['Como funciona a cobrança?', 'Quero falar com a equipe'],
      actions: [
        {
          type: 'plans',
          plans: [
            { code: 'free', name: 'Gratuito', price_cents: 0, commission_bps: 500 },
            { code: 'premium', name: 'Premium', price_cents: 4990, commission_bps: 50 },
          ],
        },
      ],
      proactive_hint: { type: 'cta', text: 'Quer testar de graça?', action: 'signup' },
    }
  }
  if (/hor[aá]rio|livre|vaga/.test(t) && !business) {
    return {
      ...base,
      reply: 'Encontrei alguns horários livres. Para reservar, abra a página de agendamento.',
      actions: [
        {
          type: 'slots',
          service_id: 1,
          slots: [
            { date: '2026-11-20', time: '09:00' },
            { date: '2026-11-20', time: '10:30' },
            { date: '2026-11-21', time: '14:00' },
          ],
          booking_url: `/b/${s.company?.slug || 'clinica-exemplo'}`,
        },
      ],
      proactive_hint: { type: 'cta', text: 'Pronto para reservar?', action: 'booking_link' },
    }
  }
  if (/equipe|contato|falar|humano|lead/.test(t) && business) {
    return {
      ...base,
      reply: 'Claro! Deixe seu contato e a nossa equipe fala com você pelo WhatsApp. Se preferir, chame direto no WhatsApp.',
      actions: [{ type: 'lead_form', endpoint: '/public/chat/lead', requires_consent: true }],
    }
  }
  if (s.count >= 3 && business && !s.lead) {
    return {
      ...base,
      source: 'ai',
      reply: 'Entendi. Posso explicar mais sobre **agenda online**, **cobrança via Pix** e **lembretes por WhatsApp**.',
      suggestions: ['Quanto custa?', 'Como cobrar sinal?'],
      proactive_hint: { type: 'lead_form', text: 'Prefere falar com uma pessoa da equipe?', action: 'lead_form' },
    }
  }
  return {
    ...base,
    source: 'ai',
    reply: business
      ? 'O AgendasPro reúne agenda, página de agendamento, cobrança via Pix e lembretes. Quer saber sobre **planos** ou **comissão**?'
      : 'Posso ajudar com dúvidas sobre o estabelecimento. Para marcar um horário, use a página de agendamento. Quer ver horários livres?',
    suggestions: business ? ['Quanto custa?', 'Quero falar com a equipe'] : ['Quais horários estão livres?'],
  }
}

async function message(token, body, onDelta) {
  const s = getSession(token)
  if (s.status === 'blocked') throw new ApiError(403, 'session_blocked', 'Sessão bloqueada.')
  if (s.status === 'closed') throw new ApiError(409, 'session_closed', 'Sessão encerrada.')
  const text = String(body.message || '')
  const id = body.client_msg_id
  if (id && s.replies.has(id)) return { ...s.replies.get(id), replayed: true }
  const t = text.toLowerCase()
  if (text.length > 500) throw new ApiError(413, 'message_too_long', 'Mensagem longa demais.')
  if (t.includes('429')) throw new ApiError(429, 'rate_limited', 'Muitas mensagens.', { retryAfter: 8 })
  if (t.includes('rapido')) throw new ApiError(429, 'too_fast', 'Muito rápido.', { retryAfter: 2 })
  if (t.includes('pausa')) throw new ApiError(429, 'cooldown', 'Pausa.', { retryAfter: 15 })
  if (t.includes('erro')) {
    if (!s.failedOnce) {
      s.failedOnce = true
      throw new ApiError(500, 'internal_error', 'Erro interno.')
    }
  }
  if (t.includes('expirar')) {
    s.forceExpired = true
    throw new ApiError(401, 'session_expired', 'Sessão expirada.')
  }
  if (t.includes('bloquear')) {
    s.status = 'blocked'
    throw new ApiError(403, 'session_blocked', 'Sessão bloqueada.')
  }
  if (s.count >= s.limits.max_messages) throw new ApiError(429, 'message_limit', 'Limite de mensagens.')

  s.count += 1
  await wait(t.includes('lento') ? 4000 : 500)
  const r = t.includes('degradar')
    ? {
        reply: 'No momento respondo só dúvidas frequentes. Para algo específico, fale com a nossa equipe.',
        suggestions: [],
        actions: [{ type: 'handoff', label: 'Falar no WhatsApp', url: 'https://wa.me/5500000000000' }],
        proactive_hint: null,
        source: 'fallback',
        degraded: true,
      }
    : reply(s, text)
  const left = t.includes('limite') ? 0 : Math.max(0, s.limits.max_messages - s.count)
  if (t.includes('limite')) s.limits.max_messages = s.count
  const out = { ...r, remaining: { messages: left, tokens: Math.max(0, 8000 - s.count * 400) } }
  if (onDelta) {
    const words = r.reply.split(/(\s+)/)
    for (const w of words) {
      onDelta(w)
      await wait(25)
    }
  }
  if (id) s.replies.set(id, out)
  s.history.push({ id: ++state.counter, role: 'user', content: text, created_at: new Date().toISOString() })
  s.history.push({ id: ++state.counter, role: 'assistant', content: r.reply, created_at: new Date().toISOString(), suggestions: r.suggestions, actions: r.actions })
  return out
}

export async function handle(method, path, { token, body = {}, onDelta } = {}) {
  await wait(120)
  if (method === 'POST' && path === '/session') {
    if (body.audience !== 'customer' && body.audience !== 'business') throw new ApiError(400, 'validation_error', 'audience inválido')
    if (!body.turnstile_token) throw new ApiError(400, 'turnstile_failed', 'Verificação ausente.')
    let company = null
    if (body.company_slug) {
      if (body.company_slug !== 'clinica-exemplo') throw new ApiError(404, 'not_found', 'Não encontrado.')
      company = { name: 'Clínica Exemplo', slug: 'clinica-exemplo' }
    }
    const expiresAt = Date.now() + SESSION_MS
    const tok = `cs1.mock${++state.counter}.${expiresAt}.sig`
    state.sessions.set(tok, {
      audience: body.audience,
      company,
      expiresAt,
      status: 'active',
      count: 0,
      lead: false,
      rated: false,
      replies: new Map(),
      history: [],
      limits: { max_messages: 20, max_tokens: 8000, max_chars: 500 },
    })
    const s = state.sessions.get(tok)
    return { session_token: tok, expires_at: new Date(expiresAt).toISOString(), limits: { ...s.limits }, audience: body.audience, company }
  }
  const s = getSession(token)
  if (method === 'GET' && path === '/session') {
    return {
      audience: s.audience,
      status: s.status,
      expires_at: new Date(s.expiresAt).toISOString(),
      company: s.company,
      limits: { ...s.limits },
      remaining: { messages: Math.max(0, s.limits.max_messages - s.count), tokens: Math.max(0, 8000 - s.count * 400) },
      messages: s.history.slice(-40),
    }
  }
  if (method === 'POST' && path === '/message') return message(token, body, onDelta)
  if (method === 'POST' && path === '/session/close') {
    s.status = 'closed'
    return { ok: true }
  }
  if (method === 'POST' && path === '/rating') {
    if (s.rated) throw new ApiError(409, 'already_rated', 'Já avaliado.')
    s.rated = true
    return { ok: true }
  }
  if (method === 'POST' && path === '/lead') {
    if (s.audience !== 'business') throw new ApiError(400, 'validation_error', 'Somente empresas.')
    if (s.lead) throw new ApiError(409, 'lead_exists', 'Lead já enviado.')
    if (body.consent !== true || !body.name || !body.whatsapp) throw new ApiError(400, 'validation_error', 'Dados inválidos.')
    s.lead = true
    return { ok: true, reply: 'Recebemos seu contato! Nossa equipe vai falar com você pelo WhatsApp em breve.' }
  }
  throw new ApiError(404, 'not_found', 'Rota inexistente.')
}
