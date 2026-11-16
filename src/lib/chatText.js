// Renderização SEGURA do texto do chat: nada de v-html. O texto da IA/FAQ vira uma árvore de nós
// (parágrafos, listas, negrito, links) que o componente percorre com v-for e interpolação ({{ }}).
// Links só passam por safeHref: esquema https/mailto + host na allowlist (ou caminho interno).

const MAX_TEXT = 4000
const MAX_URL = 2048
// caracteres de controle (menos \n e \t) e de direção bidi, que permitem "esconder" texto
// eslint-disable-next-line no-control-regex
const CONTROL_RE = /[\u0000-\u0008\u000B-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g

/** Remove controles/bidi e limita o tamanho. */
export function cleanText(text) {
  return String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(CONTROL_RE, '')
    .slice(0, MAX_TEXT)
}

const hostMatches = (host, allowed) => allowed.some((a) => host === a || host.endsWith(`.${a}`))

/**
 * Valida uma URL vinda do servidor/IA. Devolve a URL normalizada ou null.
 * - mailto: endereço simples, sem parâmetros.
 * - caminho interno ("/precos"): só com allowRelative (nunca "//host" nem "\\").
 * - https: sem credenciais; host na allowlist (igual ou subdomínio). allowedHosts=null desliga a checagem de host.
 * - http só para localhost e só quando allowLocalHttp (dev).
 * @param {string} url
 * @param {{allowedHosts?:string[]|null, allowRelative?:boolean, allowLocalHttp?:boolean}} [opts]
 * @returns {string|null}
 */
export function safeHref(url, { allowedHosts = [], allowRelative = true, allowLocalHttp = false } = {}) {
  const raw = String(url ?? '').trim()
  // eslint-disable-next-line no-control-regex -- rejeita de propósito caracteres de controle
  if (!raw || raw.length > MAX_URL || /[\s\u0000-\u001F\u007F\\]/.test(raw)) return null
  if (/^mailto:/i.test(raw)) {
    return /^mailto:[^\s@?&#]+@[^\s@?&#]+\.[^\s@?&#]+$/i.test(raw) ? raw : null
  }
  if (raw.startsWith('/')) {
    if (!allowRelative || raw.startsWith('//')) return null
    return raw
  }
  let u
  try {
    u = new URL(raw)
  } catch {
    return null
  }
  if (u.username || u.password) return null
  const host = u.hostname.toLowerCase()
  const isLocal = host === 'localhost' || host === '127.0.0.1' || host === '[::1]'
  if (u.protocol === 'http:') {
    if (!(allowLocalHttp && isLocal)) return null
  } else if (u.protocol !== 'https:') {
    return null
  }
  if (allowedHosts !== null && !(allowLocalHttp && isLocal) && !hostMatches(host, allowedHosts)) return null
  return u.href
}

/** Link externo (fora do site)? Define target=_blank + rel. */
export function isExternalHref(href, ownHosts = []) {
  if (!href || href.startsWith('/')) return false
  if (/^mailto:/i.test(href)) return false
  try {
    const h = new URL(href).hostname.toLowerCase()
    return !hostMatches(h, ownHosts)
  } catch {
    return true
  }
}

const INLINE_RE = /\*\*([^*\n]{1,200})\*\*|\[([^\]\n]{1,200})\]\(([^)\s]{1,2048})\)|(https:\/\/[^\s<>"')\]]+)|(mailto:[^\s<>"')\]]+)/g
const TRAILING_PUNCT = /[.,;:!?]+$/

/** @returns {Array<{t:'text'|'strong'|'link'|'br', v?:string, href?:string}>} */
function parseInline(line, opts) {
  const out = []
  let last = 0
  const pushText = (s) => {
    if (s) out.push({ t: 'text', v: s })
  }
  for (const m of line.matchAll(INLINE_RE)) {
    pushText(line.slice(last, m.index))
    last = m.index + m[0].length
    if (m[1] !== undefined) {
      out.push({ t: 'strong', v: m[1] })
    } else if (m[2] !== undefined) {
      const href = safeHref(m[3], opts)
      // link inválido: mostra só o rótulo (nunca o destino como link)
      if (href) out.push({ t: 'link', v: m[2], href })
      else pushText(m[2])
    } else {
      let url = m[4] || m[5]
      let tail = ''
      const p = url.match(TRAILING_PUNCT)
      if (p) {
        tail = p[0]
        url = url.slice(0, -tail.length)
      }
      const href = safeHref(url, opts)
      if (href) out.push({ t: 'link', v: url, href })
      else pushText(url)
      pushText(tail)
    }
  }
  pushText(line.slice(last))
  return out
}

const LIST_RE = /^\s*(?:[-*•]|\d{1,2}[.)])\s+(.*)$/

/**
 * Texto -> blocos. Suporta: parágrafos (linha em branco), quebras de linha, listas ("- ", "• ", "1."),
 * **negrito**, [rótulo](url) e URLs https/mailto soltas. Nada além disso.
 * @returns {Array<{type:'p', inline:object[]}|{type:'ul', items:object[][]}>}
 */
export function parseChatText(text, opts = {}) {
  const lines = cleanText(text).split('\n')
  const blocks = []
  let para = []
  let list = null
  const flushPara = () => {
    if (!para.length) return
    const inline = []
    para.forEach((l, i) => {
      if (i > 0) inline.push({ t: 'br' })
      inline.push(...parseInline(l, opts))
    })
    blocks.push({ type: 'p', inline })
    para = []
  }
  const flushList = () => {
    if (list) blocks.push({ type: 'ul', items: list })
    list = null
  }
  for (const line of lines) {
    if (!line.trim()) {
      flushPara()
      flushList()
      continue
    }
    const li = line.match(LIST_RE)
    if (li) {
      flushPara()
      ;(list ||= []).push(parseInline(li[1], opts))
    } else {
      flushList()
      para.push(line.trim())
    }
  }
  flushPara()
  flushList()
  return blocks
}

/** Texto puro (sem marcação) para leitores de tela/estimativas. */
export function plainText(text, opts = {}) {
  return parseChatText(text, opts)
    .map((b) =>
      b.type === 'p'
        ? b.inline.map((n) => (n.t === 'br' ? ' ' : n.v)).join('')
        : b.items.map((it) => it.map((n) => n.v ?? '').join('')).join('; '),
    )
    .join(' ')
}
