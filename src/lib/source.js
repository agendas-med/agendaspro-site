// Origem do agendamento: ?source= (ou ?src=) na URL de /b/:slug. Valores aceitos pelo core.
export const BOOKING_SOURCES = ['link', 'instagram', 'qr', 'whatsapp', 'site']

const first = (v) => (Array.isArray(v) ? v[0] : v)
const norm = (v) => String(first(v) ?? '').trim().toLowerCase()

/** @param {Record<string, any>} query vue-router `route.query` @returns {'link'|'instagram'|'qr'|'whatsapp'|'site'} */
export function parseSource(query = {}) {
  for (const k of ['source', 'src', 'utm_source']) {
    const v = norm(query[k])
    if (BOOKING_SOURCES.includes(v)) return v
  }
  return 'link'
}

/** `source` do lead: "site" ou "site:<utm>" (o core limita a 80 caracteres). */
export function leadSource(attribution) {
  const a = String(attribution || '').replace(/[^\w.\-/]/g, '').slice(0, 70)
  return a ? `site:${a}` : 'site'
}
