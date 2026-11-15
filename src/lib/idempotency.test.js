import { describe, it, expect } from 'vitest'
import { createIdempotencyTracker, isValidIdempotencyKey, newIdempotencyKey, payloadFingerprint } from './idempotency.js'

describe('newIdempotencyKey', () => {
  it('gera chaves distintas e válidas para o core', () => {
    const a = newIdempotencyKey()
    expect(a).not.toBe(newIdempotencyKey())
    expect(isValidIdempotencyKey(a)).toBe(true)
  })
  it('rejeita chaves fora de /^[A-Za-z0-9_-]{8,64}$/', () => {
    expect(isValidIdempotencyKey('curta')).toBe(false)
    expect(isValidIdempotencyKey('com espaço aqui')).toBe(false)
    expect(isValidIdempotencyKey('x'.repeat(65))).toBe(false)
  })
})

describe('payloadFingerprint', () => {
  it('ignora a ordem das chaves, a idempotency_key e o token do Turnstile', () => {
    const a = { service_ids: [1], customer: { name: 'A', phone: '1' }, idempotency_key: 'k1', turnstile_token: 't1' }
    const b = { turnstile_token: 't2', customer: { phone: '1', name: 'A' }, idempotency_key: 'k2', service_ids: [1] }
    expect(payloadFingerprint(a)).toBe(payloadFingerprint(b))
  })
  it('muda quando o conteúdo muda', () => {
    expect(payloadFingerprint({ start: 'a' })).not.toBe(payloadFingerprint({ start: 'b' }))
    expect(payloadFingerprint({ service_ids: [1, 2] })).not.toBe(payloadFingerprint({ service_ids: [2, 1] }))
  })
})

describe('createIdempotencyTracker', () => {
  const seq = () => {
    let n = 0
    return () => `key-${++n}-xxxxxxxx`
  }
  const p = (over = {}) => ({ start: '2030-01-01T10:00', customer: { name: 'Ana' }, ...over })

  it('retry do mesmo payload reutiliza a chave', () => {
    const t = createIdempotencyTracker(seq())
    const k = t.keyFor(p())
    expect(t.keyFor(p({ turnstile_token: 'novo' }))).toBe(k)
    expect(t.keyFor(p())).toBe(k)
  })
  it('payload alterado ganha chave nova (evita idempotency_conflict)', () => {
    const t = createIdempotencyTracker(seq())
    const k1 = t.keyFor(p())
    const k2 = t.keyFor(p({ start: '2030-01-01T11:00' }))
    expect(k2).not.toBe(k1)
    // voltar ao payload anterior não ressuscita a chave antiga: a chave vigente é a do último payload
    expect(t.keyFor(p({ start: '2030-01-01T11:00' }))).toBe(k2)
  })
  it('reset (após sucesso/falha definitiva) gera chave nova para o mesmo payload', () => {
    const t = createIdempotencyTracker(seq())
    const k1 = t.keyFor(p())
    t.reset()
    expect(t.keyFor(p())).not.toBe(k1)
  })
})
