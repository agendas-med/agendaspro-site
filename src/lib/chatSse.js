// Parser incremental de Server-Sent Events (POST com Bearer exige fetch + ReadableStream, não EventSource).
// Contrato do core: eventos `delta` {text} e um `done` com o JSON completo da resposta.

/**
 * Parser com estado: alimente com pedaços de texto (já decodificados) e receba eventos completos.
 * Trata \r\n, \n e \r, linhas de comentário (":"), `data:` em várias linhas e pedaços cortados no meio.
 */
export function createSseParser() {
  let buffer = ''
  let event = ''
  let data = []

  const dispatch = (out) => {
    if (data.length || event) out.push({ event: event || 'message', data: data.join('\n') })
    event = ''
    data = []
  }

  return {
    /** @param {string} chunk @returns {Array<{event:string, data:string}>} */
    feed(chunk) {
      buffer += String(chunk)
      const out = []
      // normaliza quebras e processa só linhas completas
      let idx
      for (;;) {
        idx = buffer.search(/\r\n|\n|\r/)
        if (idx === -1) break
        const sep = buffer.startsWith('\r\n', idx) ? 2 : 1
        // "\r" no fim do buffer pode ser o início de "\r\n": espera o próximo pedaço
        if (buffer[idx] === '\r' && idx + 1 === buffer.length) break
        const line = buffer.slice(0, idx)
        buffer = buffer.slice(idx + sep)
        if (line === '') {
          dispatch(out)
        } else if (line[0] === ':') {
          // comentário/keep-alive
        } else {
          const c = line.indexOf(':')
          const field = c === -1 ? line : line.slice(0, c)
          let value = c === -1 ? '' : line.slice(c + 1)
          if (value.startsWith(' ')) value = value.slice(1)
          if (field === 'event') event = value
          else if (field === 'data') data.push(value)
        }
      }
      return out
    },
    /** Fim do fluxo: descarrega um evento sem linha em branco final. */
    end() {
      const out = []
      if (buffer) {
        const rest = buffer
        buffer = ''
        out.push(...this.feed(`${rest}\n`))
      }
      dispatch(out)
      return out
    },
  }
}

/** JSON seguro de um `data:`; null se inválido. */
export function parseSseJson(data) {
  try {
    const v = JSON.parse(data)
    return v && typeof v === 'object' ? v : null
  } catch {
    return null
  }
}
