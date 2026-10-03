import { describe, expect, it } from 'vitest'
import { emptyProjectFor } from '../src/renderer/src/templates'
import { createEvent } from '../src/renderer/src/sections/events'
import { createDecision, createCategory } from '../src/renderer/src/sections/decisions'
import {
  isOgg,
  languageFiles,
  loadingFiles,
  missingKeys,
  musicFiles,
  newTrack,
  parseLoc,
  setLanguages,
  setTranslation,
  translatableEntries,
  validateExtras
} from '../src/renderer/src/sections/extras'
import { sectionFiles } from '../src/renderer/src/sections/generators'
import { buildExtraFiles, plannedPaths } from '../src/renderer/src/export/exportMod'
import { buildModFiles } from '../src/main/export'
import { createIdea } from '../src/renderer/src/ui/projectOps'
import type { Project } from '../src/renderer/src/types'

const ogg = (valid = true): string =>
  Buffer.from(valid ? 'OggS\u0000\u0002fakefake' : 'RIFFxxxxWAVE', 'latin1').toString('base64')
const PNG = 'data:image/png;base64,iVBORw0KGgo='

const base = (): Project => {
  let p = emptyProjectFor('Mi Mod', 'content')
  p = createEvent(p, { title: 'Hola', description: 'Mundo' }).project
  p = createCategory(p, { name: 'Política' }).project
  p = createDecision(p, { name: 'Comprar', description: 'Compra' }).project
  p = createIdea(p, 'Austeridad').project
  return setLanguages(p, ['spanish'])
}

describe('idiomas (S9)', () => {
  it('un .yml por idioma y por sección, con BOM y cabecera l_<idioma>', () => {
    const p = setTranslation(base(), 'spanish', 'mi_mod.1.t', 'Hola (es)')
    const files = sectionFiles(p).files.filter((f) => f.path.endsWith('.yml'))
    const es = files.filter((f) => f.path.startsWith('localisation/spanish/'))
    expect(es.map((f) => f.path).sort()).toEqual([
      'localisation/spanish/mi_mod_decisions_l_spanish.yml',
      'localisation/spanish/mi_mod_events_l_spanish.yml',
      'localisation/spanish/mi_mod_l_spanish.yml'
    ])
    for (const f of es) {
      expect(f.bom).toBe(true)
      expect(f.text!.startsWith('l_spanish:\n')).toBe(true)
    }
    const ev = es.find((f) => f.path.includes('events'))!.text!
    expect(ev).toContain('mi_mod.1.t:0 "Hola (es)"')
    // lo que no se tradujo cae al inglés
    expect(ev).toContain('mi_mod.1.d:0 "Mundo"')
    expect(files.some((f) => f.path.startsWith('localisation/english/'))).toBe(true)
    expect(files.some((f) => f.path.includes('l_english/'))).toBe(false)
  })

  it('focos y países también salen en cada idioma', () => {
    const p = base()
    const lf = languageFiles(p)
    expect(lf.map((f) => f.path)).toContain('localisation/spanish/mi_mod_l_spanish.yml')
    expect(lf.every((f) => f.bom && f.text!.startsWith('l_spanish:'))).toBe(true)
  })

  it('la tabla lista las claves, detecta las que faltan y quitar una traducción la devuelve a faltante', () => {
    let p = base()
    const keys = translatableEntries(p).map((e) => e.key)
    expect(keys).toContain('mi_mod.1.t')
    expect(keys).toContain('mi_mod_politica')
    expect(missingKeys(p, 'spanish')).toContain('mi_mod.1.t')
    p = setTranslation(p, 'spanish', 'mi_mod.1.t', 'x')
    expect(missingKeys(p, 'spanish')).not.toContain('mi_mod.1.t')
    p = setTranslation(p, 'spanish', 'mi_mod.1.t', '')
    expect(missingKeys(p, 'spanish')).toContain('mi_mod.1.t')
    expect(setLanguages(p, []).languages.map((l) => l.code)).toEqual(['english'])
    expect(parseLoc(' a:0 "x"\n b:1 "y z"\n')).toEqual([
      { key: 'a', english: 'x' },
      { key: 'b', english: 'y z' }
    ])
  })

  it('el validador avisa de los textos sin traducir', () => {
    expect(validateExtras(base()).some((i) => /sin traducir/.test(i.message))).toBe(true)
  })
})

describe('música (S9)', () => {
  const withMusic = (): Project => ({
    ...base(),
    music: [
      newTrack({ name: 'Marcha', ogg: { name: 'a.ogg', base64: ogg() }, weight: 3 }),
      newTrack({
        name: 'Calma',
        station: 'otra_estacion',
        ogg: { name: 'b.ogg', base64: ogg() },
        condition: { blocks: null, code: 'is_at_war = no\n' }
      })
    ]
  })

  it('usa nombres propios con el prefijo del mod y nunca music/music.asset', () => {
    const files = musicFiles(withMusic())
    const paths = files.map((f) => f.path)
    expect(paths).toContain('music/mi_mod_music.asset')
    expect(paths).toContain(
      'music/mi_mod_mi_mod_station_songs.txt'.replace('mi_mod_mi_mod', 'mi_mod_mi_mod')
    )
    expect(paths).toContain('music/mi_mod_marcha.ogg')
    expect(paths).not.toContain('music/music.asset')
    const asset = files.find((f) => f.path.endsWith('.asset'))!.text!
    expect(asset).toContain('name = "mi_mod_marcha"')
    expect(asset).toContain('file = "mi_mod_marcha.ogg"')
    const songs = files.find((f) => f.path.includes('otra_estacion'))!.text!
    expect(songs).toContain('music_station = "otra_estacion"')
    expect(songs).toContain('song = "mi_mod_calma"')
    expect(songs).toContain('is_at_war = no')
    expect(sectionFiles(withMusic()).issues).toEqual([])
  })

  it('valida el formato .ogg', () => {
    expect(isOgg(ogg())).toBe(true)
    expect(isOgg(ogg(false))).toBe(false)
    const p: Project = {
      ...base(),
      music: [newTrack({ name: 'X', ogg: { name: 'x.wav', base64: ogg(false) } })]
    }
    expect(
      validateExtras(p).some((i) => i.severity === 'error' && /ogg válido/.test(i.message))
    ).toBe(true)
  })
})

describe('pantallas de carga y portada (S9)', () => {
  it('pantallas: .dds propio, .gfx con prefijo y rutas planificadas', () => {
    const p: Project = {
      ...base(),
      loadingScreens: [{ uid: 'l1', name: 'Uno', image: null, upload: { name: 'a.png', png: PNG } }]
    }
    expect(loadingFiles(p)[0].path).toBe('interface/mi_mod_loadingscreens.gfx')
    expect(plannedPaths(p)).toContain('gfx/loadingscreens/mi_mod_loading_1.dds')
  })

  it('la portada exporta thumbnail.png y el descriptor lleva picture', async () => {
    const p: Project = { ...base(), cover: PNG }
    const files = await buildExtraFiles(p, async () => ({
      width: 1,
      height: 1,
      rgba: new Uint8Array(4)
    }))
    expect(files.find((f) => f.path === 'thumbnail.png')?.data?.length).toBeGreaterThan(0)
    const built = buildModFiles({
      exportPath: '/x',
      modName: 'Mi Mod',
      tag: 'AAA',
      focusTreeScript: '',
      locYaml: 'l_english:\n',
      files: files.map((f) => ({ path: f.path, text: f.text, data: f.data, bom: f.bom }))
    })
    if ('error' in built) throw new Error(built.error)
    expect(built.outerMod).toContain('picture="thumbnail.png"')
    expect(built.entries.some((e) => e.rel === 'thumbnail.png')).toBe(true)
    // sin portada, el descriptor no lleva picture
    const none = buildModFiles({
      exportPath: '/x',
      modName: 'Mi Mod',
      tag: 'AAA',
      focusTreeScript: '',
      locYaml: 'l_english:\n'
    })
    if ('error' in none) throw new Error(none.error)
    expect(none.outerMod).not.toContain('picture=')
  })
})
