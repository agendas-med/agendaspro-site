// Montagem dos corpos enviados ao core (contrato docs/contratos-f3.md).
import { toE164BR } from './phone.js'
import { cpfDigits } from './cpf.js'
import { leadSource } from './source.js'

/**
 * POST /public/b/:slug/bookings (sem idempotency_key/turnstile_token: acrescentados no envio).
 * @param {{serviceIds:number[], professionalId?:number|null, slot:{date:string,time:string,professional_id?:number|null},
 *   form:{name:string,phone:string,email?:string,cpf?:string}, source:string}} a
 */
export function buildBookingPayload({ serviceIds, professionalId = null, slot, form, source }) {
  const email = String(form.email || '').trim()
  const cpf = cpfDigits(form.cpf)
  return {
    service_ids: [...serviceIds],
    professional_id: slot.professional_id ?? professionalId ?? null,
    start: `${slot.date}T${slot.time}`,
    customer: {
      name: form.name.trim(),
      phone: toE164BR(form.phone),
      ...(email ? { email } : {}),
      ...(cpf ? { cpf } : {}),
    },
    consent: true,
    source,
  }
}

/** POST /public/leads. `consent` só vai como true (o formulário exige o aceite). */
export function buildLeadPayload({ form, attribution, token }) {
  const email = String(form.email || '').trim()
  const message = String(form.message || '').trim()
  return {
    name: form.name.trim(),
    whatsapp: toE164BR(form.whatsapp),
    ...(email ? { email } : {}),
    segment: form.segment,
    source: leadSource(attribution),
    ...(message ? { message } : {}),
    consent: true,
    turnstile_token: token || '',
  }
}

/** Disponibilidade: `service_id=1,2` (vírgula literal; o core aceita 1 a 5 ids). */
export function availabilityQuery({ serviceIds, professionalId, from, to }) {
  return {
    service_id: (serviceIds || []).join(','),
    professional_id: professionalId || undefined,
    from,
    to,
  }
}
