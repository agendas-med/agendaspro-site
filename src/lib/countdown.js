// Contagem regressiva até um instante ISO (ex.: payment.expires_at). O relógio do aparelho pode estar
// errado: o ZERO local nunca é autoritativo (o chamador confere com o servidor antes de declarar expiração).
import { secondsUntil } from './datetime.js'

/**
 * @param {string|null|undefined} expiresAt ISO 8601 (o core envia com "Z"); vazio/ inválido = sem contagem.
 * @param {{onTick?:(remaining:number)=>void, onZero?:()=>void, now?:()=>number, setTimer?:Function, clearTimer?:Function}} o
 */
export function createCountdown(expiresAt, { onTick, onZero, now = () => Date.now(), setTimer = setInterval, clearTimer = clearInterval } = {}) {
  const valid = Boolean(expiresAt) && !Number.isNaN(Date.parse(expiresAt))
  let handle = null
  let fired = false

  const remaining = () => (valid ? secondsUntil(expiresAt, now()) : null)

  function tick() {
    const r = remaining()
    onTick?.(r)
    if (r !== null && r <= 0 && !fired) {
      fired = true
      stop()
      onZero?.()
    }
  }

  function stop() {
    if (handle !== null) clearTimer(handle)
    handle = null
  }

  return {
    valid,
    remaining,
    start() {
      if (!valid || handle !== null || fired) return
      tick()
      if (!fired) handle = setTimer(tick, 1000)
    },
    stop,
  }
}
