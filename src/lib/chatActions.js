// Normalização defensiva do que o core devolve (actions, suggestions, proactive_hint) e mapeamento das
// dicas proativas (regra fixa do core: signup | lead_form | booking_link) para ações da UI.
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '')
const int = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : null)

/** Só tipos conhecidos do contrato, com campos mínimos válidos. Nada de HTML: tudo vira texto na UI. */
export function normalizeActions(actions) {
  const out = []
  for (const a of Array.isArray(actions) ? actions : []) {
    if (!a || typeof a !== 'object') continue
    if (a.type === 'link' || a.type === 'handoff') {
      const url = str(a.url, 2048)
      const label = str(a.label, 80)
      if (url && label) out.push({ type: a.type, label, url })
    } else if (a.type === 'plans') {
      const plans = (Array.isArray(a.plans) ? a.plans : [])
        .map((p) => ({ code: str(p?.code, 40), name: str(p?.name, 60), price_cents: int(p?.price_cents), commission_bps: int(p?.commission_bps) }))
        .filter((p) => p.name && p.price_cents !== null && p.commission_bps !== null)
        .slice(0, 4)
      if (plans.length) out.push({ type: 'plans', plans })
    } else if (a.type === 'lead_form') {
      out.push({ type: 'lead_form' })
    } else if (a.type === 'slots') {
      const slots = (Array.isArray(a.slots) ? a.slots : [])
        .map((s) => ({ date: str(s?.date, 10), time: str(s?.time, 5) }))
        .filter((s) => /^\d{4}-\d{2}-\d{2}$/.test(s.date) && /^\d{2}:\d{2}$/.test(s.time))
        .slice(0, 6)
      const booking_url = str(a.booking_url, 2048)
      if (slots.length && booking_url) out.push({ type: 'slots', slots, booking_url })
    }
  }
  return out.slice(0, 6)
}

export function normalizeSuggestions(list) {
  return (Array.isArray(list) ? list : [])
    .map((s) => str(s, 80))
    .filter(Boolean)
    .slice(0, 4)
}

/** proactive_hint {type,text,action} -> hint normalizado (ou null). */
export function normalizeHint(hint) {
  if (!hint || typeof hint !== 'object') return null
  const action = str(hint.action, 30)
  const text = str(hint.text, 160)
  if (!text || !['signup', 'lead_form', 'booking_link'].includes(action)) return null
  return { action, text }
}

/**
 * Ação concreta da dica proativa.
 * @returns {{kind:'link', label:string, href:string, external:boolean}|{kind:'lead', label:string}|null}
 */
export function hintCta(hint, { audience, company, leadSent, appLink }) {
  if (!hint) return null
  if (hint.action === 'signup') return { kind: 'link', label: 'Criar conta grátis', href: appLink('/registro'), external: true }
  if (hint.action === 'lead_form') return audience === 'business' && !leadSent ? { kind: 'lead', label: 'Deixar meu contato' } : null
  if (hint.action === 'booking_link') {
    const slug = company?.slug
    return slug && /^[a-z0-9-]{1,60}$/i.test(slug) ? { kind: 'link', label: 'Ver horários', href: `/b/${slug}`, external: false } : null
  }
  return null
}
