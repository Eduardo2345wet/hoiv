import { describe, expect, it } from 'vitest'
import { Jomini } from 'jomini'
import { emptyProjectFor } from '../src/renderer/src/templates'
import { addCountry, newCountry, newLeader } from '../src/renderer/src/countries/countryOps'
import {
  characterFiles,
  createCharacter,
  leadersToCharacters,
  updateCharacter,
  validateCharacters
} from '../src/renderer/src/sections/characters'
import { sectionFiles } from '../src/renderer/src/sections/generators'
import { countryTextFiles } from '../src/renderer/src/export/countryExport'
import { patchHistory } from '../src/renderer/src/countries/history'
import { historyExtras } from '../src/renderer/src/sections/historyExtras'
import { parseTraits } from '../src/shared/gameTraits'
import { pathProblems } from '../src/shared/exportPaths'
import type { Project } from '../src/renderer/src/types'

const base = (): Project => {
  let p = emptyProjectFor('Mi Mod', 'content')
  const c = newCountry({ mode: 'nuevo', tag: 'NVG', name: 'Nueva' })
  p = addCountry(p, c)
  return p
}
const withChars = (): Project => {
  let p = base()
  p = createCharacter(p, {
    name: 'Ana Gómez',
    country: 'NVG',
    roles: ['advisor'],
    advisor: {
      slot: 'political_advisor',
      ideaToken: 'NVG_ana_advisor',
      cost: 150,
      traits: ['backroom_backstabber'],
      allowed: { blocks: null, code: '' },
      canBeFired: true
    }
  }).project
  p = createCharacter(p, {
    name: 'Luis Soto',
    country: 'NVG',
    roles: ['field_marshal'],
    army: { skill: 4, attack: 3, defense: 3, planning: 2, logistics: 2, traits: ['organizer'] },
    portraits: { civilian: null, army: 'data:image/png;base64,AA', navy: null }
  }).project
  p = createCharacter(p, {
    name: 'Mar Díaz',
    country: 'NVG',
    roles: ['navy_leader'],
    navy: { skill: 3, attack: 2, defense: 2, maneuvering: 3, coordination: 2, traits: [] }
  }).project
  return p
}

describe('personajes (S4)', () => {
  it('genera cada rol con la sintaxis de la wiki, en un archivo con prefijo del mod', async () => {
    const f = characterFiles(withChars())
    expect(f.map((x) => x.path)).toContain('common/characters/mi_mod_NVG_characters.txt')
    const t = f.find((x) => x.path.endsWith('_characters.txt'))!.text!
    await expect(Jomini.initialize().then((j) => j.parseText(t))).resolves.toBeTruthy()
    expect(t).toContain('slot = political_advisor')
    expect(t).toContain('idea_token = NVG_ana_advisor')
    expect(t).toContain('cost = 150')
    expect(t).toContain('traits = { backroom_backstabber }')
    expect(t).toContain('field_marshal = {')
    expect(t).toContain('attack_skill = 3')
    expect(t).toContain('legacy_id = -1')
    expect(t).toContain('navy_leader = {')
    expect(t).toContain('maneuvering_skill = 3')
    expect(t).toContain('coordination_skill = 2')
    expect(t).toContain('army = {\n\t\t\t\tlarge = GFX_NVG_luis_soto_army')
    expect(pathProblems('common/characters/mi_mod_NVG_characters.txt')).toEqual([])
    expect(f.some((x) => /common\/characters\/[A-Z]{3}\.txt$/.test(x.path))).toBe(false)
  })

  it('la localización lleva el nombre y el idea_token del consejero', () => {
    const loc = sectionFiles(withChars()).files.find((x) =>
      x.path.includes('characters_l_english')
    )!
    expect(loc.bom).toBe(true)
    expect(loc.text).toContain('NVG_ana_gomez:0 "Ana Gómez"')
    expect(loc.text).toContain('NVG_ana_advisor:0 "Ana Gómez"')
  })

  it('recruit_character va en la historia de un país nuevo, antes de set_politics', () => {
    const p = withChars()
    const h = countryTextFiles(p).find((f) => f.path.startsWith('history/countries/'))!.text!
    expect(h).toContain('recruit_character = NVG_ana_gomez')
    expect(h.indexOf('recruit_character = NVG_ana_gomez')).toBeLessThan(h.indexOf('set_politics'))
  })

  it('en un país del juego solo se parchea su historia real (nombre exacto) y no se pisa common/characters/<TAG>.txt', () => {
    let p = emptyProjectFor('Mi Mod', 'content')
    const c = newCountry({ mode: 'existente', tag: 'MEX', name: 'México' })
    c.existing = {
      renameInGame: false,
      historyFile: 'MEX - Mexico.txt',
      historyText:
        'capital = 111\r\n# comentario\r\nset_politics = {\n\truling_party = neutrality\n}\nset_popularities = {\n\tneutrality = 100\n}\n',
      historyEdited: false
    }
    p = addCountry(p, c)
    p = createCharacter(p, { name: 'Gral', country: 'MEX', roles: ['corps_commander'] }).project
    const files = countryTextFiles(p)
    const hist = files.find((f) => f.path === 'history/countries/MEX - Mexico.txt')!
    expect(hist.text).toContain('recruit_character = MEX_gral')
    expect(hist.text).toContain('# comentario')
    expect(files.some((f) => f.path === 'common/characters/MEX.txt')).toBe(false)
    expect(
      sectionFiles(p).files.some((f) => f.path === 'common/characters/mi_mod_MEX_characters.txt')
    ).toBe(true)
  })

  it('sin historia editable se recluta con on_actions', () => {
    let p = emptyProjectFor('Mi Mod', 'content')
    p = createCharacter(p, { name: 'X', country: 'GER', roles: ['advisor'] }).project
    const oa = sectionFiles(p).files.find(
      (f) => f.path === 'common/on_actions/mi_mod_characters.txt'
    )!
    expect(oa.text).toContain('GER = {')
    expect(oa.text).toContain('recruit_character = GER_x')
    expect(validateCharacters(p).some((i) => /on_actions/.test(i.message))).toBe(true)
  })

  it('migra los líderes del asistente a personajes sin exportarlos dos veces', () => {
    let p = base()
    const c = p.countries[0]
    const l = newLeader('Juan Pérez', 'neutrality')
    p = { ...p, countries: [{ ...c, leaders: [l] }] }
    const m = leadersToCharacters(p)
    expect(m.countries[0].leaders).toEqual([])
    expect(m.characters).toHaveLength(1)
    expect(m.characters[0].id).toBe(`NVG_${l.id}`)
    expect(m.characters[0].roles).toEqual(['country_leader'])
    expect(countryTextFiles(m).some((f) => f.path.includes('_characters.txt'))).toBe(false)
    expect(characterFiles(m)[0].text).toContain('country_leader = {')
    expect(leadersToCharacters(m).characters).toHaveLength(1)
  })

  it('validador: IDs, idea_token, país, rasgos, habilidades y retrato', () => {
    let p = withChars()
    const [a, b] = p.characters
    p = updateCharacter(p, b.uid, { id: a.id })
    p = updateCharacter(p, p.characters[2].uid, {
      country: '',
      navy: { skill: 11, attack: 0, defense: 2, maneuvering: 3, coordination: 2, traits: ['zzz'] }
    })
    const game = {
      leaderTraits: [{ id: 'backroom_backstabber', slot: 'political_advisor' }],
      unitTraits: [{ id: 'organizer' }]
    }
    const m = validateCharacters(p, game as never).map((i) => i.message)
    expect(m.some((x) => /ID repetido/.test(x))).toBe(true)
    expect(m.some((x) => /elige su país/.test(x))).toBe(true)
    expect(m.some((x) => /fuera de 1–10/.test(x))).toBe(true)
    expect(m.some((x) => /rasgo zzz no existe/.test(x))).toBe(true)
    expect(m.some((x) => /sin retrato/.test(x))).toBe(true)
    const q = createCharacter(withChars(), {
      name: 'Dup',
      country: 'NVG',
      roles: ['advisor'],
      advisor: { ...withChars().characters[0].advisor }
    }).project
    expect(validateCharacters(q).some((i) => /idea_token repetido/.test(i.message))).toBe(true)
  })

  it('lee los rasgos reales del juego con su ranura', () => {
    const t = parseTraits(`leader_traits = {
  # comentario { }
  backroom_backstabber = { slot = political_advisor cost = 1 modifier = { x = 1 } }
  organizer = { type = corps_commander }
  head_of_state_x = { random = no }
}
leader_traits = { organizer = { } }`)
    expect(t).toEqual([
      { id: 'backroom_backstabber', slot: 'political_advisor' },
      { id: 'organizer', type: 'corps_commander' },
      { id: 'head_of_state_x' }
    ])
  })

  it('el parche de historia es idempotente con extras', () => {
    const p = withChars()
    const orig =
      'capital = 1\nset_politics = {\n\truling_party = neutrality\n}\nset_popularities = {\n\tneutrality = 100\n}\n'
    const e = historyExtras(p, p.countries[0])
    const once = patchHistory(orig, p.countries[0], e)
    expect(patchHistory(orig, p.countries[0], e)).toBe(once)
  })
})
