// Bloques con fecha reales (HOI4 1.19.3): if / TAG = { transfer_state } dentro de 1938.10.25 = { … }
import { describe, expect, it } from 'vitest'
import { Jomini } from 'jomini'
import { patchStateText } from '../src/shared/map/statePatch'
import { statesFromParsed } from '../src/shared/map/stateFile'
import { DATED_KEYS_TO_STRIP } from '../src/renderer/src/map/noNation'

// Fixture propio que imita la estructura real (no es un archivo del juego)
const FILE = `state = {
\tid = 594
\tname = "STATE_594"
\tprovinces = { 1 2 3 }
\thistory = {
\t\towner = CHI
\t\tadd_core_of = CHI
\t\tvictory_points = { 1 5 }
\t\t1938.10.25 = {
\t\t\tif = {
\t\t\t\tlimit = { NOT = { has_dlc = "Waking the Tiger" } }
\t\t\t\tremove_core_of = GXC
\t\t\t\tCHI = {
\t\t\t\t\ttransfer_state = PREV
\t\t\t\t}
\t\t\t}
\t\t}
\t\t1939.1.1 = {
\t\t\tcontroller = JAP
\t\t\tadd_core_of = JAP
\t\t\tbuildings = { infrastructure = 2 }
\t\t}
\t}
}
`

const strip = (text: string, owner = 'NVG'): string => {
  const r = patchStateText(text, [{ id: 594, owner, cores: [], stripDated: DATED_KEYS_TO_STRIP }])
  expect(r.errors).toEqual([])
  return r.text
}
const balanced = (t: string): boolean =>
  (t.match(/\{/g) ?? []).length === (t.match(/\}/g) ?? []).length

describe('Sin nación: bloques con fecha reales', () => {
  it('quita transfer_state (con su TAG = { }), remove_core_of, controller y add_core_of; if vacío fuera', () => {
    const out = strip(FILE)
    expect(out).not.toContain('transfer_state')
    expect(out).not.toContain('remove_core_of')
    expect(out).not.toContain('controller = JAP')
    expect(out).not.toContain('add_core_of = JAP')
    expect(out).not.toContain('if = {') // quedó vacío (solo limit)
    expect(out).not.toContain('CHI = {')
    expect(balanced(out)).toBe(true)
    // lo demás sigue igual: edificios, victory points, el bloque con fecha vacío…
    expect(out).toContain('buildings = { infrastructure = 2 }')
    expect(out).toContain('victory_points = { 1 5 }')
    expect(out).toContain('1939.1.1 = {')
    expect(out).toContain('owner = NVG')
  })
  it('el resto del archivo queda idéntico byte por byte', () => {
    const out = strip(FILE, 'CHI') // mismo dueño; sin cores pedidos: se va el add_core_of de arriba
    expect(out).toBe(
      [
        'state = {',
        '\tid = 594',
        '\tname = "STATE_594"',
        '\tprovinces = { 1 2 3 }',
        '\thistory = {',
        '\t\towner = CHI',
        '\t\tvictory_points = { 1 5 }',
        '\t\t1938.10.25 = {',
        '\t\t}',
        '\t\t1939.1.1 = {',
        '\t\t\tbuildings = { infrastructure = 2 }',
        '\t\t}',
        '\t}',
        '}',
        ''
      ].join('\n')
    )
  })
  it('CRLF y estructuras if / TAG sueltos también', () => {
    const crlf = FILE.replace(/\n/g, '\r\n')
    const out = strip(crlf)
    expect(out).not.toContain('transfer_state')
    expect(out.includes('\r\n')).toBe(true)
    expect(out.replace(/\r\n/g, '')).not.toMatch(/[^\r]\n/)
    expect(balanced(out)).toBe(true)
    const direct = FILE.replace(
      /\t\t1938[\s\S]*?\n\t\t}\n(?=\t\t1939)/,
      '\t\t1938.10.25 = {\n\t\t\tCHI = { transfer_state = PREV }\n\t\t\towner = GER\n\t\t}\n'
    )
    const o2 = strip(direct)
    expect(o2).not.toContain('transfer_state')
    expect(o2).not.toContain('owner = GER')
    expect(balanced(o2)).toBe(true)
  })
  it('un if con otras cosas además del cambio conserva lo demás', () => {
    const keep = FILE.replace(
      '\t\t\t\tremove_core_of = GXC\n',
      '\t\t\t\tremove_core_of = GXC\n\t\t\t\tadd_stability = 1\n'
    )
    const out = strip(keep)
    expect(out).toContain('add_stability = 1')
    expect(out).toContain('limit = { NOT = { has_dlc = "Waking the Tiger" } }')
    expect(out).not.toContain('remove_core_of')
    expect(out).not.toContain('transfer_state')
    expect(balanced(out)).toBe(true)
  })
})

describe('aviso de cambios con fecha (modo normal)', () => {
  it('detecta transfer_state dentro de un if dentro del bloque con fecha', async () => {
    const parser = await Jomini.initialize()
    const states = statesFromParsed(parser.parseText(FILE), 'x.txt')
    expect(states[0].hasDatedChanges).toBe(true)
    const none = FILE.replace(/\t\t1938[\s\S]*?\n\t\t}\n(?=\t\t1939)/, '').replace(
      /\t\t1939[\s\S]*?\n\t\t}\n/,
      '\t\t1939.1.1 = {\n\t\t\tbuildings = { infrastructure = 2 }\n\t\t}\n'
    )
    expect(statesFromParsed(parser.parseText(none), 'x.txt')[0].hasDatedChanges).toBe(false)
  })
})
