// Classifica os erros do contrato do chat (contratos-f5a.md) em tipos tratáveis pela UI, com texto pt-BR.
import { ApiError } from '../services/apiError.js'

const DEFAULT_WAIT = { rate_limited: 30, too_fast: 2, cooldown: 60, in_progress: 2 }

/**
 * @typedef {{kind:string, text:string, retryable:boolean, wait?:number, terminal?:boolean}} ChatErrorInfo
 * kinds: disabled | session_lost | blocked | closed | message_limit | cooldown | rate_limited | too_fast |
 *        in_progress | too_long | unavailable | not_found | turnstile | lead_exists | already_rated |
 *        network | server | validation | other
 */

/** @returns {ChatErrorInfo} */
export function chatErrorInfo(e) {
  if (!(e instanceof ApiError)) return { kind: 'other', text: 'Algo deu errado. Tente novamente.', retryable: true }
  const wait = (code) => (Number.isFinite(e.retryAfter) && e.retryAfter > 0 ? e.retryAfter : DEFAULT_WAIT[code])
  const code = e.code
  if (code === 'chat_disabled') return { kind: 'disabled', text: 'O chat está indisponível no momento.', retryable: false, terminal: true }
  if (e.status === 401 || code === 'invalid_session' || code === 'session_expired') {
    return { kind: 'session_lost', text: 'Esta conversa expirou. Inicie uma nova conversa para continuar.', retryable: false, terminal: true }
  }
  if (code === 'session_blocked') {
    return {
      kind: 'blocked',
      text: e.message || 'Esta conversa foi encerrada por segurança. Fale com a nossa equipe pelo WhatsApp ou pelo formulário de contato.',
      retryable: false,
      terminal: true,
    }
  }
  if (code === 'session_closed') return { kind: 'closed', text: 'Esta conversa foi encerrada.', retryable: false, terminal: true }
  if (code === 'message_limit') {
    return { kind: 'message_limit', text: 'Esta conversa atingiu o limite de mensagens.', retryable: false, terminal: true }
  }
  if (code === 'cooldown') {
    const w = wait('cooldown')
    return { kind: 'cooldown', text: 'Vamos fazer uma pausa antes da próxima mensagem.', retryable: true, wait: w }
  }
  if (code === 'too_fast') {
    const w = wait('too_fast')
    return { kind: 'too_fast', text: 'Calma, uma mensagem por vez. Tente de novo em instantes.', retryable: true, wait: w }
  }
  if (code === 'rate_limited' || e.status === 429) {
    const w = wait('rate_limited')
    return { kind: 'rate_limited', text: 'Muitas mensagens em pouco tempo.', retryable: true, wait: w }
  }
  if (code === 'in_progress') return { kind: 'in_progress', text: 'Sua mensagem ainda está sendo respondida.', retryable: true, wait: wait('in_progress') }
  if (code === 'message_too_long' || code === 'payload_too_large' || e.status === 413) {
    return { kind: 'too_long', text: 'A mensagem é longa demais. Resuma e envie de novo.', retryable: false }
  }
  if (code === 'turnstile_failed') {
    return { kind: 'turnstile', text: 'Não foi possível validar a verificação de segurança. Tente de novo.', retryable: true }
  }
  if (code === 'not_found') return { kind: 'not_found', text: 'Não encontramos esta página de atendimento.', retryable: false, terminal: true }
  if (code === 'lead_exists') return { kind: 'lead_exists', text: 'Seu contato já foi enviado. Nossa equipe vai falar com você.', retryable: false }
  if (code === 'already_rated') return { kind: 'already_rated', text: 'Esta conversa já foi avaliada. Obrigado!', retryable: false }
  if (code === 'service_unavailable' || e.status === 503) {
    return { kind: 'unavailable', text: 'O atendimento por chat está temporariamente indisponível.', retryable: true }
  }
  if (e.status === 0 || code === 'stream_interrupted') {
    return {
      kind: 'network',
      text: code === 'timeout' ? 'A resposta demorou mais que o esperado.' : 'Sem conexão ou resposta interrompida. Verifique a internet.',
      retryable: true,
    }
  }
  if (e.status >= 500) return { kind: 'server', text: 'Estamos com instabilidade. Tente de novo em instantes.', retryable: true }
  if (code === 'validation_error' || e.status === 400) {
    return { kind: 'validation', text: e.message || 'Revise os dados e tente de novo.', retryable: false }
  }
  return { kind: 'other', text: e.message || 'Não foi possível concluir. Tente de novo.', retryable: true }
}
