export class ApiError extends Error {
  /**
   * @param {number} status HTTP (0 = falha de rede/timeout)
   * @param {string} code código do contrato ({error:{code}}), ex.: slot_taken
   * @param {string} message mensagem do servidor (pt-BR)
   * @param {{retryAfter?:number}} extra
   */
  constructor(status, code, message, extra = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.retryAfter = extra.retryAfter
  }
}

/** Mensagem amigável para exibir ao usuário final. */
export function friendlyError(e) {
  if (!(e instanceof ApiError)) return 'Algo deu errado. Tente novamente.'
  if (e.status === 0) return 'Sem conexão com o servidor. Verifique a internet e tente de novo.'
  if (e.code === 'slot_taken') return 'Esse horário acabou de ser ocupado. Escolha outro horário.'
  if (e.status === 429) return 'Muitas tentativas em pouco tempo. Aguarde um instante e tente novamente.'
  if (e.status === 404) return 'Não encontramos o que você procurava. O link pode estar incorreto ou expirado.'
  if (e.code === 'turnstile_failed') return 'Não foi possível validar a verificação de segurança. Tente novamente.'
  if (e.status >= 500) return 'Estamos com instabilidade no momento. Tente novamente em alguns minutos.'
  return e.message || 'Não foi possível concluir. Revise os dados e tente de novo.'
}
