// Pós-build: gera o HTML estático das páginas de marketing a partir do bundle SSR, o shell SPA
// (/spa/index.html, alvo dos rewrites de /b/* e /agendamento/*), 404.html, sitemap.xml e robots.txt.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildSitemap, buildRobots } from '../src/lib/sitemap.js'
import { cspFromHeadersFile, connectSrcAllowsApi } from '../src/lib/csp.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'dist')
const ssrDir = path.join(root, 'dist-ssr')

const template = fs.readFileSync(path.join(dist, 'index.html'), 'utf8')
for (const marker of ['<!--head-tags-->', '<!--app-html-->', '<div id="app">']) {
  if (!template.includes(marker)) throw new Error(`index.html sem o marcador ${marker}`)
}

const ssr = await import(pathToFileURL(path.join(ssrDir, 'entry-server.js')).href)
const info = ssr.buildInfo()

const write = (rel, content) => {
  const file = path.join(dist, rel)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, content, 'utf8')
}

const inject = (html, headTags, pathname) =>
  template
    .replace('<!--head-tags-->', () => headTags)
    .replace('<!--app-html-->', () => html)
    .replace('<div id="app">', () => (pathname ? `<div id="app" data-prerendered="${pathname}">` : '<div id="app">'))

// 1) Shell SPA: sem conteúdo prerenderizado, com title/description genéricos.
const shellHead = [
  '<title>Agendar online | AgendasPro</title>',
  '<meta name="description" content="Agende online com horários em tempo real, de qualquer dispositivo.">',
  '<meta name="referrer" content="strict-origin-when-cross-origin">',
].join('\n    ')
write('spa/index.html', inject('', shellHead, null))

// 2) Páginas de marketing
const entries = ssr.sitemapEntries()
let count = 0
for (const { path: p } of entries) {
  const out = await ssr.render(p)
  if (out.routeName === 'not-found') throw new Error(`Rota prerenderizada caiu no 404: ${p}`)
  const rel = p === '/' ? 'index.html' : `${p.replace(/^\//, '')}/index.html`
  write(rel, inject(out.html, out.headTags, p))
  count++
}

// 3) 404 real
const nf = await ssr.render('/pagina-nao-encontrada')
write('404.html', inject(nf.html, nf.headTags, null))

// 4) sitemap + robots (só rotas estáticas: sem /b, /agendamento, shell ou 404)
const lastmod = new Date().toISOString().slice(0, 10)
write('sitemap.xml', buildSitemap(entries, { siteUrl: info.siteUrl, lastmod }))
write('robots.txt', buildRobots({ siteUrl: info.siteUrl }))

fs.rmSync(ssrDir, { recursive: true, force: true })

console.log(`prerender: ${count} páginas + 404.html + spa/index.html + sitemap.xml + robots.txt`)
if (info.hasPlaceholders) {
  console.warn(
    '\n[aviso] Existem placeholders não preenchidos em src/config/company.js (razão social, CNPJ, endereço, e-mails, WhatsApp). Preencha antes de publicar.',
  )
}
if (info.useMocks) {
  console.warn('\n[aviso] Build com mock ligado: NÃO publique este build em produção.')
}
if (!info.apiBase) {
  console.warn(
    '\n[aviso] VITE_API_BASE vazio: as chamadas /public/* vão para a mesma origem do site estático (sem API). Defina VITE_API_BASE com o host do core.',
  )
}
if (!info.turnstileConfigured) {
  console.warn(
    '\n[aviso] VITE_TURNSTILE_SITE_KEY vazio: sem a chave do Turnstile os formulários (lead e agendamento) ficam BLOQUEADOS neste build.',
  )
}
// O host da API precisa estar em connect-src do CSP, senão o navegador bloqueia 100% das chamadas.
const headersFile = path.join(dist, '_headers')
if (info.apiBase && fs.existsSync(headersFile)) {
  const csp = cspFromHeadersFile(fs.readFileSync(headersFile, 'utf8'))
  if (!connectSrcAllowsApi(csp, info.apiBase)) {
    console.error(
      `\n[erro] O host de VITE_API_BASE (${new URL(info.apiBase).origin}) não está em connect-src de public/_headers e vercel.json. Atualize os dois e rode o build de novo.`,
    )
    process.exitCode = 1
  }
}
