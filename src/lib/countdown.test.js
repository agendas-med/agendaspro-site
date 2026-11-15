import { describe, it, expect, vi } from 'vitest'
import { createCountdown } from './countdown.js'

// Relógio e timers injetados: sem esperar tempo real.
function harness(expiresAt, startMs) {
  let t = startMs
  const timers = []
  const ticks = []
  const onZero = vi.fn()
  const cd = createCountdown(expiresAt, {
    now: () => t,
    onTick: (r) => ticks.push(r),
    onZero,
    setTimer: (fn) => {
      timers.push(fn)
      return timers.length
    },
    clearTimer: vi.fn(),
  })
  const advance = (s) => {
    t += s * 1000
    timers[timers.length - 1]?.()
  }
  return { cd, ticks, onZero, advance, timers }
}

const T0 = Date.parse('2030-01-01T12:00:00Z')

describe('createCountdown', () => {
  it('emite o restante imediatamente e a cada segundo', () => {
    const h = harness('2030-01-01T12:01:30Z', T0)
    h.cd.start()
    expect(h.ticks).toEqual([90])
    h.advance(1)
    h.advance(1)
    expect(h.ticks).toEqual([90, 89, 88])
    expect(h.onZero).not.toHaveBeenCalled()
  })

  it('dispara onZero uma única vez ao chegar a 0 e para o timer', () => {
    const h = harness('2030-01-01T12:00:03Z', T0)
    h.cd.start()
    h.advance(3)
    expect(h.ticks.at(-1)).toBe(0)
    expect(h.onZero).toHaveBeenCalledTimes(1)
    h.advance(1)
    expect(h.onZero).toHaveBeenCalledTimes(1)
  })

  it('já vencido dispara onZero no start', () => {
    const h = harness('2030-01-01T11:59:00Z', T0)
    h.cd.start()
    expect(h.ticks).toEqual([0])
    expect(h.onZero).toHaveBeenCalledTimes(1)
  })

  it('sem expires_at ou inválido: sem contagem', () => {
    for (const v of [null, undefined, '', 'lixo']) {
      const h = harness(v, T0)
      expect(h.cd.valid).toBe(false)
      expect(h.cd.remaining()).toBeNull()
      h.cd.start()
      expect(h.ticks).toEqual([])
      expect(h.timers).toHaveLength(0)
      expect(h.onZero).not.toHaveBeenCalled()
    }
  })

  it('start é idempotente (não cria dois timers)', () => {
    const h = harness('2030-01-01T12:10:00Z', T0)
    h.cd.start()
    h.cd.start()
    expect(h.timers).toHaveLength(1)
  })
})
