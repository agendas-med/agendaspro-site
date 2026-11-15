// Helpers de data/hora. Datas "YYYY-MM-DD" e horas "HH:mm" são locais da empresa (timezone IANA
// vindo da API): nunca passam por new Date() no fuso do navegador, exceto onde indicado.

const pad = (n) => String(n).padStart(2, '0')

/** Data de hoje (YYYY-MM-DD) no fuso informado. */
export function todayInTz(tz = 'America/Sao_Paulo', now = new Date()) {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now)
  } catch {
    return now.toISOString().slice(0, 10)
  }
}

/** Soma dias a uma data YYYY-MM-DD (aritmética em UTC, sem DST). */
export function addDays(ymd, days) {
  const [y, m, d] = ymd.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d + days))
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

const utcDate = (ymd) => {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

export const weekdayShort = (ymd) =>
  utcDate(ymd).toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'UTC' }).replace('.', '')

export const dayOfMonth = (ymd) => ymd.slice(8, 10)

export const monthShort = (ymd) =>
  utcDate(ymd).toLocaleDateString('pt-BR', { month: 'short', timeZone: 'UTC' }).replace('.', '')

export const formatDateLong = (ymd) =>
  utcDate(ymd).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })

/** "2026-11-20T14:30" -> { date: "2026-11-20", time: "14:30" } */
export function splitLocalDateTime(local) {
  const [date, time = ''] = String(local || '').split('T')
  return { date, time: time.slice(0, 5) }
}

export function formatLocalDateTime(local) {
  const { date, time } = splitLocalDateTime(local)
  if (!date) return ''
  return `${formatDateLong(date)} às ${time}`
}

/** Minutos restantes até um instante ISO (para a validade do Pix). */
export function secondsUntil(iso, now = Date.now()) {
  const t = Date.parse(iso)
  if (Number.isNaN(t)) return 0
  return Math.max(0, Math.floor((t - now) / 1000))
}

export function formatCountdown(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds))
  return `${pad(Math.floor(s / 60))}:${pad(s % 60)}`
}
