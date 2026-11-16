import { describe, it, expect } from 'vitest'
import { createSseParser, parseSseJson } from './chatSse.js'

describe('createSseParser', () => {
  it('lê delta e done', () => {
    const p = createSseParser()
    const out = p.feed('event: delta\ndata: {"text":"Ol"}\n\nevent: delta\ndata: {"text":"á"}\n\nevent: done\ndata: {"reply":"Olá"}\n\n')
    expect(out.map((e) => e.event)).toEqual(['delta', 'delta', 'done'])
    expect(parseSseJson(out[2].data)).toEqual({ reply: 'Olá' })
  })
  it('junta pedaços cortados no meio de linha e entre CR e LF', () => {
    const p = createSseParser()
    const got = []
    for (const part of ['event: de', 'lta\r', '\ndata: {"te', 'xt":"a"}\r', '\n\r', '\n']) got.push(...p.feed(part))
    expect(got).toHaveLength(1)
    expect(got[0]).toEqual({ event: 'delta', data: '{"text":"a"}' })
  })
  it('ignora comentários/keep-alive e junta data em várias linhas', () => {
    const p = createSseParser()
    const out = p.feed(': ping\n\nevent: x\ndata: a\ndata: b\n\n')
    expect(out).toEqual([{ event: 'x', data: 'a\nb' }])
  })
  it('evento sem nome vira "message"; end() descarrega evento sem linha em branco final', () => {
    const p = createSseParser()
    expect(p.feed('data: 1\n\n')[0].event).toBe('message')
    p.feed('event: done\ndata: {"reply":"x"}')
    expect(p.end()).toEqual([{ event: 'done', data: '{"reply":"x"}' }])
  })
})

describe('parseSseJson', () => {
  it('JSON inválido ou não-objeto => null', () => {
    expect(parseSseJson('{oops')).toBeNull()
    expect(parseSseJson('42')).toBeNull()
    expect(parseSseJson('{"a":1}')).toEqual({ a: 1 })
  })
})
