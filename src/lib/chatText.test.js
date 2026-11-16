import { describe, it, expect } from 'vitest'
import { cleanText, isExternalHref, parseChatText, plainText, safeHref } from './chatText.js'

const opts = { allowedHosts: ['agendaspro.com.br', 'wa.me'], allowRelative: true }
const flat = (blocks) => JSON.stringify(blocks)

describe('safeHref', () => {
  it('aceita https em host da allowlist e subdomínio', () => {
    expect(safeHref('https://agendaspro.com.br/precos', opts)).toBe('https://agendaspro.com.br/precos')
    expect(safeHref('https://app.agendaspro.com.br/registro', opts)).toBe('https://app.agendaspro.com.br/registro')
    expect(safeHref('https://wa.me/5511999999999?text=oi', opts)).toContain('https://wa.me/5511999999999')
  })
  it('recusa host fora da allowlist e sufixo enganoso', () => {
    expect(safeHref('https://evil.com', opts)).toBeNull()
    expect(safeHref('https://agendaspro.com.br.evil.com', opts)).toBeNull()
    expect(safeHref('https://evilagendaspro.com.br', opts)).toBeNull()
  })
  it('recusa esquemas perigosos e http', () => {
    for (const u of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>', 'vbscript:x', 'file:///etc/passwd', 'http://agendaspro.com.br', 'ftp://agendaspro.com.br']) {
      expect(safeHref(u, opts), u).toBeNull()
    }
  })
  it('recusa credenciais na URL, espaços, controles e barra invertida', () => {
    expect(safeHref('https://user:pw@agendaspro.com.br', opts)).toBeNull()
    expect(safeHref('https://agendaspro.com.br/a b', opts)).toBeNull()
    expect(safeHref('https://agendaspro.com.br/\u0001', opts)).toBeNull()
    expect(safeHref('https://agendaspro.com.br\\@evil.com', opts)).toBeNull()
  })
  it('caminho interno só quando permitido e nunca //host', () => {
    expect(safeHref('/b/clinica', opts)).toBe('/b/clinica')
    expect(safeHref('//evil.com', opts)).toBeNull()
    expect(safeHref('/x', { ...opts, allowRelative: false })).toBeNull()
  })
  it('mailto simples sim; com parâmetros não', () => {
    expect(safeHref('mailto:suporte@agendaspro.com.br', opts)).toBe('mailto:suporte@agendaspro.com.br')
    expect(safeHref('mailto:a@b.com?cc=x@y.com', opts)).toBeNull()
  })
  it('http só em localhost e só com allowLocalHttp', () => {
    expect(safeHref('http://localhost:5173/b/x', { ...opts, allowLocalHttp: true })).toBe('http://localhost:5173/b/x')
    expect(safeHref('http://localhost:5173/b/x', opts)).toBeNull()
    expect(safeHref('http://evil.com', { ...opts, allowLocalHttp: true })).toBeNull()
  })
  it('allowedHosts null desliga só a checagem de host', () => {
    expect(safeHref('https://qualquer.com', { allowedHosts: null })).toBe('https://qualquer.com/')
    expect(safeHref('javascript:alert(1)', { allowedHosts: null })).toBeNull()
  })
})

describe('isExternalHref', () => {
  it('interno/mailto não é externo; host próprio não; outro sim', () => {
    expect(isExternalHref('/precos', ['agendaspro.com.br'])).toBe(false)
    expect(isExternalHref('mailto:a@b.com')).toBe(false)
    expect(isExternalHref('https://app.agendaspro.com.br/x', ['agendaspro.com.br'])).toBe(false)
    expect(isExternalHref('https://wa.me/1', ['agendaspro.com.br'])).toBe(true)
  })
})

describe('cleanText', () => {
  it('remove controles e bidi, normaliza quebras e limita o tamanho', () => {
    expect(cleanText('a\u0000b‮c​d\r\ne')).toBe('abcd\ne')
    expect(cleanText('x'.repeat(9000)).length).toBe(4000)
    expect(cleanText(null)).toBe('')
  })
})

describe('parseChatText', () => {
  it('texto com HTML vira texto literal (nunca marcação)', () => {
    const b = parseChatText('<img src=x onerror=alert(1)> <script>alert(1)</script>', opts)
    expect(b).toHaveLength(1)
    expect(b[0].inline.every((n) => n.t === 'text')).toBe(true)
    expect(b[0].inline.map((n) => n.v).join('')).toContain('<script>')
  })
  it('negrito, listas, parágrafos e quebras de linha', () => {
    const b = parseChatText('Olá **mundo**\nlinha 2\n\n- um\n- dois\n\n1. três', opts)
    expect(b.map((x) => x.type)).toEqual(['p', 'ul', 'ul'])
    expect(b[0].inline.find((n) => n.t === 'strong').v).toBe('mundo')
    expect(b[0].inline.some((n) => n.t === 'br')).toBe(true)
    expect(b[1].items).toHaveLength(2)
  })
  it('markdown [rótulo](url) válido vira link; inválido vira só o rótulo', () => {
    const ok = parseChatText('veja [os planos](https://agendaspro.com.br/precos)', opts)
    expect(ok[0].inline.find((n) => n.t === 'link')).toMatchObject({ v: 'os planos', href: 'https://agendaspro.com.br/precos' })
    const bad = parseChatText('clique [aqui](javascript:alert(1)) e [ali](https://evil.com)', opts)
    expect(bad[0].inline.some((n) => n.t === 'link')).toBe(false)
    expect(flat(bad)).not.toContain('javascript')
    expect(flat(bad)).not.toContain('evil.com')
  })
  it('URL solta: pontuação final fica fora do link; host não permitido fica como texto', () => {
    const b = parseChatText('Acesse https://agendaspro.com.br/precos. Ou https://evil.com/x', opts)
    const link = b[0].inline.find((n) => n.t === 'link')
    expect(link.href).toBe('https://agendaspro.com.br/precos')
    expect(b[0].inline.filter((n) => n.t === 'link')).toHaveLength(1)
  })
  it('plainText resume sem marcação', () => {
    expect(plainText('**Oi** [x](https://agendaspro.com.br)\n- a\n- b', opts)).toBe('Oi x a; b')
  })
})
