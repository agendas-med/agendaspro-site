import { describe, it, expect } from 'vitest'
import { maskPhoneBR, isValidWhatsappBR, nationalDigits, toE164BR, onlyDigits } from './phone.js'

describe('maskPhoneBR', () => {
  it('formata progressivamente enquanto digita', () => {
    expect(maskPhoneBR('')).toBe('')
    expect(maskPhoneBR('1')).toBe('(1')
    expect(maskPhoneBR('11')).toBe('(11')
    expect(maskPhoneBR('119')).toBe('(11) 9')
    expect(maskPhoneBR('1191234')).toBe('(11) 9123-4')
    expect(maskPhoneBR('11912345678')).toBe('(11) 91234-5678')
  })
  it('formata número fixo/antigo de 10 dígitos', () => {
    expect(maskPhoneBR('1132345678')).toBe('(11) 3234-5678')
  })
  it('ignora letras e símbolos e limita a 11 dígitos', () => {
    expect(maskPhoneBR('(11) 9abc1234-5678999')).toBe('(11) 91234-5678')
  })
  it('remove o DDI 55 quando colado', () => {
    expect(maskPhoneBR('+55 11 91234-5678')).toBe('(11) 91234-5678')
    expect(nationalDigits('5511912345678')).toBe('11912345678')
  })
})

describe('isValidWhatsappBR', () => {
  it('aceita celular com 11 dígitos e 9 inicial', () => {
    expect(isValidWhatsappBR('(11) 91234-5678')).toBe(true)
    expect(isValidWhatsappBR('21987654321')).toBe(true)
    expect(isValidWhatsappBR('+55 (85) 99999-0000')).toBe(true)
  })
  it('aceita formato antigo de 10 dígitos iniciado em 6-9', () => {
    expect(isValidWhatsappBR('(11) 9123-4567')).toBe(true)
  })
  it('rejeita fixo, DDD inexistente, tamanho errado e vazio', () => {
    expect(isValidWhatsappBR('(11) 3234-5678')).toBe(false)
    expect(isValidWhatsappBR('(10) 91234-5678')).toBe(false)
    expect(isValidWhatsappBR('(20) 91234-5678')).toBe(false)
    expect(isValidWhatsappBR('(11) 81234-5678')).toBe(false)
    expect(isValidWhatsappBR('1191234')).toBe(false)
    expect(isValidWhatsappBR('')).toBe(false)
    expect(isValidWhatsappBR(null)).toBe(false)
  })
})

describe('toE164BR / onlyDigits', () => {
  it('normaliza para E.164', () => {
    expect(toE164BR('(11) 91234-5678')).toBe('+5511912345678')
    expect(toE164BR('5511912345678')).toBe('+5511912345678')
  })
  it('onlyDigits tolera valores nulos', () => {
    expect(onlyDigits(undefined)).toBe('')
    expect(onlyDigits('a1b2')).toBe('12')
  })
})
