// Calculadora de ponto de equilíbrio: comissão do Free vs mensalidade + comissão do Premium.
// Toda a aritmética é em centavos inteiros.

export const FREE_BPS = 500 // 5%
export const PREMIUM_BPS = 50 // 0,5%
export const PREMIUM_PRICE_CENTS = 4990

const pct = (cents, bps) => Math.round((cents * bps) / 10000)

/**
 * @param {object} p
 * @param {number} p.monthlySalesCents vendas online mensais em centavos
 * @returns {{freeCostCents:number, premiumCostCents:number, savingsCents:number,
 *   breakEvenCents:number, best:'free'|'premium'|'equal'}}
 */
export function calcCommission({
  monthlySalesCents,
  freeBps = FREE_BPS,
  premiumBps = PREMIUM_BPS,
  premiumPriceCents = PREMIUM_PRICE_CENTS,
} = {}) {
  const sales = Math.max(0, Math.round(Number(monthlySalesCents) || 0))
  const freeCostCents = pct(sales, freeBps)
  const premiumCostCents = premiumPriceCents + pct(sales, premiumBps)
  const savingsCents = freeCostCents - premiumCostCents
  const diffBps = freeBps - premiumBps
  const breakEvenCents = diffBps > 0 ? Math.ceil((premiumPriceCents * 10000) / diffBps) : Infinity
  const best = savingsCents > 0 ? 'premium' : savingsCents < 0 ? 'free' : 'equal'
  return { freeCostCents, premiumCostCents, savingsCents, breakEvenCents, best }
}

/** "1.234,50" (digitado pelo usuário) -> centavos. Aceita "1234", "1.234,5", "R$ 1.234,50". */
export function parseBRLToCents(input) {
  const s = String(input ?? '')
    .replace(/[^\d,.]/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
  const n = Number.parseFloat(s)
  return Number.isFinite(n) ? Math.round(n * 100) : 0
}

export const formatBRL = (cents) =>
  (Number(cents || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
