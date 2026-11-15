import { describe, it, expect } from 'vitest'
import { ApiError, ERROR_CODES, codeFromStatus, friendlyError, isAmbiguousFailure } from './apiError.js'

const e = (status, code, message = 'm', extra) => new ApiError(status, code, message, extra)

describe('friendlyError (por código do contrato)', () => {
  it.each([
    ['token_expired', 410, /expirou/i],
    ['slot_taken', 409, /outro horário/i],
    ['idempotency_conflict', 409, /dados diferentes/i],
    ['payment_unavailable', 503, /Pix.*não foi reservado/i],
    ['service_unavailable', 503, /temporariamente indisponível/i],
    ['not_allowed', 409, /não pode mais ser alterado/i],
    ['cancel_window_closed', 409, /prazo.*cancelar ou remarcar/i],
    ['already_cancelled', 409, /já foi cancelado/i],
    ['payload_too_large', 413, /grandes demais/i],
    ['turnstile_failed', 400, /verificação de segurança/i],
    ['consent_required', 400, /concordar/i],
  ])('%s', (code, status, re) => {
    expect(friendlyError(e(status, code))).toMatch(re)
  })

  it('todo código do contrato tem mensagem própria (nunca a genérica)', () => {
    for (const code of ERROR_CODES) {
      const msg = friendlyError(e(code === 'rate_limited' ? 429 : 400, code, ''))
      expect(msg, code).not.toBe('Algo deu errado. Tente novamente.')
      expect(msg.length, code).toBeGreaterThan(10)
    }
  })

  it('429 usa o Retry-After quando conhecido e cai num texto neutro quando não', () => {
    expect(friendlyError(e(429, 'rate_limited', '', { retryAfter: 42 }))).toMatch(/42s/)
    expect(friendlyError(e(429, 'rate_limited', '', { retryAfter: 180 }))).toMatch(/3 min/)
    expect(friendlyError(e(429, 'rate_limited'))).toMatch(/aguarde um instante/i)
  })

  it('500 mostra o correlation_id para suporte', () => {
    expect(friendlyError(e(500, 'internal_error', '', { correlationId: 'abc-123' }))).toMatch(/abc-123/)
    expect(friendlyError(e(502, 'http_error'))).toMatch(/instabilidade/i)
  })

  it('rede e timeout', () => {
    expect(friendlyError(e(0, 'network_error'))).toMatch(/conexão/i)
    expect(friendlyError(e(0, 'timeout'))).toMatch(/demorou/i)
  })

  it('erro que não é ApiError tem texto genérico', () => {
    expect(friendlyError(new Error('x'))).toMatch(/Algo deu errado/)
  })

  it('validation_error mostra a mensagem do servidor', () => {
    expect(friendlyError(e(400, 'validation_error', 'Telefone inválido.'))).toBe('Telefone inválido.')
  })
})

describe('codeFromStatus (sem corpo de erro)', () => {
  it('infere o código pelo status', () => {
    expect(codeFromStatus(429)).toBe('rate_limited')
    expect(codeFromStatus(410)).toBe('token_expired')
    expect(codeFromStatus(413)).toBe('payload_too_large')
    expect(codeFromStatus(404)).toBe('not_found')
    expect(codeFromStatus(502)).toBe('http_error')
  })
})

describe('isAmbiguousFailure (decide reaproveitar a idempotency_key)', () => {
  it('rede, timeout, 5xx e 429 são ambíguos (mantém a chave)', () => {
    expect(isAmbiguousFailure(e(0, 'network_error'))).toBe(true)
    expect(isAmbiguousFailure(e(0, 'timeout'))).toBe(true)
    expect(isAmbiguousFailure(e(500, 'internal_error'))).toBe(true)
    expect(isAmbiguousFailure(e(502, 'http_error'))).toBe(true)
    expect(isAmbiguousFailure(e(429, 'rate_limited'))).toBe(true)
    expect(isAmbiguousFailure(new Error('x'))).toBe(true)
  })
  it('falhas definitivas giram a chave', () => {
    for (const [s, c] of [
      [409, 'slot_taken'],
      [409, 'idempotency_conflict'],
      [400, 'validation_error'],
      [400, 'turnstile_failed'],
      [413, 'payload_too_large'],
      [503, 'payment_unavailable'],
      [503, 'service_unavailable'],
    ]) {
      expect(isAmbiguousFailure(e(s, c)), c).toBe(false)
    }
  })
})
