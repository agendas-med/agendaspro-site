import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { ApiError } from '../services/apiError.js'
import { MIN_POLL_MS, STEADY_POLL_MS, createStatusPoller, interpretPixStatus, nextDelay } from './pixPolling.js'

const view = (status, extra = {}, payment) => ({ booking: { status, ...extra }, ...(payment ? { payment } : {}) })

describe('interpretPixStatus', () => {
  it('confirmed/completed -> confirmed', () => {
    expect(interpretPixStatus(view('confirmed')).kind).toBe('confirmed')
    expect(interpretPixStatus(view('completed')).kind).toBe('confirmed')
  })
  it('pending_payment -> pending (com o payment, se vier)', () => {
    const p = { pix_copy_paste: 'x' }
    const r = interpretPixStatus(view('pending_payment', {}, p))
    expect(r.kind).toBe('pending')
    expect(r.payment).toBe(p)
    expect(interpretPixStatus(view('pending_payment')).payment).toBeNull()
  })
  it.each(['payment_expired', 'paid_after_expiry', 'payment_failed'])('cancelled/%s -> expired', (reason) => {
    const r = interpretPixStatus(view('cancelled', { cancellation_reason: reason }))
    expect(r).toMatchObject({ kind: 'expired', reason })
  })
  it('cancelled por cliente/empresa -> cancelled', () => {
    expect(interpretPixStatus(view('cancelled', { cancellation_reason: 'customer' })).kind).toBe('cancelled')
    expect(interpretPixStatus(view('cancelled')).kind).toBe('cancelled')
  })
  it('resposta sem booking -> unknown', () => {
    expect(interpretPixStatus({}).kind).toBe('unknown')
    expect(interpretPixStatus(null).kind).toBe('unknown')
  })
})

describe('nextDelay', () => {
  it('aquece 5s, 5s, 10s e estaciona em 15s; nunca abaixo de 5s', () => {
    expect([0, 1, 2, 3, 9].map((attempt) => nextDelay({ attempt }))).toEqual([5000, 5000, 10000, STEADY_POLL_MS, STEADY_POLL_MS])
    expect(nextDelay({ attempt: 5, steadyMs: 1000 })).toBe(MIN_POLL_MS)
  })
  it('429 respeita Retry-After (em s) ou usa 30s, com piso de 5s', () => {
    expect(nextDelay({ error: new ApiError(429, 'rate_limited', '', { retryAfter: 45 }) })).toBe(45000)
    expect(nextDelay({ error: new ApiError(429, 'rate_limited', '', { retryAfter: 1 }) })).toBe(MIN_POLL_MS)
    expect(nextDelay({ error: new ApiError(429, 'rate_limited') })).toBe(30000)
  })
  it('falhas de rede/5xx recuam (backoff) e têm teto', () => {
    const net = new ApiError(0, 'network_error')
    expect(nextDelay({ error: net })).toBeGreaterThan(STEADY_POLL_MS - 1)
    expect(nextDelay({ error: new ApiError(500, 'internal_error'), attempt: 10 })).toBe(60000)
  })
})

describe('createStatusPoller', () => {
  let hidden
  let visCb
  let calls
  const make = (over = {}) => {
    calls = { result: [], error: [] }
    return createStatusPoller({
      fetchStatus: over.fetchStatus || vi.fn().mockResolvedValue(view('pending_payment')),
      onResult: (v) => {
        calls.result.push(v)
        return over.stopWhen ? over.stopWhen(v) : false
      },
      onError: (e, info) => calls.error.push({ e, info }),
      isHidden: () => hidden,
      onVisibilityChange: (cb) => {
        visCb = cb
        return () => (visCb = null)
      },
    })
  }

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2030-01-01T12:00:00Z'))
    hidden = false
    visCb = null
  })
  afterEach(() => vi.useRealTimers())

  it('primeira consulta só após 5s (nunca abaixo do piso) e depois no ritmo de aquecimento', async () => {
    const p = make()
    p.start()
    await vi.advanceTimersByTimeAsync(4999)
    expect(calls.result).toHaveLength(0)
    await vi.advanceTimersByTimeAsync(1)
    expect(calls.result).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(5000)
    expect(calls.result).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(10000)
    expect(calls.result).toHaveLength(3)
    await vi.advanceTimersByTimeAsync(15000)
    expect(calls.result).toHaveLength(4)
    p.stop()
  })

  it('immediate consulta já ao iniciar', async () => {
    const p = make()
    p.start({ immediate: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(calls.result).toHaveLength(1)
    p.stop()
  })

  it('para ao confirmar (onResult retorna true) e não consulta mais', async () => {
    const fetchStatus = vi.fn().mockResolvedValueOnce(view('pending_payment')).mockResolvedValueOnce(view('confirmed'))
    const p = make({ fetchStatus, stopWhen: (v) => v.booking.status === 'confirmed' })
    p.start()
    await vi.advanceTimersByTimeAsync(5000 + 5000)
    expect(fetchStatus).toHaveBeenCalledTimes(2)
    expect(p.running).toBe(false)
    await vi.advanceTimersByTimeAsync(120000)
    expect(fetchStatus).toHaveBeenCalledTimes(2)
  })

  it('pausa com a aba oculta e confere uma vez ao voltar', async () => {
    const p = make()
    p.start()
    await vi.advanceTimersByTimeAsync(5000)
    expect(calls.result).toHaveLength(1)
    hidden = true
    visCb()
    await vi.advanceTimersByTimeAsync(60000)
    expect(calls.result).toHaveLength(1) // nada enquanto oculta
    hidden = false
    visCb()
    await vi.advanceTimersByTimeAsync(0)
    expect(calls.result).toHaveLength(2) // uma conferência imediata ao voltar (já passou o piso de 5s)
    p.stop()
  })

  it('ao voltar antes do piso de 5s não consulta na hora (agenda)', async () => {
    const p = make()
    p.start({ immediate: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(calls.result).toHaveLength(1)
    hidden = true
    visCb()
    await vi.advanceTimersByTimeAsync(1000)
    hidden = false
    visCb()
    await vi.advanceTimersByTimeAsync(0)
    expect(calls.result).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(5000)
    expect(calls.result).toHaveLength(2)
    p.stop()
  })

  it('429 recua (30s sem Retry-After) e volta ao ritmo depois de um sucesso', async () => {
    const fetchStatus = vi
      .fn()
      .mockRejectedValueOnce(new ApiError(429, 'rate_limited'))
      .mockResolvedValue(view('pending_payment'))
    const p = make({ fetchStatus })
    p.start({ immediate: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(calls.error).toHaveLength(1)
    await vi.advanceTimersByTimeAsync(29999)
    expect(fetchStatus).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(1)
    expect(fetchStatus).toHaveBeenCalledTimes(2)
    p.stop()
  })

  it('404 e 410 encerram o polling (token inválido/expirado)', async () => {
    for (const [s, c] of [
      [404, 'not_found'],
      [410, 'token_expired'],
    ]) {
      const fetchStatus = vi.fn().mockRejectedValue(new ApiError(s, c))
      const p = make({ fetchStatus })
      p.start({ immediate: true })
      await vi.advanceTimersByTimeAsync(0)
      expect(calls.error[0].info.terminal).toBe(true)
      expect(p.running).toBe(false)
      await vi.advanceTimersByTimeAsync(120000)
      expect(fetchStatus).toHaveBeenCalledTimes(1)
    }
  })

  it('erros de rede não encerram: tentam de novo com backoff', async () => {
    const fetchStatus = vi.fn().mockRejectedValue(new ApiError(0, 'network_error'))
    const p = make({ fetchStatus })
    p.start({ immediate: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(p.running).toBe(true)
    await vi.advanceTimersByTimeAsync(30000)
    expect(fetchStatus.mock.calls.length).toBeGreaterThanOrEqual(2)
    p.stop()
  })

  it('checkNow consulta fora do ritmo e não sobrepõe requisições', async () => {
    let release
    const fetchStatus = vi.fn(() => new Promise((r) => (release = () => r(view('pending_payment')))))
    const p = make({ fetchStatus })
    p.start()
    const a = p.checkNow()
    const b = p.checkNow() // em andamento: ignorada
    await vi.advanceTimersByTimeAsync(0)
    expect(fetchStatus).toHaveBeenCalledTimes(1)
    release()
    await a
    await b
    p.stop()
  })

  it('nunca consulta em intervalo menor que 5s ao longo de 10 minutos', async () => {
    const stamps = []
    const fetchStatus = vi.fn(async () => {
      stamps.push(Date.now())
      return view('pending_payment')
    })
    const p = make({ fetchStatus })
    p.start({ immediate: true })
    await vi.advanceTimersByTimeAsync(10 * 60 * 1000)
    p.stop()
    for (let i = 1; i < stamps.length; i++) expect(stamps[i] - stamps[i - 1]).toBeGreaterThanOrEqual(MIN_POLL_MS)
    // orçamento: bem abaixo de 60 req / 10 min por IP
    expect(stamps.length).toBeLessThan(50)
  })
})
