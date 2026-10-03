// Estilo general: sin emojis en la interfaz (salvo el contenido que elige el usuario), sin nombres
// de código ni en inglés en las etiquetas y sin notas "(automático)".
import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

const ROOT = path.join(__dirname, '..', 'src', 'renderer', 'src')
function files(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) files(p, out)
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p)
  }
  return out
}
const rel = (p: string): string => path.relative(ROOT, p).replace(/\\/g, '/')
// Contenido del usuario: el catálogo de emojis que se ofrece como ícono de focos y espíritus
const USER_CONTENT = new Set(['icons/emojiData.ts'])
const lines = (p: string): string[] => fs.readFileSync(p, 'utf-8').split('\n')

describe('estilo general', () => {
  it('no quedan emojis en los textos de la interfaz (salvo el contenido del usuario)', () => {
    const bad: string[] = []
    for (const f of files(ROOT))
      if (!USER_CONTENT.has(rel(f)))
        lines(f).forEach((l, i) => {
          if (/\p{Extended_Pictographic}/u.test(l))
            bad.push(`${rel(f)}:${i + 1}: ${l.trim().slice(0, 80)}`)
        })
    expect(bad).toEqual([])
  })

  it('no hay notas "(automático)" en los campos', () => {
    const bad: string[] = []
    for (const f of files(ROOT))
      lines(f).forEach((l, i) => {
        if (/\(autom[aá]tic[oa]\)/.test(l)) bad.push(`${rel(f)}:${i + 1}: ${l.trim().slice(0, 80)}`)
      })
    expect(bad).toEqual([])
  })

  it('las etiquetas visibles no llevan nombres de código (snake_case) ni "(xxx_factor)"', () => {
    const bad: string[] = []
    // etiquetas de campos y títulos en JSX: label="…", help="…", title="…"
    const attr = /\b(label|help|title|placeholder)="([^"]*)"/g
    for (const f of files(ROOT))
      lines(f).forEach((l, i) => {
        for (const m of l.matchAll(attr))
          if (/\b[a-z]+_[a-z0-9_]+\b/.test(m[2]))
            bad.push(`${rel(f)}:${i + 1}: ${m[0].slice(0, 80)}`)
        // etiquetas de listas: { value: 'x', label: 'Texto' }
        for (const m of l.matchAll(/\blabel:\s*'([^']*)'/g))
          if (/\b[a-z]+_[a-z0-9_]+\b/.test(m[1]))
            bad.push(`${rel(f)}:${i + 1}: label: '${m[1].slice(0, 70)}'`)
      })
    expect(bad).toEqual([])
  })

  it('los bloques de Blockly no llevan nombres de código entre paréntesis ni emojis', () => {
    const bad: string[] = []
    for (const f of files(path.join(ROOT, 'blocks')))
      lines(f).forEach((l, i) => {
        const m = /(message\d*|tooltip|name|label):\s*'([^']*)'/.exec(l)
        if (m && /\(([a-z]+_[a-z0-9_]+|available|bypass)\)/.test(m[2]))
          bad.push(`${rel(f)}:${i + 1}: ${m[2].slice(0, 80)}`)
      })
    expect(bad).toEqual([])
  })
})
