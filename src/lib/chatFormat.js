// Formatadores do chat (preço, comissão, horário, contagem regressiva).

/** price_cents -> "R$ 0", "R$ 49,90". */
export function formatPriceCents(cents) {
  const v = (Number(cents) || 0) / 100
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })}`
}

/** commission_bps -> "5%", "0,5%". */
export function formatBps(bps) {
  return `${((Number(bps) || 0) / 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}%`
}

/** {date:'2026-11-20', time:'09:30'} -> "20/11 às 09:30" (vazio se inválido). */
export function formatSlot(slot) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(slot?.date || ''))
  const t = /^\d{2}:\d{2}$/.test(String(slot?.time || '')) ? slot.time : ''
  if (!m || !t) return ''
  return `${m[3]}/${m[2]} às ${t}`
}

/** Segundos -> "30 s", "2 min". */
export function formatWait(seconds) {
  const s = Math.max(0, Math.ceil(Number(seconds) || 0))
  return s < 60 ? `${s} s` : `${Math.ceil(s / 60)} min`
}
