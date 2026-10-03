import { describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { Jomini } from 'jomini'
import { codeOf, find, parseYml, restCode, scan } from '../src/shared/modScan'
import { importMod, type ImportFile } from '../src/renderer/src/sections/importMod'
import { emptyProjectFor } from '../src/renderer/src/templates'
import { eventFiles } from '../src/renderer/src/sections/events'
import { decisionFiles } from '../src/renderer/src/sections/decisions'
import { generateFocusTree } from '../src/renderer/src/generator/focusTree'
import { generateIdeas } from '../src/renderer/src/generator/ideas'
import { readModFolder } from '../src/main/modReader'

// Mod de ejemplo PROPIO (no es de nadie)
const FILES: ImportFile[] = [
  {
    path: 'localisation/english/ejemplo_l_english.yml',
    text: `﻿l_english:
 ej.1.t:0 "Un titular"
 ej.1.d:0 "Pasó \\"algo\\""
 ej.1.a:0 "Aceptar"
 ej_arbol:0 "Árbol de ejemplo"
 ej_foco_a:0 "Foco A"
 ej_foco_a_desc:0 "Descripción A"
 ej_cat:0 "Mi categoría"
 ej_cat_desc:0 "Describe"
 ej_dec:0 "Mi decisión"
 ej_mision:0 "Mi misión"
 ej_espiritu:0 "Espíritu de ejemplo"
 ej_espiritu_desc:0 "Un espíritu"
`
  },
  {
    path: 'common/national_focus/ej.txt',
    text: `focus_tree = {
\tid = ej_arbol
\tcountry = { factor = 0 modifier = { add = 10 tag = EJE } }
\tdefault = no
\tfocus = {
\t\tid = ej_foco_a
\t\ticon = GFX_goal_generic_construct_infrastructure # comentario
\t\tx = 2
\t\ty = 0
\t\tcost = 5
\t\tavailable = { has_war = no }
\t\tsearch_filters = { FOCUS_FILTER_POLITICAL }
\t\tcompletion_reward = {
\t\t\tadd_political_power = 50
\t\t}
\t}
\tfocus = {
\t\tid = ej_foco_b
\t\ticon = GFX_goal_unknown
\t\tprerequisite = { focus = ej_foco_a focus = ej_foco_x }
\t\tmutually_exclusive = { focus = ej_foco_c }
\t\trelative_position_id = ej_foco_a
\t\tx = 1
\t\ty = 1
\t\tcost = 10
\t\tcompletion_reward = { add_stability = 0.05 }
\t}
\tfocus = { id = ej_foco_c x = 0 y = 3 completion_reward = { } }
}
`
  },
  {
    path: 'events/ej.txt',
    text: `add_namespace = ej
country_event = {
\tid = ej.1
\ttitle = ej.1.t
\tdesc = ej.1.d
\tpicture = GFX_report_event_generic
\tis_triggered_only = yes
\tgoto = 1234
\timmediate = { add_political_power = 10 }
\toption = {
\t\tname = ej.1.a
\t\tai_chance = { base = 3 }
\t\tadd_stability = 0.01
\t\tcountry_event = { id = ej.2 days = 3 }
\t}
}
country_event = { id = ej.2 hidden = yes is_triggered_only = yes option = { name = ej.2.a } }
`
  },
  {
    path: 'common/decisions/categories/ej_cat.txt',
    text: `ej_cat = { icon = generic_ally priority = 5 visible_when_empty = yes }\n`
  },
  {
    path: 'common/decisions/ej.txt',
    text: `ej_cat = {
\tej_dec = {
\t\ticon = generic_form_nation
\t\tallowed = { original_tag = EJE }
\t\tcost = 25
\t\tdays_re_enable = 10
\t\tavailable = { has_stability > 0.5 }
\t\tcomplete_effect = { add_war_support = 0.05 }
\t\tai_will_do = { base = 2 modifier = { factor = 0 has_war = yes } }
\t\tfancy_unknown_key = { x = 1 }
\t}
\tej_mision = {
\t\tdays_mission_timeout = 90
\t\tactivation = { always = yes }
\t\ttimeout_effect = { add_stability = -0.1 }
\t\tallowed = { OR = { tag = EJE tag = EJF } }
\t}
}
`
  },
  {
    path: 'common/ideas/ej.txt',
    text: `ideas = {
\tcountry = {
\t\tej_espiritu = {
\t\t\tpicture = generic_x
\t\t\tmodifier = { stability_factor = 0.1 weird_modifier = 3 }
\t\t\ton_add = { add_political_power = 1 }
\t\t}
\t}
\tlaw = { law = yes ej_ley = { modifier = { x = 1 } } }
}
`
  }
]

describe('lector de texto de mods (S9)', () => {
  it('lee sentencias, comentarios, comillas y el texto original de lo que no entiende', () => {
    const t = `# hola\nfoo = { a = 1 b = "x y" # c\n  c = { d = 2 } }\nbar = yes\n`
    const s = scan(t)!
    expect(s.map((x) => x.key)).toEqual(['foo', 'bar'])
    expect(find(s[0].block, 'b')?.value).toBe('x y')
    expect(codeOf(find(s[0].block, 'c'))).toBe('\td = 2\n')
    expect(restCode(t, s[0].block, ['a', 'b'])).toContain('c = { d = 2 }')
    expect(scan('a = { b = 1')).toBeNull()
    expect(parseYml('﻿l_english:\n k:0 "a \\"b\\""\n')).toEqual({ k: 'a "b"' })
  })
})

describe('importar un mod (S9)', () => {
  const run = (): ReturnType<typeof importMod> =>
    importMod(emptyProjectFor('Mi Mod', 'content'), FILES)

  it('trae focos con posiciones relativas, exclusiones y texto avanzado', () => {
    const { project: p, report } = run()
    expect(report.focusTrees).toBe(1)
    expect(report.focuses).toBe(3)
    const a = p.focuses.find((f) => f.id === 'ej_foco_a')!
    const b = p.focuses.find((f) => f.id === 'ej_foco_b')!
    expect(a).toMatchObject({ name: 'Foco A', description: 'Descripción A', cost: 5, x: 2, y: 0 })
    expect(a.scripts.available).toBe('\thas_war = no\n')
    expect(a.extraText).toContain('search_filters')
    // x e y relativos a ej_foco_a pasan a absolutos
    expect([b.x, b.y]).toEqual([3, 1])
    expect(b.prerequisites).toEqual([a.uid]) // ej_foco_x no existe en el árbol
    expect(b.mutuallyExclusive).toHaveLength(1)
    expect(report.notes.some((n) => /prerrequisito ej_foco_x no está/.test(n))).toBe(true)
    expect(report.notes.some((n) => /"O" se importó como varios/.test(n))).toBe(true)
    const out = generateFocusTree(p, 'ej_arbol')
    expect(out).toContain('search_filters = { FOCUS_FILTER_POLITICAL }')
    expect(out).toContain('add_political_power = 50')
  })

  it('trae eventos con su localización y lo no entendido como texto avanzado', async () => {
    const { project: p, report } = run()
    expect(report.events).toBe(2)
    const e = p.events.find((x) => x.number === 1)!
    expect(e).toMatchObject({ namespace: 'ej', title: 'Un titular', description: 'Pasó "algo"' })
    expect(e.picture).toEqual({ kind: 'game', gfx: 'GFX_report_event_generic' })
    expect(e.flags.triggeredOnly).toBe(true)
    expect(e.options[0]).toMatchObject({ name: 'Aceptar', aiBase: 3 })
    expect(e.options[0].effects.code).toContain('country_event = { id = ej.2 days = 3 }')
    expect(e.extraText).toContain('goto = 1234')
    const text = eventFiles(p)[0].text!
    expect(text).toContain('goto = 1234')
    const j = await Jomini.initialize()
    expect(() => j.parseText(text)).not.toThrow()
  })

  it('trae categorías y decisiones (normal, misión) y respeta lo desconocido', async () => {
    const { project: p, report } = run()
    expect(report.categories).toBe(1)
    expect(report.decisions).toBe(2)
    const cat = p.decisionCategories[0]
    expect(cat).toMatchObject({
      id: 'ej_cat',
      name: 'Mi categoría',
      priority: 5,
      visibleWhenEmpty: true
    })
    const d = p.decisions.find((x) => x.id === 'ej_dec')!
    expect(d).toMatchObject({ kind: 'normal', countries: ['EJE'], daysReEnable: 10, aiBase: 2 })
    expect(d.cost).toMatchObject({ mode: 'pp', pp: 25 })
    expect(d.aiModifiers).toHaveLength(1)
    expect(d.extraText).toContain('fancy_unknown_key')
    const m = p.decisions.find((x) => x.id === 'ej_mision')!
    expect(m).toMatchObject({ kind: 'mission', missionTimeoutDays: 90, countries: ['EJE', 'EJF'] })
    const text = decisionFiles(p).find((f) => f.path.endsWith('_decisions.txt'))!.text!
    expect(text).toContain('fancy_unknown_key = { x = 1 }')
    const j = await Jomini.initialize()
    expect(() => j.parseText(text)).not.toThrow()
  })

  it('trae solo espíritus nacionales y conserva lo que no son filas', () => {
    const { project: p, report } = run()
    expect(report.ideas).toBe(1)
    const i = p.ideas[0]
    expect(i).toMatchObject({
      id: 'ej_espiritu',
      name: 'Espíritu de ejemplo',
      picture: 'generic_x'
    })
    expect(i.modifiers).toEqual([{ key: 'stability_factor', value: 10 }])
    expect(i.extraText).toContain('on_add')
    expect(generateIdeas(p)).toContain('weird_modifier = 3')
    expect(report.notes.some((n) => /ej_ley/.test(n))).toBe(true)
  })

  it('no duplica lo que ya existe y es idempotente', () => {
    const first = run().project
    const again = importMod(first, FILES)
    expect(again.report).toMatchObject({ focuses: 0, events: 0, decisions: 0, ideas: 0 })
    expect(again.project.events).toHaveLength(first.events.length)
  })
})

describe('leer la carpeta de un mod es solo lectura', () => {
  it('no modifica la carpeta original', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi4-import-'))
    for (const f of FILES) {
      const abs = path.join(dir, ...f.path.split('/'))
      fs.mkdirSync(path.dirname(abs), { recursive: true })
      fs.writeFileSync(abs, f.text)
    }
    fs.writeFileSync(path.join(dir, 'descriptor.mod'), 'name="Ejemplo"\nversion="1"\n')
    const snap = (): string =>
      fs
        .readdirSync(dir, { recursive: true, withFileTypes: true })
        .map(
          (e) =>
            `${e.parentPath}/${e.name}:${e.isFile() ? fs.statSync(path.join(e.parentPath, e.name)).mtimeMs + ':' + fs.statSync(path.join(e.parentPath, e.name)).size : 'd'}`
        )
        .sort()
        .join('\n')
    const before = snap()
    const r = readModFolder(dir)
    expect(r.name).toBe('Ejemplo')
    expect(r.files.map((f) => f.path).sort()).toEqual(FILES.map((f) => f.path).sort())
    expect(snap()).toBe(before)
    const { report } = importMod(emptyProjectFor('Otro', 'content'), r.files)
    expect(report.events).toBe(2)
  })
})
