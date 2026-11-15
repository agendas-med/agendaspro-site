// Decide como o Turnstile se comporta, sem nunca liberar envio "em silêncio".
//  - widget      : há site key -> widget real da Cloudflare.
//  - bypass      : SEM site key, mas em dev/teste e com bypass explícito (VITE_TURNSTILE_DEV_BYPASS=true) ou mock.
//                  O core só aceita esse token se estiver com TURNSTILE_ENABLED=false + TURNSTILE_DEV_BYPASS=true.
//  - unavailable : sem site key e sem bypass permitido (sempre o caso em produção) -> o envio fica bloqueado.
export const DEV_BYPASS_TOKEN = 'dev-bypass'

/**
 * @param {{siteKey?:string, dev?:boolean, devBypass?:boolean, useMocks?:boolean}} o
 * @returns {'widget'|'bypass'|'unavailable'}
 */
export function turnstileMode({ siteKey = '', dev = false, devBypass = false, useMocks = false } = {}) {
  if (siteKey) return 'widget'
  if (dev && (devBypass || useMocks)) return 'bypass'
  return 'unavailable'
}
