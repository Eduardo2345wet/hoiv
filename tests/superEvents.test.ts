import { describe, expect, it } from 'vitest'
import { Jomini } from 'jomini'
import * as Blockly from 'blockly'
import { registerAllBlocks } from '../src/renderer/src/blocks'
import { generateArea } from '../src/renderer/src/blocks/area'
import { emptyProjectFor } from '../src/renderer/src/templates'
import {
  createSuperEvent,
  isPcmWav,
  superEventFiles,
  updateSuperEvent,
  validateSuperEvents
} from '../src/renderer/src/sections/superEvents'
import { sectionFiles } from '../src/renderer/src/sections/generators'
import { plannedPaths } from '../src/renderer/src/export/exportMod'
import { validateProject } from '../src/renderer/src/export/validator'
import type { Project } from '../src/renderer/src/types'

registerAllBlocks()
const base = (): Project => emptyProjectFor('Mi Mod', 'content')
const wav = (pcm = true): string => {
  const b = Buffer.alloc(44)
  b.write('RIFF', 0, 'latin1')
  b.writeUInt32LE(36, 4)
  b.write('WAVE', 8, 'latin1')
  b.write('fmt ', 12, 'latin1')
  b.writeUInt32LE(16, 16)
  b.writeUInt16LE(pcm ? 1 : 3, 20)
  return b.toString('base64')
}
const two = (): Project => {
  let p = createSuperEvent(base(), {
    title: 'Caída',
    quote: 'Di "adiós"',
    author: 'Alguien',
    image: { kind: 'upload', png: 'data:image/png;base64,AA', name: 'x' },
    sound: { name: 'a.wav', base64: wav() }
  }).project
  p = createSuperEvent(p, {
    title: 'Nuevo orden',
    image: { kind: 'upload', png: 'data:image/png;base64,AA', name: 'y' }
  }).project
  return p
}

describe('súper eventos', () => {
  it('genera efectos, GUI, gfx, scripted_gui, sonido y localización con rutas propias', () => {
    const files = superEventFiles(two())
    expect(files.map((f) => f.path)).toEqual([
      'common/scripted_effects/mi_mod_super_events.txt',
      'common/scripted_guis/mi_mod_super_events.txt',
      'interface/mi_mod_super_events.gui',
      'interface/mi_mod_super_events.gfx',
      'sound/mi_mod_super_events.asset',
      'sound/mi_mod_caida.wav',
      'localisation/english/mi_mod_super_events_l_english.yml'
    ])
    for (const f of files) if (f.text) expect(f.text).not.toContain('\\"')
    expect(sectionFiles(two()).issues).toEqual([])
  })
  it('todos los archivos de script se parsean con jomini', async () => {
    const jomini = await Jomini.initialize()
    for (const f of superEventFiles(two()).filter(
      (x) => x.text && /\.(txt|gui|gfx|asset)$/.test(x.path)
    ))
      expect(() => jomini.parseText(f.text!), f.path).not.toThrow()
  })
  it('el efecto es solo para humanos; la cola respeta el orden y sin cola reemplaza', () => {
    const p = two()
    const eff = superEventFiles(p)[0].text!
    expect(eff).toContain('mi_mod_caida_show = {')
    expect(eff).toContain('is_ai = no')
    expect(eff).toContain('set_country_flag = mi_mod_caida')
    const gui = superEventFiles(p)[1].text!
    // el segundo solo se ve si el primero no está abierto
    expect(gui).toMatch(
      /mi_mod_nuevo_orden_gui = \{[\s\S]*visible = \{\s*has_country_flag = mi_mod_nuevo_orden\s*NOT = \{\s*OR = \{\s*has_country_flag = mi_mod_caida/
    )
    const noQueue = updateSuperEvent(p, p.superEvents[1].uid, { queue: false })
    expect(superEventFiles(noQueue)[0].text).toContain('clr_country_flag = mi_mod_caida')
    const all = updateSuperEvent(p, p.superEvents[0].uid, { audience: 'all' })
    expect(superEventFiles(all)[0].text).toContain('every_country = {')
  })
  it('el bloque "Mostrar súper evento" genera <id>_show = yes', () => {
    const ws = new Blockly.Workspace()
    Blockly.serialization.workspaces.load(
      {
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: 'area_root_effect_country',
              inputs: {
                BODY: { block: { type: 'eff_show_super_event', fields: { SUPER: 'mi_mod_caida' } } }
              }
            }
          ]
        }
      },
      ws
    )
    expect(generateArea(ws)).toBe('\tmi_mod_caida_show = yes\n')
  })
  it('validador: imagen, sonido, ids y bloque que apunta a uno inexistente', () => {
    const p = two()
    expect(validateSuperEvents(p).filter((i) => i.severity === 'error')).toEqual([])
    const bad = updateSuperEvent(p, p.superEvents[0].uid, {
      image: null,
      sound: { name: 'x.wav', base64: wav(false) },
      title: ''
    })
    const m = validateSuperEvents(bad)
      .map((i) => i.message)
      .join('|')
    expect(m).toMatch(/falta la imagen/)
    expect(m).toMatch(/falta el título/)
    expect(m).toMatch(/WAV PCM/)
    expect(
      validateSuperEvents(p, ['\tmi_mod_fantasma_show = yes\n']).some((i) =>
        /no existe/.test(i.message)
      )
    ).toBe(true)
    expect(validateProject(bad).some((i) => i.kind === 'Súper eventos')).toBe(true)
    expect(isPcmWav(wav())).toBe(true)
    expect(isPcmWav(wav(false))).toBe(false)
    expect(plannedPaths(p)).toContain('gfx/super_events/mi_mod_caida.dds')
  })
})
