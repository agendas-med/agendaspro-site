import { describe, it, expect } from 'vitest'
import { calcCommission, parseBRLToCents, formatBRL, FREE_BPS, PREMIUM_BPS, PREMIUM_PRICE_CENTS } from './commission.js'

describe('calcCommission', () => {
  it('usa 5%, 0,5% e R$ 49,90 como padrão', () => {
    expect(FREE_BPS).toBe(500)
    expect(PREMIUM_BPS).toBe(50)
    expect(PREMIUM_PRICE_CENTS).toBe(4990)
  })

  it('calcula custo de cada plano em centavos', () => {
    // R$ 5.000,00 -> Free 5% = R$ 250,00 ; Premium 49,90 + 0,5% (25,00) = R$ 74,90
    const r = calcCommission({ monthlySalesCents: 500000 })
    expect(r.freeCostCents).toBe(25000)
    expect(r.premiumCostCents).toBe(7490)
    expect(r.savingsCents).toBe(17510)
    expect(r.best).toBe('premium')
  })

  it('ponto de equilíbrio: R$ 1.108,89 (arredondado para cima)', () => {
    const { breakEvenCents } = calcCommission({ monthlySalesCents: 0 })
    expect(breakEvenCents).toBe(110889)
    // abaixo do ponto de equilíbrio o Free é mais barato; acima, o Premium
    expect(calcCommission({ monthlySalesCents: 100000 }).best).toBe('free')
    expect(calcCommission({ monthlySalesCents: 120000 }).best).toBe('premium')
  })

  it('zero de vendas: Free custa zero e Premium só a mensalidade', () => {
    const r = calcCommission({ monthlySalesCents: 0 })
    expect(r.freeCostCents).toBe(0)
    expect(r.premiumCostCents).toBe(4990)
    expect(r.best).toBe('free')
  })

  it('entradas inválidas ou negativas viram zero', () => {
    expect(calcCommission({ monthlySalesCents: -500 }).freeCostCents).toBe(0)
    expect(calcCommission({ monthlySalesCents: NaN }).freeCostCents).toBe(0)
    expect(calcCommission().premiumCostCents).toBe(4990)
  })

  it('respeita preço e taxas customizados', () => {
    const r = calcCommission({ monthlySalesCents: 100000, freeBps: 500, premiumBps: 0, premiumPriceCents: 5000 })
    expect(r.freeCostCents).toBe(5000)
    expect(r.premiumCostCents).toBe(5000)
    expect(r.best).toBe('equal')
    expect(r.breakEvenCents).toBe(100000)
  })

  it('sem diferença de taxa não há ponto de equilíbrio', () => {
    expect(calcCommission({ monthlySalesCents: 1000, freeBps: 50, premiumBps: 50 }).breakEvenCents).toBe(Infinity)
  })
})

describe('parseBRLToCents', () => {
  it('interpreta formatos brasileiros', () => {
    expect(parseBRLToCents('1234')).toBe(123400)
    expect(parseBRLToCents('1.234,5')).toBe(123450)
    expect(parseBRLToCents('R$ 1.234,50')).toBe(123450)
    expect(parseBRLToCents('0,99')).toBe(99)
  })
  it('retorna 0 para lixo ou vazio', () => {
    expect(parseBRLToCents('')).toBe(0)
    expect(parseBRLToCents('abc')).toBe(0)
    expect(parseBRLToCents(null)).toBe(0)
  })
})

describe('formatBRL', () => {
  it('formata em reais', () => {
    expect(formatBRL(4990).replace(/\s/g, ' ')).toBe('R$ 49,90')
    expect(formatBRL(0).replace(/\s/g, ' ')).toBe('R$ 0,00')
  })
})
