// idempotency_key de reserva: /^[A-Za-z0-9_-]{8,64}$/ (contrato do core).
const KEY_RE = /^[A-Za-z0-9_-]{8,64}$/

export const isValidIdempotencyKey = (k) => KEY_RE.test(String(k || ''))

/** Chave nova (UUID v4 quando disponível; fallback só com caracteres permitidos). */
export function newIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID()
  const rnd = () => Math.random().toString(36).slice(2, 12)
  return `k${Date.now().toString(36)}-${rnd()}-${rnd()}`
}

function stable(v) {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (v && typeof v === 'object') {
    return `{${Object.keys(v)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stable(v[k])}`)
      .join(',')}}`
  }
  return JSON.stringify(v ?? null)
}

/** Impressão digital do que o servidor compara na idempotência (tudo menos a chave e o token Turnstile). */
export function payloadFingerprint(payload) {
  // eslint-disable-next-line no-unused-vars
  const { idempotency_key, turnstile_token, ...rest } = payload || {}
  return stable(rest)
}

/**
 * Uma chave por TENTATIVA de reserva: o mesmo conteúdo reutiliza a chave (retry após falha de rede/5xx não
 * duplica); conteúdo diferente (outro horário, nome editado...) ganha chave nova (evita idempotency_conflict).
 * Chame reset() após sucesso e após falhas definitivas (slot_taken, payment_unavailable, validação...).
 */
export function createIdempotencyTracker(generate = newIdempotencyKey) {
  let key = null
  let fp = null
  return {
    keyFor(payload) {
      const f = payloadFingerprint(payload)
      if (!key || f !== fp) {
        key = generate()
        fp = f
      }
      return key
    },
    reset() {
      key = null
      fp = null
    },
    get current() {
      return key
    },
  }
}
