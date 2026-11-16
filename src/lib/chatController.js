// Estado e regras do chat público (sem DOM: relógio, storage, API e sleep são injetados => testável em Node).
// O componente só liga a UI a este controlador. Contrato: agendaspro-core/docs/contratos-f5a.md.
import { reactive } from 'vue'
import { chatErrorInfo } from './chatErrors.js'
import { newIdempotencyKey } from './idempotency.js'
import { normalizeActions, normalizeHint, normalizeSuggestions } from './chatActions.js'
import { clearSaved, markChatDisabled, readSaved, writeSaved } from './chatStorage.js'

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms))
const DEFAULT_MAX_CHARS = 500
const EXPIRY_MARGIN_MS = 2000

const GREETING = {
  business:
    'Olá! Sou o assistente de IA do AgendasPro. Posso tirar dúvidas sobre planos, comissões e recursos, e passar o seu contato para a nossa equipe.',
  customer:
    'Olá! Sou o assistente de IA. Posso ajudar com dúvidas sobre o estabelecimento e a encontrar o caminho para agendar. O agendamento em si é feito na página de agendamento.',
}
const GREETING_SUGGESTIONS = {
  business: ['Quanto custa o AgendasPro?', 'Como funciona a comissão?', 'Quero falar com a equipe'],
  customer: ['Quais serviços existem?', 'Quais horários estão livres?', 'Como faço para agendar?'],
}

/**
 * @param {object} deps
 * @param {ReturnType<import('../services/chatApi.js').createChatApi>} deps.api
 * @param {{getItem:Function,setItem:Function,removeItem:Function}} deps.storage sessionStorage (ou memória)
 * @param {string|null} [deps.slug] página /b/:slug (company_slug), ou null no site
 */
export function createChatController({
  api,
  storage,
  slug = null,
  now = () => Date.now(),
  sleep = defaultSleep,
  newId = newIdempotencyKey,
  minIntervalMs = 1200,
  maxInProgressRetries = 3,
} = {}) {
  let contextSlug = slug || null
  let token = null
  let seq = 0
  let lastSendAt = 0
  let disposed = false
  let aborter = null

  const state = reactive({
    phase: 'gate', // gate | verifying | chat | ended | disabled
    audience: null, // 'customer' | 'business'
    endReason: null, // expired | closed | closed_by_user | blocked | message_limit | not_found | unavailable | rate_limited | restore_failed
    endText: '',
    startError: null, // {text, retryable}
    starting: false,
    restoring: false,
    company: null, // {name, slug}
    limits: { max_messages: null, max_tokens: null, max_chars: DEFAULT_MAX_CHARS },
    remaining: null, // {messages, tokens}
    expiresAt: 0,
    messages: [],
    draft: '',
    busy: false,
    typing: false,
    notice: null, // {kind, text}
    retryUntil: 0,
    retryIn: 0,
    inputError: '',
    leadOpen: false,
    leadSent: false,
    leadBusy: false,
    leadError: '',
    closing: false,
    rated: false,
    ratingBusy: false,
    ratingError: '',
  })

  // o contrato exige sessão ativa para o lead; ao atingir o teto de mensagens ela continua ativa no core
  const leadAllowed = () => state.phase === 'chat' || (state.phase === 'ended' && state.endReason === 'message_limit')
  const nextId = () => `l${++seq}`
  const intOr = (v, d) => (Number.isFinite(Number(v)) ? Math.max(0, Math.round(Number(v))) : d)

  function push(msg) {
    state.messages.push({ id: nextId(), status: 'sent', text: '', suggestions: [], actions: [], hint: null, ...msg })
    return state.messages[state.messages.length - 1]
  }
  const dropMessage = (m) => {
    const i = state.messages.indexOf(m)
    if (i >= 0) state.messages.splice(i, 1)
  }

  function applyLimits(res) {
    const l = res?.limits || {}
    state.limits = {
      max_messages: intOr(l.max_messages, state.limits.max_messages),
      max_tokens: intOr(l.max_tokens, state.limits.max_tokens),
      max_chars: intOr(l.max_chars, state.limits.max_chars || DEFAULT_MAX_CHARS) || DEFAULT_MAX_CHARS,
    }
    if (res?.remaining) applyRemaining(res.remaining)
    else if (state.limits.max_messages !== null && !state.remaining) {
      state.remaining = { messages: state.limits.max_messages, tokens: state.limits.max_tokens }
    }
  }
  function applyRemaining(r) {
    if (!r || typeof r !== 'object') return
    state.remaining = { messages: intOr(r.messages, state.remaining?.messages ?? 0), tokens: intOr(r.tokens, state.remaining?.tokens ?? 0) }
  }

  function greet() {
    const aud = state.audience === 'business' ? 'business' : 'customer'
    const text =
      aud === 'customer' && state.company?.name
        ? `Olá! Sou o assistente de IA de ${state.company.name}. Posso ajudar com dúvidas sobre o estabelecimento e a encontrar o caminho para agendar. O agendamento em si é feito na página de agendamento.`
        : GREETING[aud]
    push({ role: 'assistant', text, source: 'local', suggestions: GREETING_SUGGESTIONS[aud] })
  }

  function persist() {
    if (token && state.audience) writeSaved(storage, contextSlug, { token, expiresAt: state.expiresAt, audience: state.audience })
  }

  function end(reason, text = '') {
    state.phase = 'ended'
    state.endReason = reason
    state.endText = text
    state.busy = false
    state.typing = false
    state.leadOpen = false
    state.retryUntil = 0
    state.retryIn = 0
    state.notice = null
    // sessão encerrada/expirada/bloqueada não deve ser restaurada ao recarregar
    clearSaved(storage, contextSlug)
    if (reason === 'expired' || reason === 'blocked') token = null
  }

  function startRetry(seconds) {
    const s = Math.max(1, Math.ceil(Number(seconds) || 1))
    state.retryUntil = now() + s * 1000
    state.retryIn = s
  }

  function resetConversation() {
    token = null
    state.endReason = null
    state.endText = ''
    state.startError = null
    state.starting = false
    state.company = null
    state.limits = { max_messages: null, max_tokens: null, max_chars: DEFAULT_MAX_CHARS }
    state.remaining = null
    state.expiresAt = 0
    state.messages = []
    state.busy = false
    state.typing = false
    state.notice = null
    state.retryUntil = 0
    state.retryIn = 0
    state.inputError = ''
    state.leadOpen = false
    state.leadSent = false
    state.leadBusy = false
    state.leadError = ''
    state.closing = false
    state.rated = false
    state.ratingBusy = false
    state.ratingError = ''
  }

  const api_ = {
    state,

    /** Passo 1: o visitante escolhe quem é. Só depois (com o token do Turnstile) a sessão é criada. */
    chooseAudience(audience) {
      if (state.phase !== 'gate' && state.phase !== 'verifying') return
      if (audience !== 'customer' && audience !== 'business') return
      state.audience = audience
      state.startError = null
      state.phase = 'verifying'
    },

    /** Volta ao passo de escolha (antes de criar a sessão). */
    backToGate() {
      if (state.phase !== 'verifying') return
      state.phase = 'gate'
      state.audience = null
      state.startError = null
    },

    clearStartError() {
      state.startError = null
    },

    /** Passo 2: cria a sessão com o token Turnstile. Uma chamada por vez; nunca repete sozinho. */
    async start(turnstileToken) {
      if (state.phase !== 'verifying' || state.starting || state.startError || !state.audience) return false
      state.starting = true
      state.startError = null
      try {
        const res = await api.createSession({ audience: state.audience, turnstileToken, companySlug: contextSlug })
        if (disposed) return false
        const exp = Date.parse(res.expires_at)
        if (typeof res.session_token !== 'string' || !res.session_token || !Number.isFinite(exp)) {
          state.startError = { text: 'Resposta inesperada do servidor. Tente de novo.', retryable: true }
          return false
        }
        token = res.session_token
        state.expiresAt = exp
        state.company = res.company && typeof res.company === 'object' ? { name: String(res.company.name || ''), slug: String(res.company.slug || '') } : null
        applyLimits(res)
        state.messages = []
        state.phase = 'chat'
        greet()
        persist()
        return true
      } catch (e) {
        const info = chatErrorInfo(e)
        if (info.kind === 'disabled') {
          markChatDisabled(storage)
          state.phase = 'disabled'
        } else if (info.kind === 'not_found') {
          // 404 conta no anti-enumeração do core: nunca repetir sozinho
          end('not_found', 'Não encontramos o atendimento desta página.')
        } else if (info.kind === 'rate_limited') {
          end('rate_limited', `Muitas conversas iniciadas hoje. Tente de novo mais tarde ou fale com a nossa equipe.`)
        } else if (info.kind === 'unavailable') {
          end('unavailable', info.text)
        } else {
          state.startError = { text: info.text, retryable: info.retryable }
        }
        return false
      } finally {
        state.starting = false
      }
    },

    /** Reidrata a sessão guardada na aba (GET /session). Chamada ao abrir o painel. */
    async restore() {
      if (state.phase !== 'gate' || state.restoring) return false
      const saved = readSaved(storage, contextSlug)
      if (!saved) return false
      if (now() >= saved.expiresAt - EXPIRY_MARGIN_MS) {
        clearSaved(storage, contextSlug)
        return false
      }
      state.restoring = true
      try {
        const res = await api.getSession(saved.token)
        if (disposed) return false
        token = saved.token
        state.audience = res.audience === 'business' ? 'business' : 'customer'
        const exp = Date.parse(res.expires_at)
        state.expiresAt = Number.isFinite(exp) ? exp : saved.expiresAt
        state.company = res.company && typeof res.company === 'object' ? { name: String(res.company.name || ''), slug: String(res.company.slug || '') } : null
        applyLimits(res)
        const list = (Array.isArray(res.messages) ? res.messages : []).filter((m) => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
        state.messages = []
        list.forEach((m, i) => {
          const last = i === list.length - 1
          push({
            id: `s${m.id}`,
            role: m.role,
            text: m.content,
            suggestions: last && m.role === 'assistant' ? normalizeSuggestions(m.suggestions) : [],
            actions: m.role === 'assistant' ? normalizeActions(m.actions) : [],
          })
        })
        if (res.status === 'closed') {
          end('closed', 'Esta conversa foi encerrada.')
        } else if (res.status === 'blocked') {
          end('blocked', '')
        } else {
          state.phase = 'chat'
          if (!state.messages.length) greet()
        }
        return true
      } catch (e) {
        const info = chatErrorInfo(e)
        if (info.kind === 'session_lost' || info.kind === 'closed') {
          clearSaved(storage, contextSlug)
          token = null
          state.phase = 'gate'
        } else if (info.kind === 'disabled') {
          markChatDisabled(storage)
          state.phase = 'disabled'
        } else {
          end('restore_failed', info.text)
        }
        return false
      } finally {
        state.restoring = false
      }
    },

    /** Tenta restaurar de novo após falha de rede. */
    retryRestore() {
      if (state.phase === 'ended' && state.endReason === 'restore_failed') {
        state.phase = 'gate'
        state.endReason = null
        return api_.restore()
      }
      return Promise.resolve(false)
    },

    /** Envia a mensagem do rascunho (ou `text`). Devolve true se a mensagem foi aceita para envio. */
    send(text) {
      const raw = text === undefined ? state.draft : text
      const msg = String(raw ?? '').trim()
      state.inputError = ''
      if (state.phase !== 'chat' || state.busy || !msg) return false
      if (state.messages.some((m) => m.status === 'failed')) return false
      if (state.retryUntil && now() < state.retryUntil) return false
      const max = state.limits.max_chars || DEFAULT_MAX_CHARS
      if (msg.length > max) {
        state.inputError = `A mensagem passa de ${max} caracteres. Resuma um pouco.`
        return false
      }
      if (state.remaining && state.remaining.messages <= 0) {
        end('message_limit', '')
        return false
      }
      if (state.expiresAt && now() >= state.expiresAt - EXPIRY_MARGIN_MS) {
        end('expired', '')
        return false
      }
      // debounce de cliente: ignora toques repetidos em sequência curta
      if (now() - lastSendAt < minIntervalMs) return false
      lastSendAt = now()
      const m = push({ role: 'user', text: msg, status: 'sending', clientMsgId: newId() })
      if (text === undefined || state.draft.trim() === msg) state.draft = ''
      state.leadError = ''
      deliver(m)
      return true
    },

    /** Reenvia uma mensagem que falhou, com o MESMO client_msg_id (idempotente). */
    retry(id) {
      const m = state.messages.find((x) => x.id === id)
      if (!m || m.status !== 'failed' || state.busy || state.phase !== 'chat') return false
      if (state.retryUntil && now() < state.retryUntil) return false
      m.status = 'sending'
      m.error = ''
      lastSendAt = now()
      deliver(m)
      return true
    },

    /** Descarta a mensagem que falhou e devolve o texto ao campo de digitação. */
    discard(id) {
      const m = state.messages.find((x) => x.id === id)
      if (!m || m.status !== 'failed') return
      dropMessage(m)
      if (!state.draft) state.draft = m.text
    },

    openLead() {
      if (leadAllowed() && state.audience === 'business' && !state.leadSent) {
        state.leadOpen = true
        state.leadError = ''
      }
    },
    closeLead() {
      state.leadOpen = false
      state.leadError = ''
    },

    /** POST /public/chat/lead. `form`: {name, whatsapp, email?, segment?, message?, consent}. */
    async submitLead(form) {
      if (!leadAllowed() || !token || state.leadBusy || state.leadSent) return { ok: false }
      if (form?.consent !== true) {
        state.leadError = 'Para enviar é preciso concordar com o uso dos dados.'
        return { ok: false }
      }
      const clean = (v) => String(v ?? '').trim()
      const payload = {
        name: clean(form.name),
        whatsapp: clean(form.whatsapp),
        ...(clean(form.email) ? { email: clean(form.email) } : {}),
        ...(clean(form.segment) ? { segment: clean(form.segment) } : {}),
        ...(clean(form.message) ? { message: clean(form.message).slice(0, 500) } : {}),
        consent: true,
      }
      state.leadBusy = true
      state.leadError = ''
      try {
        const res = await api.sendLead(token, payload)
        state.leadSent = true
        state.leadOpen = false
        push({ role: 'assistant', text: typeof res?.reply === 'string' && res.reply ? res.reply : 'Recebemos seu contato! Nossa equipe vai falar com você em breve.', source: 'local' })
        return { ok: true }
      } catch (e) {
        const info = chatErrorInfo(e)
        if (info.kind === 'lead_exists') {
          state.leadSent = true
          state.leadOpen = false
          push({ role: 'assistant', text: info.text, source: 'local' })
          return { ok: true }
        }
        if (info.kind === 'session_lost') end('expired', '')
        else if (info.kind === 'closed') end('closed', info.text)
        else if (info.kind === 'disabled') {
          markChatDisabled(storage)
          state.phase = 'disabled'
        } else state.leadError = info.kind === 'validation' ? 'Confira os dados informados e tente de novo.' : info.text
        return { ok: false }
      } finally {
        state.leadBusy = false
      }
    },

    /** Encerra a conversa (POST /session/close). A avaliação continua possível depois. */
    async close() {
      if (state.phase !== 'chat' || state.closing) return false
      state.closing = true
      try {
        await api.closeSession(token)
        end('closed_by_user', '')
        return true
      } catch (e) {
        const info = chatErrorInfo(e)
        if (info.kind === 'session_lost') end('expired', '')
        else if (info.kind === 'closed') end('closed_by_user', '')
        else state.notice = { kind: 'error', text: 'Não foi possível encerrar agora. Tente de novo.' }
        return false
      } finally {
        state.closing = false
      }
    },

    /** POST /public/chat/rating (uma vez por sessão). */
    async rate({ rating, comment }) {
      if (state.ratingBusy || state.rated || !token) return false
      const r = Number(rating)
      if (!Number.isInteger(r) || r < 1 || r > 5) {
        state.ratingError = 'Escolha de 1 a 5 estrelas.'
        return false
      }
      state.ratingBusy = true
      state.ratingError = ''
      try {
        await api.rate(token, { rating: r, comment: String(comment || '').trim().slice(0, 500) })
        state.rated = true
        return true
      } catch (e) {
        const info = chatErrorInfo(e)
        if (info.kind === 'already_rated') state.rated = true
        else state.ratingError = info.kind === 'session_lost' ? 'A conversa expirou e não foi possível registrar a avaliação.' : info.text
        return info.kind === 'already_rated'
      } finally {
        state.ratingBusy = false
      }
    },

    /** Nova conversa: mantém a audiência já escolhida (o Turnstile é refeito) e o rascunho. */
    newConversation() {
      if (state.phase !== 'ended') return
      if (state.endReason === 'blocked') return
      const audience = state.audience
      clearSaved(storage, contextSlug)
      resetConversation()
      state.phase = audience ? 'verifying' : 'gate'
    },

    /** Troca de contexto (site <-> /b/:slug): outra empresa exige outra sessão. */
    setContext(newSlug) {
      const s = newSlug || null
      if (s === contextSlug) return
      contextSlug = s
      aborter?.abort?.()
      resetConversation()
      state.phase = 'gate'
      state.audience = null
      state.draft = ''
    },

    /** Chamada ~1x/s pelo componente: contagem regressiva e expiração. */
    tick() {
      if (state.retryUntil) {
        const left = Math.ceil((state.retryUntil - now()) / 1000)
        if (left <= 0) {
          state.retryUntil = 0
          state.retryIn = 0
          if (state.notice && ['cooldown', 'rate_limited', 'too_fast'].includes(state.notice.kind)) state.notice = null
        } else state.retryIn = left
      }
      if (state.phase === 'chat' && state.expiresAt && now() >= state.expiresAt) end('expired', '')
    },

    dispose() {
      disposed = true
      aborter?.abort?.()
    },
  }

  async function deliver(msg) {
    state.busy = true
    state.typing = true
    state.notice = null
    let assistant = null
    aborter = typeof AbortController !== 'undefined' ? new AbortController() : null
    const onDelta = (t) => {
      if (disposed) return
      if (!assistant) assistant = push({ role: 'assistant', text: '', status: 'streaming' })
      assistant.text += t
    }
    const clearPartial = () => {
      if (assistant) {
        dropMessage(assistant)
        assistant = null
      }
    }
    try {
      let attempt = 0
      let payload
      for (;;) {
        try {
          payload = await api.sendMessage(token, { message: msg.text, clientMsgId: msg.clientMsgId, stream: true, onDelta, signal: aborter?.signal })
          break
        } catch (e) {
          const info = chatErrorInfo(e)
          if (info.kind === 'in_progress' && attempt < maxInProgressRetries && !disposed) {
            attempt++
            clearPartial()
            await sleep((info.wait || 2) * 1000)
            continue
          }
          throw e
        }
      }
      if (disposed) return
      msg.status = 'sent'
      const fields = {
        role: 'assistant',
        text: String(payload.reply ?? ''),
        status: 'sent',
        suggestions: normalizeSuggestions(payload.suggestions),
        actions: normalizeActions(payload.actions),
        hint: normalizeHint(payload.proactive_hint),
        source: typeof payload.source === 'string' ? payload.source : 'ai',
        degraded: payload.degraded === true,
        replayed: payload.replayed === true,
      }
      if (assistant) Object.assign(assistant, fields)
      else push(fields)
      applyRemaining(payload.remaining)
      persist()
      if (Number.isFinite(payload.cooldown_seconds) && payload.cooldown_seconds > 0) {
        startRetry(payload.cooldown_seconds)
        state.notice = { kind: 'cooldown', text: 'Vamos fazer uma pausa antes da próxima mensagem.' }
      }
      if (state.remaining && state.remaining.messages <= 0) {
        state.notice = { kind: 'limit', text: 'Você usou todas as mensagens desta conversa.' }
      } else if (state.remaining && state.remaining.tokens <= 0) {
        state.notice = { kind: 'tokens', text: 'O limite de respostas inteligentes desta conversa foi atingido; ainda posso responder dúvidas simples.' }
      }
    } catch (e) {
      if (disposed) return
      clearPartial()
      const info = chatErrorInfo(e)
      switch (info.kind) {
        case 'disabled':
          markChatDisabled(storage)
          clearSaved(storage, contextSlug)
          state.phase = 'disabled'
          break
        case 'session_lost':
          // nunca recria a sessão sozinho: devolve o texto ao campo e oferece nova conversa
          dropMessage(msg)
          if (!state.draft) state.draft = msg.text
          end('expired', '')
          break
        case 'blocked':
          msg.status = 'sent'
          end('blocked', info.text)
          break
        case 'closed':
          dropMessage(msg)
          end('closed', info.text)
          break
        case 'message_limit':
          msg.status = 'failed'
          msg.error = info.text
          end('message_limit', info.text)
          break
        case 'cooldown':
        case 'rate_limited':
        case 'too_fast':
          msg.status = 'failed'
          msg.error = info.text
          startRetry(info.wait)
          state.notice = { kind: info.kind, text: info.text }
          break
        default:
          msg.status = 'failed'
          msg.error = info.text
          if (info.kind === 'too_long') state.inputError = info.text
      }
    } finally {
      state.busy = false
      state.typing = false
      aborter = null
    }
  }

  return api_
}
