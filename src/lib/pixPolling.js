// Consulta periódica do status do agendamento enquanto aguarda o Pix do sinal.
// Orçamento: o core limita /public/bookings/* a 60 req / 10 min por IP; por isso o ritmo estaciona em 15 s
// (piso absoluto de 5 s), pausa com a aba oculta, consulta uma vez ao voltar e respeita Retry-After no 429.
import { ApiError } from '../services/apiError.js'

export const MIN_POLL_MS = 5000
export const STEADY_POLL_MS = 15000
const WARMUP_MS = [5000, 5000, 10000] // primeiras consultas mais rápidas (Pix costuma ser pago logo)
const DEFAULT_429_MS = 30000 // Retry-After não é legível via CORS se o core não o expuser
const MAX_BACKOFF_MS = 60000

/** Interpreta a resposta de GET /public/bookings/:token para a tela do Pix. */
export function interpretPixStatus(view) {
  const b = view?.booking
  if (!b) return { kind: 'unknown' }
  if (b.status === 'confirmed' || b.status === 'completed') return { kind: 'confirmed', booking: b }
  if (b.status === 'cancelled') {
    const reason = b.cancellation_reason || ''
    if (['payment_expired', 'paid_after_expiry', 'payment_failed'].includes(reason)) return { kind: 'expired', reason, booking: b }
    return { kind: 'cancelled', reason, booking: b }
  }
  if (b.status === 'pending_payment') return { kind: 'pending', booking: b, payment: view.payment || null }
  return { kind: 'unknown', booking: b }
}

/** Próximo intervalo conforme tentativa (0-based) e falha anterior. Nunca abaixo de MIN_POLL_MS. */
export function nextDelay({ attempt = 0, error = null, steadyMs = STEADY_POLL_MS } = {}) {
  const steady = Math.max(MIN_POLL_MS, steadyMs)
  if (error instanceof ApiError) {
    if (error.status === 429) return Math.max(MIN_POLL_MS, (error.retryAfter ? error.retryAfter * 1000 : DEFAULT_429_MS))
    return Math.min(MAX_BACKOFF_MS, Math.max(steady, steady * 2 ** Math.min(attempt, 3)))
  }
  if (error) return Math.min(MAX_BACKOFF_MS, Math.max(steady, steady * 2))
  return Math.max(MIN_POLL_MS, attempt < WARMUP_MS.length ? WARMUP_MS[attempt] : steady)
}

const isTerminalError = (e) => e instanceof ApiError && (e.status === 404 || e.status === 410)

/**
 * @param {{
 *   fetchStatus:()=>Promise<any>,
 *   onResult:(view:any)=>boolean|void,   retornar true encerra o polling
 *   onError?:(e:Error, info:{terminal:boolean})=>void,
 *   steadyMs?:number,
 *   isHidden?:()=>boolean,
 *   onVisibilityChange?:(cb:()=>void)=>()=>void,
 *   setTimer?:Function, clearTimer?:Function
 * }} o
 */
export function createStatusPoller({
  fetchStatus,
  onResult,
  onError,
  steadyMs = STEADY_POLL_MS,
  isHidden = () => typeof document !== 'undefined' && document.hidden,
  onVisibilityChange = (cb) => {
    if (typeof document === 'undefined') return () => {}
    document.addEventListener('visibilitychange', cb)
    return () => document.removeEventListener('visibilitychange', cb)
  },
  setTimer = setTimeout,
  clearTimer = clearTimeout,
} = {}) {
  let timer = null
  let running = false
  let inFlight = false
  let attempt = 0
  let lastError = null
  let unsubscribe = null
  let lastRunAt = 0

  const clear = () => {
    if (timer !== null) clearTimer(timer)
    timer = null
  }

  function schedule() {
    clear()
    if (!running || isHidden()) return // aba oculta: pausa (retoma ao ficar visível)
    timer = setTimer(run, nextDelay({ attempt, error: lastError, steadyMs }))
  }

  async function run() {
    timer = null
    if (!running || inFlight) return
    inFlight = true
    lastRunAt = Date.now()
    try {
      const view = await fetchStatus()
      lastError = null
      attempt += 1
      if (onResult?.(view) === true) return stop()
    } catch (e) {
      const terminal = isTerminalError(e)
      lastError = e
      attempt += 1
      onError?.(e, { terminal })
      if (terminal) return stop()
    } finally {
      inFlight = false
    }
    schedule()
  }

  function visibilityChanged() {
    if (!running) return
    if (isHidden()) return clear()
    // voltou a ficar visível: confere já (respeitando o piso de 5 s desde a última consulta)
    if (Date.now() - lastRunAt >= MIN_POLL_MS) {
      clear()
      run()
    } else if (timer === null && !inFlight) schedule()
  }

  function stop() {
    running = false
    clear()
    unsubscribe?.()
    unsubscribe = null
  }

  return {
    start({ immediate = false } = {}) {
      if (running) return
      running = true
      attempt = 0
      lastError = null
      unsubscribe = onVisibilityChange(visibilityChanged)
      if (immediate && !isHidden()) run()
      else schedule()
    },
    /** Consulta agora (ex.: botão "Já paguei", contagem zerada), sem esperar o ritmo normal. */
    async checkNow() {
      if (!running || inFlight) return
      clear()
      await run()
    },
    stop,
    get running() {
      return running
    },
  }
}
