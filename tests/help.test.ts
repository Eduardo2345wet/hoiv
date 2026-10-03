// Ayuda "?": solo existe en los conceptos difíciles de la lista (todos los textos en un archivo) y cada
// uno de esos conceptos tiene su "?" en alguna pantalla.
import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { HELP } from '../src/renderer/src/ui/helpTexts'

const ROOT = path.join(__dirname, '..', 'src', 'renderer', 'src')
function files(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) files(p, out)
    else if (/\.(ts|tsx)$/.test(e.name) && e.name !== 'helpTexts.ts') out.push(p)
  }
  return out
}

/** Conceptos que llevan "?" (la lista pedida, más los que se agreguen aquí a propósito) */
const CONCEPTS = [
  'evento.grupo',
  'evento.activacion',
  'evento.unaVez',
  'evento.noticia',
  'evento.oculto',
  'evento.tiempoPromedio',
  'evento.tiempoResponder',
  'super.que',
  'super.sonido',
  'decision.categoria',
  'decision.mision',
  'decision.contraPaises',
  'decision.sobreEstados',
  'decision.costoPP',
  'pais.banderasIdeologia',
  'pais.articulo',
  'pais.tag',
  'mapa.cores',
  'mapa.sinNacion',
  'mapa.capital',
  'foco.saltarSi',
  'foco.excluyente',
  'foco.prerrequisito',
  'espiritu.modificadores',
  'espiritu.copiarJuego',
  'ejercito.plantilla',
  'ejercito.linea',
  'ejercito.apoyo',
  'tech.subideologia',
  'tech.modoAvanzado'
]

describe('ayuda "?"', () => {
  it('solo hay textos de ayuda para los conceptos de la lista, y todos en un solo archivo', () => {
    expect(Object.keys(HELP).sort()).toEqual([...CONCEPTS].sort())
  })

  it('cada texto tiene qué es y, además, un ejemplo o cómo se ve en el juego', () => {
    for (const [id, h] of Object.entries(HELP)) {
      expect(h.title.length, id).toBeGreaterThan(0)
      expect(h.what.length, id).toBeGreaterThan(10)
      expect(!!(h.example || h.ingame), id).toBe(true)
    }
  })

  it('cada "?" de la interfaz apunta a un texto que existe y cada texto se usa en alguna pantalla', () => {
    const all = files(ROOT).map((f) => ({ f, text: fs.readFileSync(f, 'utf-8') }))
    // "?" escritos con el id a la vista: <Help id="x.y" />, helpId="x.y", help="x.y"
    const bad: string[] = []
    const re = /(?:<Help\s+id=|helpId=|groupHelp:\s*)\s*["'{]\s*["']?([A-Za-z]+\.[A-Za-z]+)["']/g
    for (const { f, text } of all)
      for (const m of text.matchAll(re))
        if (!HELP[m[1]]) bad.push(`${path.relative(ROOT, f)}: ${m[1]}`)
    expect(bad).toEqual([])
    // cada concepto aparece (entre comillas) en alguna pantalla
    const unused = CONCEPTS.filter(
      (c) => !all.some(({ text }) => text.includes(`'${c}'`) || text.includes(`"${c}"`))
    )
    expect(unused).toEqual([])
  })
})
