import { describe, expect, it } from 'vitest'
import { Jomini } from 'jomini'
import { patchIdeologyTypes, patchTechLinks, readIdeologyGroups } from '../src/shared/textPatch'

const BOM = 'ï»¿' // BOM UTF-8 leído como latin1
// Fixtures propios que imitan archivos del juego
const TECHS = `${BOM}# Tecnologías de prueba ñ
technologies = {
\tinfantry_a = {
\t\tresearch_cost = 1.5 # comentario
\t\tstart_year = 1936
\t\tfolder = { name = infantry_folder position = { x = 0 y = 0 } }
\t\tpath = {
\t\t\tleads_to_tech = infantry_b
\t\t\tresearch_cost_coeff = 1
\t\t}
\t\tcategories = { infantry_weapons }
\t}
\tinfantry_b = {
\t\tstart_year = 1939
\t\tfolder = { name = infantry_folder position = { x = 0 y = 2 } }
\t}
\tone_line = { start_year = 1940 }
}
`
const IDEO = `${BOM}ideologies = {
\tdemocratic = {
\t\ttypes = {
\t\t\tliberalism = {
\t\t\t\tcan_be_randomly_selected = no
\t\t\t}
\t\t}
\t\tcolor = { 0 0 255 }
\t}
\tneutrality = { types = { despotism = { } } }
}
`

describe('parche de tecnologías (S8)', () => {
  it('agrega un path al final del último path y es idempotente', async () => {
    const r = patchTechLinks(TECHS, [{ from: 'infantry_a', to: 'mi_tech' }])
    expect(r.errors).toEqual([])
    expect(r.text).toContain(
      '\t\t\tresearch_cost_coeff = 1\n\t\t}\n\t\tpath = { leads_to_tech = mi_tech research_cost_coeff = 1 }\n\t\tcategories'
    )
    // el resto idéntico: quitando lo insertado queda el original
    expect(
      r.text.replace('\n\t\tpath = { leads_to_tech = mi_tech research_cost_coeff = 1 }', '')
    ).toBe(TECHS)
    expect(patchTechLinks(r.text, [{ from: 'infantry_a', to: 'mi_tech' }]).text).toBe(r.text)
    const j = await Jomini.initialize()
    expect(() => j.parseText(Buffer.from(r.text, 'latin1'))).not.toThrow()
  })

  it('sin path previo y con tecnologías de una línea; CRLF', () => {
    const r = patchTechLinks(TECHS, [
      { from: 'infantry_b', to: 'x' },
      { from: 'one_line', to: 'y' }
    ])
    expect(r.errors).toEqual([])
    expect(r.text).toContain(
      'position = { x = 0 y = 2 } }\n\t\tpath = { leads_to_tech = x research_cost_coeff = 1 }'
    )
    expect(r.text).toContain(
      'one_line = { start_year = 1940 path = { leads_to_tech = y research_cost_coeff = 1 } }'
    )
    const crlf = TECHS.replace(/\n/g, '\r\n')
    const c = patchTechLinks(crlf, [{ from: 'infantry_b', to: 'x' }])
    expect(c.text.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/)
    expect(c.text).toContain('}\r\n\t\tpath = { leads_to_tech = x')
  })

  it('errores: tecnología inexistente o archivo ilegible no escriben nada', () => {
    expect(patchTechLinks(TECHS, [{ from: 'nope', to: 'x' }]).errors[0]).toMatch(
      /No se encontró la tecnología nope/
    )
    expect(patchTechLinks('technologies = { a = {', []).errors[0]).toMatch(/No se pudo leer/)
    expect(patchTechLinks('foo = { }', [{ from: 'a', to: 'b' }]).errors[0]).toMatch(/technologies/)
  })
})

describe('parche de ideologías (S8)', () => {
  it('agrega la subideología en su grupo y es idempotente', async () => {
    const r = patchIdeologyTypes(IDEO, [
      { group: 'democratic', id: 'mi_sub', lines: ['color = { 1 2 3 }'] }
    ])
    expect(r.errors).toEqual([])
    expect(r.text).toContain('\t\t\t}\n\t\t\tmi_sub = {\n\t\t\t\tcolor = { 1 2 3 }\n\t\t\t}\n\t\t}')
    expect(patchIdeologyTypes(r.text, [{ group: 'democratic', id: 'mi_sub' }]).text).toBe(r.text)
    const j = await Jomini.initialize()
    expect(() => j.parseText(Buffer.from(r.text, 'latin1'))).not.toThrow()
    expect(readIdeologyGroups(r.text)).toEqual([
      { group: 'democratic', types: ['liberalism', 'mi_sub'] },
      { group: 'neutrality', types: ['despotism'] }
    ])
  })

  it('types de una línea y grupo inexistente', () => {
    const r = patchIdeologyTypes(IDEO, [{ group: 'neutrality', id: 'otra' }])
    expect(r.text).toContain('types = { despotism = { } otra = { } }')
    expect(patchIdeologyTypes(IDEO, [{ group: 'zzz', id: 'a' }]).errors[0]).toMatch(/grupo zzz/)
    // los bytes no ASCII y el BOM se conservan
    expect(r.text.startsWith(BOM)).toBe(true)
  })
})
