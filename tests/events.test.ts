import { describe, expect, it } from 'vitest'
import { Jomini } from 'jomini'
import * as Blockly from 'blockly'
import { registerAllBlocks } from '../src/renderer/src/blocks'
import {
  appendBlock,
  codeOfBlocks,
  generateArea,
  registerAreaBlocks
} from '../src/renderer/src/blocks/area'
import { emptyProjectFor } from '../src/renderer/src/templates'
import {
  createEvent,
  duplicateEvent,
  eventFiles,
  eventFromTemplate,
  eventGfx,
  eventLinks,
  eventLoc,
  eventId,
  updateEvent,
  validateEvents,
  EVENT_TEMPLATES
} from '../src/renderer/src/sections/events'
import { sectionFiles } from '../src/renderer/src/sections/generators'
import { plannedPaths } from '../src/renderer/src/export/exportMod'
import { validateProject } from '../src/renderer/src/export/validator'
import { store } from '../src/renderer/src/store/appStore'
import type { Project } from '../src/renderer/src/types'

registerAllBlocks()
registerAreaBlocks()
const base = (): Project => emptyProjectFor('Mi Mod', 'content')
const okOption = () => ({
  uid: 'o1',
  name: 'ok',
  trigger: { blocks: null, code: '' },
  effects: { blocks: null, code: '' },
  aiBase: 1
})
const withEvent = (over = {}): { p: Project; id: string; uid: string } => {
  const r = createEvent(base(), {
    title: 'Hola',
    description: 'Texto',
    options: [okOption()],
    ...over
  })
  return { p: r.project, id: eventId(r.event), uid: r.event.uid }
}
const block_ = (json: Record<string, unknown>) => json

describe('texto generado (sintaxis de la wiki)', () => {
  it('country_event con namespace, id, título, descripción, triggered only y opción', () => {
    const { p } = withEvent()
    const [f] = eventFiles(p)
    expect(f.path).toBe('events/mi_mod_mi_mod.txt')
    expect(f.text).toBe(
      'add_namespace = mi_mod\ncountry_event = {\n\tid = mi_mod.1\n\ttitle = mi_mod.1.t\n\tdesc = mi_mod.1.d\n\tis_triggered_only = yes\n\toption = {\n\t\tname = mi_mod.1.a\n\t\tai_chance = {\n\t\t\tbase = 1\n\t\t}\n\t}\n}\n'
    )
  })
  it('news_event lleva major y nunca fire_only_once; hidden sin título', () => {
    const r = createEvent(base(), {
      type: 'news_event',
      flags: {
        triggeredOnly: true,
        fireOnlyOnce: true,
        major: false,
        hidden: false,
        minorFlavor: false
      }
    })
    const t = eventFiles(r.project)[0].text!
    expect(t).toContain('news_event = {')
    expect(t).toContain('major = yes')
    expect(t).not.toContain('fire_only_once')
    const h = createEvent(base(), {
      flags: {
        triggeredOnly: true,
        fireOnlyOnce: false,
        major: false,
        hidden: true,
        minorFlavor: true
      }
    })
    const th = eventFiles(h.project)[0].text!
    expect(th).toContain('hidden = yes')
    expect(th).toContain('minor_flavor = yes')
    expect(th).not.toContain('title =')
  })
  it('automático: mean_time_to_happen y trigger con el tag del país; variantes de título', () => {
    const { p } = withEvent({
      countries: ['GER', 'ITA'],
      mtthDays: 30,
      timeoutDays: 5,
      flags: {
        triggeredOnly: false,
        fireOnlyOnce: true,
        major: false,
        hidden: false,
        minorFlavor: false
      },
      titleVariants: [{ text: 'Variante', trigger: { blocks: null, code: 'has_war = yes\n' } }]
    })
    const t = eventFiles(p)[0].text!
    expect(t).toContain('mean_time_to_happen = {\n\t\tdays = 30\n\t}')
    expect(t).toContain('trigger = {\n\t\tOR = {\n\t\t\ttag = GER\n\t\t\ttag = ITA')
    expect(t).toContain('timeout_days = 5')
    expect(t).toContain('title = {\n\t\ttext = mi_mod.1.t.v1\n\t\ttrigger = {\n\t\t\thas_war = yes')
    expect(t).toContain('\ttitle = mi_mod.1.t\n')
    expect(t).not.toContain('is_triggered_only')
  })
  it('sin comillas escapadas, parsea con jomini y la localización sale con BOM', async () => {
    const { p } = withEvent({ title: 'Él dijo "no"' })
    const files = [...eventFiles(p), ...eventLoc(p)]
    for (const f of files) expect(f.text).not.toContain('\\"')
    const jomini = await Jomini.initialize()
    const parsed = jomini.parseText(eventFiles(p)[0].text!) as { country_event: { id: string } }
    expect(parsed.country_event.id).toBe('mi_mod.1')
    const loc = eventLoc(p)[0]
    expect(loc.path).toBe('localisation/english/mi_mod_events_l_english.yml')
    expect(loc.bom).toBe(true)
    expect(loc.text).toContain(' mi_mod.1.t:0 "Él dijo ”no”"')
  })
  it('una imagen subida exporta sprite + ruta DDS; una del juego no exporta nada', () => {
    const { p, uid } = withEvent()
    const q = updateEvent(p, uid, {
      picture: { kind: 'upload', png: 'data:image/png;base64,AAAA', name: 'x' }
    })
    expect(eventGfx(q)[0].path).toBe('interface/mi_mod_events.gfx')
    expect(eventGfx(q)[0].text).toContain('texturefile = "gfx/event_pictures/mi_mod_mi_mod_1.dds"')
    expect(eventFiles(q)[0].text).toContain('picture = GFX_mi_mod_event_mi_mod_1')
    expect(plannedPaths(q)).toContain('gfx/event_pictures/mi_mod_mi_mod_1.dds')
    const g = updateEvent(p, uid, { picture: { kind: 'game', gfx: 'GFX_report_event_x' } })
    expect(eventGfx(g)).toEqual([])
    expect(eventFiles(g)[0].text).toContain('picture = GFX_report_event_x')
  })
  it('el generador de sección aporta sus archivos al exportador sin conflictos', () => {
    const { p } = withEvent()
    const r = sectionFiles(p)
    expect(r.issues).toEqual([])
    expect(r.files.map((f) => f.path)).toEqual([
      'events/mi_mod_mi_mod.txt',
      'localisation/english/mi_mod_events_l_english.yml'
    ])
  })
})

describe('bloque "Lanzar evento"', () => {
  const gen = (fields: Record<string, unknown>): string => {
    const ws = new Blockly.Workspace()
    Blockly.serialization.workspaces.load(
      {
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: 'area_root_effect_country',
              inputs: { BODY: { block: { type: 'eff_fire_event', fields } } }
            }
          ]
        }
      },
      ws
    )
    return generateArea(ws)
  }
  it('genera country_event con días y aleatorio, y con país destino', () => {
    expect(gen({ TYPE: 'country_event', EVENT: 'mi_mod.2', DAYS: 3, RANDOM: 2, TARGET: '' })).toBe(
      '\tcountry_event = { id = mi_mod.2 days = 3 random_days = 2 }\n'
    )
    expect(gen({ TYPE: 'news_event', EVENT: 'mi_mod.2', DAYS: 0, RANDOM: 0, TARGET: '' })).toBe(
      '\tnews_event = { id = mi_mod.2 }\n'
    )
    expect(
      gen({ TYPE: 'country_event', EVENT: 'mi_mod.2', DAYS: 1, RANDOM: 0, TARGET: 'ITA' })
    ).toBe('\tITA = {\n\t\tcountry_event = { id = mi_mod.2 days = 1 }\n\t}\n')
  })
  it('appendBlock agrega el efecto al final de la ranura y las cadenas se detectan', () => {
    const r = appendBlock(
      { blocks: null, code: '' },
      'effect',
      'country',
      block_({
        type: 'eff_fire_event',
        fields: { TYPE: 'country_event', EVENT: 'mi_mod.2', DAYS: 1, RANDOM: 0, TARGET: '' }
      })
    )
    expect(r.code).toBe('\tcountry_event = { id = mi_mod.2 days = 1 }\n')
    const r2 = appendBlock(
      r,
      'effect',
      'country',
      block_({ type: 'eff_add_stability', fields: { PERCENT: 5 } })
    )
    expect(codeOfBlocks(r2.blocks)).toBe(
      '\tcountry_event = { id = mi_mod.2 days = 1 }\n\tadd_stability = 0.05\n'
    )
    let p = createEvent(base(), { title: 'A' }).project
    const second = createEvent(p, { title: 'B' })
    p = second.project
    p = updateEvent(p, p.events[0].uid, {
      options: [{ ...p.events[0].options[0], name: 'x', effects: r }]
    })
    expect(eventLinks(p)).toEqual([{ from: p.events[0].uid, to: second.event.uid }])
  })
})

describe('validador', () => {
  const msgs = (p: Project): string =>
    validateEvents(p)
      .map((i) => i.message)
      .join(' | ')
  it('detecta cada error de la lista', () => {
    const flags = (o: object) => ({
      triggeredOnly: true,
      fireOnlyOnce: false,
      major: false,
      hidden: false,
      minorFlavor: false,
      ...o
    })
    const opt = (name = 'ok', code = '') => ({
      uid: 'o' + Math.random(),
      name,
      trigger: { blocks: null, code },
      effects: { blocks: null, code: '' },
      aiBase: 1
    })
    expect(msgs(withEvent({ namespace: 'Mal Nombre' }).p)).toMatch(/namespace/)
    expect(msgs(withEvent({ number: 100000 }).p)).toMatch(/entero entre 1 y 99999/)
    expect(msgs(withEvent({ number: 1.5 }).p)).toMatch(/entero entre 1 y 99999/)
    const dup = createEvent(withEvent().p, { number: 1, title: 'x' }) // newEvent evita repetir; forzamos
    expect(
      msgs({ ...dup.project, events: dup.project.events.map((e) => ({ ...e, number: 1 })) })
    ).toMatch(/ID repetido/)
    expect(msgs(withEvent({ type: 'news_event', flags: flags({ major: false }) }).p)).toMatch(
      /major/
    )
    expect(
      msgs(withEvent({ type: 'news_event', flags: flags({ major: true, fireOnlyOnce: true }) }).p)
    ).toMatch(/fire_only_once/)
    expect(msgs(withEvent({ flags: flags({ triggeredOnly: false }) }).p)).toMatch(/limita el país/)
    expect(
      msgs(withEvent({ flags: flags({ triggeredOnly: false }), countries: ['GER'] }).p)
    ).not.toMatch(/limita el país/)
    expect(msgs(withEvent({ mtthDays: 10 }).p)).toMatch(/is_triggered_only y mean_time_to_happen/)
    expect(msgs(withEvent({ options: [opt('a', 'has_war = yes\n')] }).p)).toMatch(/sin condición/)
    expect(msgs(withEvent({ title: '' }).p)).toMatch(/falta el título/)
    expect(msgs(withEvent({ options: [opt('')] }).p)).toMatch(/no tiene texto/)
    expect(msgs(withEvent({ picture: { kind: 'asset', assetId: 'nada' } }).p)).toMatch(/biblioteca/)
    const ev = withEvent().p
    const bad = updateEvent(ev, ev.events[0].uid, {
      immediate: { blocks: null, code: 'country_event = { id = mi_mod.9 }\n' }
    })
    expect(msgs(bad)).toMatch(/mi_mod.9, que no existe/)
    expect(validateEvents(withEvent().p)).toEqual([])
    expect(validateProject(bad).some((i) => i.kind === 'Eventos')).toBe(true)
  })
})

describe('plantillas, duplicar y pestañas', () => {
  it('las 3 plantillas son válidas; duplicar numera sin repetir', () => {
    for (const t of EVENT_TEMPLATES) {
      const e = eventFromTemplate(base(), t.id)
      const p = { ...base(), events: [e] }
      expect(
        validateEvents(p).filter((i) => i.severity === 'error'),
        t.id
      ).toEqual([])
    }
    const a = createEvent(base(), { title: 'A' })
    const d = duplicateEvent(a.project, a.event.uid)!
    expect(d.event.number).toBe(2)
    expect(d.project.events).toHaveLength(2)
    expect(d.event.options[0].uid).not.toBe(a.event.options[0].uid)
  })
  it('dos pestañas no comparten eventos', () => {
    const a = store.openInNewTab(base(), null, 'eventos')
    store.updateProject((p) => createEvent(p, { title: 'solo A' }).project)
    const b = store.openInNewTab(base(), null, 'eventos')
    expect(store.get().project!.events).toEqual([])
    store.switchTab(a)
    expect(store.get().project!.events).toHaveLength(1)
    store.switchTab(b)
  })
})
