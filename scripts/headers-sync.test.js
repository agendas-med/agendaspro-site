import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'
import { connectSrcAllowsApi, cspFromHeadersFile, cspFromVercel, directiveSources } from '../src/lib/csp.js'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const headers = cspFromHeadersFile(fs.readFileSync(path.join(root, 'public/_headers'), 'utf8'))
const vercel = cspFromVercel(JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8')))

describe('CSP: public/_headers e vercel.json em sincronia', () => {
  it('ambos definem um CSP e ele é idêntico', () => {
    expect(headers).toBeTruthy()
    expect(vercel).toBe(headers)
  })
  it('libera o Turnstile (script e frame) e o host da API em connect-src', () => {
    expect(directiveSources(headers, 'script-src')).toContain('https://challenges.cloudflare.com')
    expect(directiveSources(headers, 'frame-src')).toContain('https://challenges.cloudflare.com')
    const connect = directiveSources(headers, 'connect-src')
    expect(connect.some((s) => /^https:\/\/api\./.test(s) || /herokuapp\.com$/.test(s))).toBe(true)
  })
  it('o placeholder documentado está presente no _headers', () => {
    expect(fs.readFileSync(path.join(root, 'public/_headers'), 'utf8')).toMatch(/PLACEHOLDER/)
  })
})

describe('connectSrcAllowsApi', () => {
  const csp = "default-src 'self'; connect-src 'self' https://api.exemplo.test https://x.y"
  it('compara pela origem', () => {
    expect(connectSrcAllowsApi(csp, 'https://api.exemplo.test')).toBe(true)
    expect(connectSrcAllowsApi(csp, 'https://api.exemplo.test/')).toBe(true)
    expect(connectSrcAllowsApi(csp, 'https://outro.test')).toBe(false)
    expect(connectSrcAllowsApi(csp, 'lixo')).toBe(false)
  })
  it('API na mesma origem exige self', () => {
    expect(connectSrcAllowsApi(csp, '')).toBe(true)
    expect(connectSrcAllowsApi("connect-src https://a.test", '')).toBe(false)
  })
})
