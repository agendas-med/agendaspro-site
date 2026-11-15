// Utilitários de CSP usados pelo prerender e pelos testes (public/_headers e vercel.json devem ficar em sincronia).

/** Extrai o valor do Content-Security-Policy de um arquivo no formato Netlify/Cloudflare `_headers`. */
export function cspFromHeadersFile(text) {
  const m = String(text || '').match(/^\s*Content-Security-Policy:\s*(.+)$/m)
  return m ? m[1].trim() : ''
}

/** Extrai o CSP de um vercel.json já parseado. */
export function cspFromVercel(json) {
  for (const h of json?.headers || []) {
    const c = (h.headers || []).find((x) => String(x.key).toLowerCase() === 'content-security-policy')
    if (c) return String(c.value).trim()
  }
  return ''
}

/** Fontes de uma diretiva (ex.: 'connect-src'). */
export function directiveSources(csp, name) {
  for (const part of String(csp || '').split(';')) {
    const [dir, ...src] = part.trim().split(/\s+/)
    if (dir === name) return src
  }
  return []
}

/** O CSP libera `connect-src` para a origem de `apiBase`? (vazio = mesma origem = 'self'). */
export function connectSrcAllowsApi(csp, apiBase) {
  const sources = directiveSources(csp, 'connect-src')
  if (!apiBase) return sources.includes("'self'")
  let origin
  try {
    origin = new URL(apiBase).origin
  } catch {
    return false
  }
  return sources.includes(origin)
}
