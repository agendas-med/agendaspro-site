// Servidor estático mínimo para testar o build localmente com as mesmas regras do deploy:
// diretórios -> index.html, /b/* e /agendamento/* -> /spa/index.html (200), desconhecido -> 404.html (404).
// Uso: npm run build && npm run serve:dist  (PORT opcional, padrão 4173)
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const port = Number(process.env.PORT) || 4173
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

function resolveFile(pathname) {
  const clean = path.normalize(decodeURIComponent(pathname)).replace(/^[/\\]+/, '')
  const abs = path.join(dist, clean)
  if (!abs.startsWith(dist)) return null
  if (fs.existsSync(abs) && fs.statSync(abs).isFile()) return abs
  const idx = path.join(abs, 'index.html')
  if (fs.existsSync(idx)) return idx
  return null
}

http
  .createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://localhost')
    let status = 200
    let file = null
    if (/^\/(b|agendamento)\/./.test(pathname)) file = path.join(dist, 'spa', 'index.html')
    else file = resolveFile(pathname)
    if (!file) {
      status = 404
      file = path.join(dist, '404.html')
    }
    res.writeHead(status, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream' })
    fs.createReadStream(file).pipe(res)
  })
  .listen(port, () => console.log(`dist em http://localhost:${port}`))
