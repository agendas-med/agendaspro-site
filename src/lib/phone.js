// Máscara e validação de telefone/WhatsApp brasileiro.
const VALID_DDD = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43, 44,
  45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77, 79, 81,
  82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
])

export const onlyDigits = (v) => String(v ?? '').replace(/\D/g, '')

/** Remove o DDI 55 quando o número foi colado com ele (mais de 11 dígitos). */
export function nationalDigits(value) {
  let d = onlyDigits(value)
  if (d.length > 11 && d.startsWith('55')) d = d.slice(2)
  return d.slice(0, 11)
}

/** (11) 91234-5678 / (11) 1234-5678 — formata enquanto digita. */
export function maskPhoneBR(value) {
  const d = nationalDigits(value)
  if (d.length === 0) return ''
  if (d.length <= 2) return `(${d}`
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
}

/**
 * Celular com WhatsApp: DDD válido + 9 dígitos começando em 9 (11 dígitos),
 * ou 10 dígitos com o 3º dígito 6-9 (formato antigo de celular).
 */
export function isValidWhatsappBR(value) {
  const d = nationalDigits(value)
  if (d.length !== 10 && d.length !== 11) return false
  if (!VALID_DDD.has(Number(d.slice(0, 2)))) return false
  const first = d[2]
  if (d.length === 11) return first === '9'
  return ['6', '7', '8', '9'].includes(first)
}

/** E.164 (+55DDDNNNNNNNNN) a partir de um valor mascarado ou colado. */
export function toE164BR(value) {
  return `+55${nationalDigits(value)}`
}
