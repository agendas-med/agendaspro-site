// CPF opcional (o Asaas pode exigir o CPF do pagador no Pix). Só validação de dígitos verificadores.
export const cpfDigits = (v) => String(v ?? '').replace(/\D/g, '').slice(0, 11)

export function maskCpf(v) {
  const d = cpfDigits(v)
  if (d.length <= 3) return d
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`
}

export function isValidCpf(v) {
  const d = cpfDigits(v)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const dv = (len) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(d[i]) * (len + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10])
}
