import { describe, it, expect } from 'vitest'
import { availabilityQuery, buildBookingPayload, buildLeadPayload } from './bookingPayload.js'
import { parseSource, leadSource } from './source.js'
import { cpfDigits, isValidCpf, maskCpf } from './cpf.js'
import { turnstileMode, DEV_BYPASS_TOKEN } from './turnstileMode.js'

describe('buildBookingPayload', () => {
  const slot = { date: '2030-02-03', time: '10:30', professional_id: 11 }

  it('monta o corpo do contrato (E.164, start local, consent, source)', () => {
    const p = buildBookingPayload({
      serviceIds: [1, 2],
      professionalId: null,
      slot,
      form: { name: '  Ana  ', phone: '(11) 91234-5678', email: ' ana@exemplo.test ', cpf: '' },
      source: 'instagram',
    })
    expect(p).toEqual({
      service_ids: [1, 2],
      professional_id: 11,
      start: '2030-02-03T10:30',
      customer: { name: 'Ana', phone: '+5511912345678', email: 'ana@exemplo.test' },
      consent: true,
      source: 'instagram',
    })
    expect(p).not.toHaveProperty('idempotency_key')
    expect(p).not.toHaveProperty('turnstile_token')
  })

  it('omite e-mail vazio; inclui CPF só com dígitos', () => {
    const p = buildBookingPayload({
      serviceIds: [1],
      slot: { ...slot, professional_id: null },
      professionalId: 12,
      form: { name: 'Ana', phone: '11912345678', email: '', cpf: '529.982.247-25' },
      source: 'link',
    })
    expect(p.customer).toEqual({ name: 'Ana', phone: '+5511912345678', cpf: '52998224725' })
    expect(p.professional_id).toBe(12)
  })

  it('qualquer profissional: professional_id null quando nem o slot nem a escolha trazem', () => {
    const p = buildBookingPayload({ serviceIds: [1], slot: { date: '2030-02-03', time: '09:00' }, form: { name: 'Ana', phone: '11912345678' }, source: 'link' })
    expect(p.professional_id).toBeNull()
  })
})

describe('buildLeadPayload', () => {
  it('inclui consent, source limpo e o token', () => {
    const p = buildLeadPayload({
      form: { name: ' Bia ', whatsapp: '(11) 91234-5678', email: '', segment: 'clinicas', message: ' oi ' },
      attribution: 'google_cpc',
      token: 'tok',
    })
    expect(p).toEqual({
      name: 'Bia',
      whatsapp: '+5511912345678',
      segment: 'clinicas',
      source: 'site:google_cpc',
      message: 'oi',
      consent: true,
      turnstile_token: 'tok',
    })
  })
  it('source nunca passa de 80 caracteres', () => {
    const p = buildLeadPayload({ form: { name: 'B', whatsapp: '11912345678', segment: 'x' }, attribution: 'a'.repeat(300), token: 't' })
    expect(p.source.length).toBeLessThanOrEqual(80)
    expect(p.source.startsWith('site:')).toBe(true)
  })
})

describe('availabilityQuery', () => {
  it('lista de serviços vira service_id=1,2', () => {
    expect(availabilityQuery({ serviceIds: [1, 2], professionalId: 5, from: 'a', to: 'b' })).toEqual({ service_id: '1,2', professional_id: 5, from: 'a', to: 'b' })
    expect(availabilityQuery({ serviceIds: [3], from: 'a', to: 'b' }).service_id).toBe('3')
  })
})

describe('parseSource', () => {
  it('aceita só os valores do contrato, lê source/src/utm_source e cai em link', () => {
    expect(parseSource({ source: 'qr' })).toBe('qr')
    expect(parseSource({ src: 'WhatsApp' })).toBe('whatsapp')
    expect(parseSource({ utm_source: 'instagram' })).toBe('instagram')
    expect(parseSource({ source: ['site', 'qr'] })).toBe('site')
    expect(parseSource({ source: 'facebook' })).toBe('link')
    expect(parseSource({})).toBe('link')
    expect(parseSource()).toBe('link')
  })
  it('source inválido não bloqueia um src válido', () => {
    expect(parseSource({ source: 'x', src: 'qr' })).toBe('qr')
  })
})

describe('leadSource', () => {
  it('site ou site:<atribuição> limpa', () => {
    expect(leadSource('')).toBe('site')
    expect(leadSource(undefined)).toBe('site')
    expect(leadSource('goo gle<>')).toBe('site:google')
  })
})

describe('cpf', () => {
  it('valida dígitos verificadores e rejeita sequências repetidas', () => {
    expect(isValidCpf('529.982.247-25')).toBe(true)
    expect(isValidCpf('52998224725')).toBe(true)
    expect(isValidCpf('529.982.247-24')).toBe(false)
    expect(isValidCpf('111.111.111-11')).toBe(false)
    expect(isValidCpf('123')).toBe(false)
  })
  it('máscara e dígitos', () => {
    expect(maskCpf('52998224725')).toBe('529.982.247-25')
    expect(maskCpf('5299')).toBe('529.9')
    expect(cpfDigits('529.982.247-25xx')).toBe('52998224725')
  })
})

describe('turnstileMode (nunca bypass silencioso)', () => {
  it('com site key usa o widget, mesmo em dev', () => {
    expect(turnstileMode({ siteKey: 'k', dev: true, devBypass: true })).toBe('widget')
    expect(turnstileMode({ siteKey: 'k', dev: false })).toBe('widget')
  })
  it('sem site key: bypass só em dev E com flag/mock explícito', () => {
    expect(turnstileMode({ dev: true, devBypass: true })).toBe('bypass')
    expect(turnstileMode({ dev: true, useMocks: true })).toBe('bypass')
    expect(turnstileMode({ dev: true })).toBe('unavailable')
  })
  it('em produção nunca há bypass, mesmo com as flags', () => {
    expect(turnstileMode({ dev: false, devBypass: true, useMocks: true })).toBe('unavailable')
    expect(turnstileMode({})).toBe('unavailable')
  })
  it('o token de bypass é um valor fixo e identificável', () => {
    expect(DEV_BYPASS_TOKEN).toBe('dev-bypass')
  })
})
