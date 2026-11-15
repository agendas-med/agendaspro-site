export class ApiError extends Error {
  /**
   * @param {number} status HTTP (0 = falha de rede/timeout)
   * @param {string} code código do contrato ({error:{code}}), ex.: slot_taken
   * @param {string} message mensagem do servidor (pt-BR)
   * @param {{retryAfter?:number, correlationId?:string}} extra
   */
  constructor(status, code, message, extra = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.retryAfter = extra.retryAfter
    this.correlationId = extra.correlationId
  }
}

/** Códigos do contrato do core (docs/contratos-f3.md). */
export const ERROR_CODES = [
  'validation_error',
  'consent_required',
  'turnstile_failed',
  'not_found',
  'token_expired',
  'slot_taken',
  'idempotency_conflict',
  'already_cancelled',
  'not_allowed',
  'cancel_window_closed',
  'rate_limited',
  'payment_unavailable',
  'service_unavailable',
  'payload_too_large',
  'internal_error',
]

/** Código inferido do status HTTP quando o corpo não traz {error:{code}} (proxy, CDN, corpo vazio). */
export function codeFromStatus(status) {
  if (status === 429) return 'rate_limited'
  if (status === 410) return 'token_expired'
  if (status === 413) return 'payload_too_large'
  if (status === 404) return 'not_found'
  return 'http_error'
}

const retryText = (s) => (s ? ` Tente de novo em ${s < 60 ? `${s}s` : `${Math.ceil(s / 60)} min`}.` : '')

const BY_CODE = {
  token_expired: () => 'Este link de agendamento expirou. Para alterar o horário, fale com o estabelecimento.',
  slot_taken: () => 'Esse horário acabou de ser ocupado. Escolha outro horário.',
  idempotency_conflict: () =>
    'Já existe uma tentativa anterior com dados diferentes. Revise os dados e envie de novo.',
  payment_unavailable: () =>
    'Não foi possível gerar o Pix do sinal agora e o horário não foi reservado. Tente de novo em instantes.',
  service_unavailable: () => 'O serviço está temporariamente indisponível. Tente de novo em alguns minutos.',
  not_allowed: () => 'Este agendamento não pode mais ser alterado por aqui.',
  cancel_window_closed: () =>
    'O prazo para cancelar ou remarcar pela internet já passou. Fale com o estabelecimento.',
  already_cancelled: () => 'Este agendamento já foi cancelado.',
  payload_too_large: () => 'Os dados enviados são grandes demais. Reduza o texto e tente de novo.',
  turnstile_failed: () => 'Não foi possível validar a verificação de segurança. Tente de novo.',
  consent_required: () => 'É preciso concordar com o tratamento dos dados para continuar.',
  rate_limited: (e) => `Muitas tentativas em pouco tempo.${retryText(e.retryAfter) || ' Aguarde um instante e tente de novo.'}`,
  not_found: () => 'Não encontramos o que você procurava. O link pode estar incorreto.',
  validation_error: (e) => e.message || 'Revise os dados informados e tente de novo.',
  internal_error: (e) =>
    `Estamos com instabilidade no momento. Tente de novo em alguns minutos.${e.correlationId ? ` (código ${e.correlationId})` : ''}`,
  timeout: () => 'O servidor demorou para responder. Verifique a internet e tente de novo.',
  network_error: () => 'Sem conexão com o servidor. Verifique a internet e tente de novo.',
  mock_disabled: () => 'Modo de demonstração desativado.',
}

/** Mensagem amigável (PT-BR) para o usuário final. Primeiro pelo código do contrato, depois pelo status. */
export function friendlyError(e) {
  if (!(e instanceof ApiError)) return 'Algo deu errado. Tente novamente.'
  const byCode = BY_CODE[e.code]
  if (byCode) return byCode(e)
  if (e.status === 0) return BY_CODE.network_error()
  if (e.status === 429) return BY_CODE.rate_limited(e)
  if (e.status >= 500) return BY_CODE.internal_error(e)
  if (e.status === 404) return BY_CODE.not_found(e)
  return e.message || 'Não foi possível concluir. Revise os dados e tente de novo.'
}

/**
 * A falha é "ambígua" (o servidor pode ter gravado a reserva)? Então o retry deve reutilizar a mesma
 * idempotency_key. Em falhas definitivas (4xx do contrato, pagamento/serviço indisponível) a chave gira.
 */
export function isAmbiguousFailure(e) {
  if (!(e instanceof ApiError)) return true
  if (e.status === 0) return true
  if (e.status === 429) return true // limite é checado antes de gravar: reusar a chave é inofensivo
  if (e.code === 'payment_unavailable' || e.code === 'service_unavailable') return false
  return e.status >= 500
}
