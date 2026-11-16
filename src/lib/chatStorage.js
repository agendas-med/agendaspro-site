// Armazenamento do chat. REGRA: o session_token fica só em memória/sessionStorage (nunca localStorage) e
// as mensagens nunca são gravadas no navegador (a conversa é reidratada por GET /public/chat/session).
const PREFIX = 'ap_chat_v1'
const DISABLED_KEY = `${PREFIX}:off`

/** sessionStorage quando acessível; senão um Map em memória (modo privado/SSR/testes). */
export function safeSessionStorage() {
  try {
    const s = globalThis.sessionStorage
    if (s) {
      s.setItem(`${PREFIX}:probe`, '1')
      s.removeItem(`${PREFIX}:probe`)
      return s
    }
  } catch {
    /* indisponível */
  }
  return memoryStorage()
}

export function memoryStorage() {
  const m = new Map()
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => void m.set(k, String(v)),
    removeItem: (k) => void m.delete(k),
  }
}

/** Uma sessão por contexto: site (null) ou página de agendamento (slug). */
export const sessionKey = (slug) => `${PREFIX}:${slug ? `b:${slug}` : 'site'}`

/** O core respondeu 503 chat_disabled nesta aba: o widget fica escondido até fechar a aba. */
export function isChatMarkedDisabled(storage = safeSessionStorage()) {
  try {
    return storage.getItem(DISABLED_KEY) === '1'
  } catch {
    return false
  }
}
export function markChatDisabled(storage = safeSessionStorage()) {
  try {
    storage.setItem(DISABLED_KEY, '1')
  } catch {
    /* ignora */
  }
}

export function readSaved(storage, slug) {
  try {
    const v = JSON.parse(storage.getItem(sessionKey(slug)) || 'null')
    if (v && typeof v.token === 'string' && Number.isFinite(v.expiresAt) && (v.audience === 'customer' || v.audience === 'business')) return v
  } catch {
    /* corrompido */
  }
  return null
}
export function writeSaved(storage, slug, { token, expiresAt, audience }) {
  try {
    storage.setItem(sessionKey(slug), JSON.stringify({ token, expiresAt, audience }))
  } catch {
    /* ignora */
  }
}
export function clearSaved(storage, slug) {
  try {
    storage.removeItem(sessionKey(slug))
  } catch {
    /* ignora */
  }
}
