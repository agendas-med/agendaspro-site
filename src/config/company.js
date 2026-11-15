// Dados institucionais centralizados. Todos os placeholders [..] devem ser preenchidos pelo dono
// antes do lançamento (o build avisa quando ainda existem placeholders).
import { env } from './env.js'

export const PLACEHOLDER = '[PREENCHER]'

export const company = {
  brand: 'AgendasPro',
  legalName: '[RAZÃO SOCIAL]',
  cnpj: '[CNPJ]',
  address: '[ENDEREÇO]',
  dpoName: '[PREENCHER]',
  dpoEmail: '[EMAIL_DPO]',
  supportEmail: '[EMAIL_SUPORTE]',
  /** Número do WhatsApp comercial, só dígitos com DDI (ex.: 5511999999999). VITE_WHATSAPP_NUMBER sobrepõe. */
  whatsappNumber: env.whatsappNumber || '5500000000000',
  instagramUrl: '',
  linkedinUrl: '',
  lastLegalUpdate: '15 de novembro de 2026',
}

/** true enquanto algum campo institucional ainda é placeholder. */
export const hasPlaceholders = () =>
  Object.values(company).some((v) => typeof v === 'string' && /\[[A-ZÇÃ_ ]+\]/.test(v)) ||
  company.whatsappNumber === '5500000000000'

export const whatsappIsConfigured = () => company.whatsappNumber !== '5500000000000'

/** Monta o link wa.me com mensagem pré-preenchida (e utm opcional anexado ao texto). */
export function whatsappLink(message = '', utm = '') {
  const text = [message, utm && `(origem: ${utm})`].filter(Boolean).join(' ')
  const q = text ? `?text=${encodeURIComponent(text)}` : ''
  return `https://wa.me/${company.whatsappNumber}${q}`
}
