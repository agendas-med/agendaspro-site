// Política de links do chat: o servidor já filtra a saída da IA, mas o front valida de novo (defesa em profundidade).
import { env } from '../config/env.js'

const hostOf = (url) => {
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return ''
  }
}

/**
 * Hosts permitidos como link: site, painel, wa.me, instagram.com, VITE_CHAT_LINK_HOSTS e (se informado) o host atual.
 * @param {{siteUrl?:string, appUrl?:string, extra?:string[], currentHost?:string}} [o]
 */
export function chatAllowedHosts({ siteUrl = env.siteUrl, appUrl = env.appUrl, extra = env.chatLinkHosts, currentHost = '' } = {}) {
  const set = new Set(['wa.me', 'api.whatsapp.com', 'instagram.com', hostOf(siteUrl), hostOf(appUrl), ...(extra || []), String(currentHost || '').toLowerCase()])
  set.delete('')
  return [...set]
}

/** Opções para parseChatText/safeHref. `currentHost` vem de location.hostname no cliente. */
export function chatLinkPolicy(opts = {}) {
  return {
    allowedHosts: chatAllowedHosts({ currentHost: typeof location !== 'undefined' ? location.hostname : '', ...opts }),
    allowRelative: true,
    allowLocalHttp: Boolean(opts.allowLocalHttp ?? env.isDev),
  }
}

/** Hosts "do próprio site" (abrem na mesma aba). */
export function chatOwnHosts({ siteUrl = env.siteUrl, appUrl = env.appUrl, currentHost = typeof location !== 'undefined' ? location.hostname : '' } = {}) {
  return [hostOf(siteUrl), hostOf(appUrl), String(currentHost || '').toLowerCase()].filter(Boolean)
}
