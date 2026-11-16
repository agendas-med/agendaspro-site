import { describe, it, expect } from 'vitest'
import { ApiError } from '../services/apiError.js'
import { chatErrorInfo } from './chatErrors.js'
import { hintCta, normalizeActions, normalizeHint, normalizeSuggestions } from './chatActions.js'
import { clearSaved, isChatMarkedDisabled, markChatDisabled, memoryStorage, readSaved, sessionKey, writeSaved } from './chatStorage.js'
import { chatAllowedHosts, chatLinkPolicy } from './chatLinks.js'
import { formatBps, formatPriceCents, formatSlot, formatWait } from './chatFormat.js'

const err = (status, code, opts) => new ApiError(status, code, 'm', opts)

describe('chatErrorInfo', () => {
  it.each([
    [503, 'chat_disabled', 'disabled'],
    [401, 'session_expired', 'session_lost'],
    [401, 'invalid_session', 'session_lost'],
    [403, 'session_blocked', 'blocked'],
    [409, 'session_closed', 'closed'],
    [429, 'message_limit', 'message_limit'],
    [429, 'cooldown', 'cooldown'],
    [429, 'too_fast', 'too_fast'],
    [429, 'rate_limited', 'rate_limited'],
    [409, 'in_progress', 'in_progress'],
    [413, 'message_too_long', 'too_long'],
    [400, 'turnstile_failed', 'turnstile'],
    [404, 'not_found', 'not_found'],
    [409, 'lead_exists', 'lead_exists'],
    [409, 'already_rated', 'already_rated'],
    [503, 'service_unavailable', 'unavailable'],
    [0, 'network_error', 'network'],
    [500, 'internal_error', 'server'],
    [400, 'validation_error', 'validation'],
  ])('%i %s => %s', (status, code, kind) => {
    expect(chatErrorInfo(err(status, code)).kind).toBe(kind)
  })
  it('usa Retry-After quando existe e padrão quando não', () => {
    expect(chatErrorInfo(err(429, 'rate_limited', { retryAfter: 45 })).wait).toBe(45)
    expect(chatErrorInfo(err(429, 'rate_limited')).wait).toBeGreaterThan(0)
    expect(chatErrorInfo(err(409, 'in_progress', { retryAfter: 2 })).wait).toBe(2)
  })
  it('erro desconhecido (não ApiError) é tratável', () => {
    expect(chatErrorInfo(new Error('x')).retryable).toBe(true)
  })
  it('texto ao usuário nunca contém o token', () => {
    expect(chatErrorInfo(err(401, 'session_expired')).text).not.toMatch(/cs1\./)
  })
})

describe('normalização de actions/suggestions/hint', () => {
  it('descarta tipos desconhecidos e itens inválidos', () => {
    const out = normalizeActions([
      { type: 'link', label: 'Planos', url: 'https://agendaspro.com.br/precos' },
      { type: 'link', label: '', url: 'x' },
      { type: 'script', src: 'x' },
      { type: 'plans', plans: [{ code: 'free', name: 'Gratuito', price_cents: 0, commission_bps: 500 }, { name: '' }] },
      { type: 'slots', slots: [{ date: '2026-11-20', time: '09:00' }, { date: 'x', time: 'y' }], booking_url: '/b/x' },
      { type: 'slots', slots: [], booking_url: '/b/x' },
      { type: 'lead_form', endpoint: '/public/chat/lead', requires_consent: true },
      null,
    ])
    expect(out.map((a) => a.type)).toEqual(['link', 'plans', 'slots', 'lead_form'])
    expect(out[1].plans).toHaveLength(1)
    expect(out[2].slots).toHaveLength(1)
  })
  it('suggestions: só strings, limpas e limitadas', () => {
    expect(normalizeSuggestions([' a ', '', 5, 'b', 'c', 'd', 'e'])).toEqual(['a', 'b', 'c', 'd'])
    expect(normalizeSuggestions(null)).toEqual([])
  })
  it('hint: só ações da allowlist', () => {
    expect(normalizeHint({ type: 'cta', text: 'Oi', action: 'signup' })).toEqual({ action: 'signup', text: 'Oi' })
    expect(normalizeHint({ text: 'Oi', action: 'rm -rf' })).toBeNull()
    expect(normalizeHint(null)).toBeNull()
  })
  it('hintCta mapeia signup/lead_form/booking_link', () => {
    const appLink = (p) => `https://app.test${p}`
    expect(hintCta({ action: 'signup' }, { appLink })).toMatchObject({ kind: 'link', href: 'https://app.test/registro' })
    expect(hintCta({ action: 'lead_form' }, { audience: 'business', leadSent: false, appLink })).toMatchObject({ kind: 'lead' })
    expect(hintCta({ action: 'lead_form' }, { audience: 'business', leadSent: true, appLink })).toBeNull()
    expect(hintCta({ action: 'lead_form' }, { audience: 'customer', appLink })).toBeNull()
    expect(hintCta({ action: 'booking_link' }, { company: { slug: 'clinica-x' }, appLink })).toMatchObject({ href: '/b/clinica-x', external: false })
    expect(hintCta({ action: 'booking_link' }, { company: { slug: '../x' }, appLink })).toBeNull()
  })
})

describe('chatStorage', () => {
  it('guarda só token/expiresAt/audience e separa site de /b/:slug', () => {
    const st = memoryStorage()
    writeSaved(st, null, { token: 'cs1.a.1.b', expiresAt: 123, audience: 'business', extra: 'x', messages: ['segredo'] })
    writeSaved(st, 'clinica', { token: 'cs1.c.1.d', expiresAt: 456, audience: 'customer' })
    expect(readSaved(st, null)).toEqual({ token: 'cs1.a.1.b', expiresAt: 123, audience: 'business' })
    expect(readSaved(st, 'clinica').audience).toBe('customer')
    expect(st.getItem(sessionKey(null))).not.toContain('segredo')
    clearSaved(st, null)
    expect(readSaved(st, null)).toBeNull()
  })
  it('valor corrompido é ignorado', () => {
    const st = memoryStorage()
    st.setItem(sessionKey(null), '{oops')
    expect(readSaved(st, null)).toBeNull()
    st.setItem(sessionKey(null), JSON.stringify({ token: 1, expiresAt: 'x', audience: 'admin' }))
    expect(readSaved(st, null)).toBeNull()
  })
  it('marca chat desligado', () => {
    const st = memoryStorage()
    expect(isChatMarkedDisabled(st)).toBe(false)
    markChatDisabled(st)
    expect(isChatMarkedDisabled(st)).toBe(true)
  })
})

describe('política de links e formatação', () => {
  it('allowlist inclui site, app, wa.me, instagram, extras e host atual', () => {
    const h = chatAllowedHosts({ siteUrl: 'https://agendaspro.com.br', appUrl: 'https://app.agendaspro.com.br', extra: ['parceiro.com'], currentHost: 'preview.vercel.app' })
    expect(h).toEqual(expect.arrayContaining(['agendaspro.com.br', 'app.agendaspro.com.br', 'wa.me', 'instagram.com', 'parceiro.com', 'preview.vercel.app']))
    expect(h).not.toContain('')
  })
  it('chatLinkPolicy só libera http de localhost com allowLocalHttp', () => {
    expect(chatLinkPolicy({ allowLocalHttp: false }).allowLocalHttp).toBe(false)
    expect(chatLinkPolicy({ allowLocalHttp: true }).allowRelative).toBe(true)
  })
  it('formatadores', () => {
    expect(formatPriceCents(0)).toBe('R$ 0')
    expect(formatPriceCents(4990)).toContain('49,90')
    expect(formatBps(500)).toBe('5%')
    expect(formatBps(50)).toBe('0,5%')
    expect(formatSlot({ date: '2026-11-20', time: '09:30' })).toBe('20/11 às 09:30')
    expect(formatSlot({ date: 'x', time: '09:30' })).toBe('')
    expect(formatWait(30)).toBe('30 s')
    expect(formatWait(61)).toBe('2 min')
  })
})
