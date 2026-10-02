import { describe, expect, it } from 'vitest'
import { Jomini } from 'jomini'
import * as Blockly from 'blockly'
import { registerAllBlocks } from '../src/renderer/src/blocks'
import { emptyProjectFor } from '../src/renderer/src/templates'
import {
  createCategory,
  createDecision,
  decisionFiles,
  decisionImagePaths,
  decisionLoc,
  decisionsOf,
  deleteCategory,
  duplicateDecision,
  updateDecision,
  validateDecisions
} from '../src/renderer/src/sections/decisions'
import { sectionFiles } from '../src/renderer/src/sections/generators'
import { plannedPaths } from '../src/renderer/src/export/exportMod'
import { generateArea } from '../src/renderer/src/blocks/area'
import type { BlockScript } from '../src/renderer/src/sections/types'
import type { Project } from '../src/renderer/src/types'

registerAllBlocks()
const script = (code: string): BlockScript => ({ blocks: null, code })
const base = (): Project => emptyProjectFor('Mi Mod', 'content')
const full = (): Project => {
  let p = createCategory(base(), { name: 'Política', description: 'Cosas' }).project
  const cat = p.decisionCategories[0]
  p = createDecision(p, {
    name: 'Comprar',
    categoryUid: cat.uid,
    kind: 'normal',
    cost: { mode: 'pp', pp: 50, customTrigger: script(''), customText: '', aiHintPp: 0 },
    countries: ['GER'],
    daysReEnable: 30,
    aiBase: 1,
    complete: script('add_stability = 0.05\n')
  }).project
  p = createDecision(p, {
    name: 'Misión',
    categoryUid: cat.uid,
    kind: 'mission',
    missionTimeoutDays: 60,
    timeout: script('add_war_support = -0.1\n'),
    complete: script('add_stability = 0.1\n')
  }).project
  p = createDecision(p, {
    name: 'Contra',
    categoryUid: cat.uid,
    kind: 'target-country',
    targetCountries: ['FRA', 'ENG'],
    targetTrigger: script('is_in_faction_with = ROOT\n'),
    warWithOnComplete: 'FRA'
  }).project
  p = createDecision(p, {
    name: 'Estados',
    categoryUid: cat.uid,
    kind: 'target-state',
    targetStates: [64, 65]
  }).project
  return p
}

describe('decisiones (S3)', () => {
  it('genera categorías y decisiones válidas, con las claves de la wiki', async () => {
    const files = decisionFiles(full())
    const cats = files.find((f) => f.path.includes('categories'))!
    const decs = files.find((f) => f.path === 'common/decisions/mi_mod_decisions.txt')!
    expect(cats.path).toBe('common/decisions/categories/mi_mod_categories.txt')
    const j = await Jomini.initialize()
    expect(() => j.parseText(decs.text!)).not.toThrow()
    expect(() => j.parseText(cats.text!)).not.toThrow()
    const t = decs.text!
    expect(t).toContain('mi_mod_politica = {')
    expect(t).toContain('cost = 50')
    expect(t).toContain('days_re_enable = 30')
    expect(t).toContain('allowed = {\n\t\t\toriginal_tag = GER')
    expect(t).toContain('days_mission_timeout = 60')
    expect(t).toContain('timeout_effect = {')
    expect(t).toContain('targets = { FRA ENG }')
    expect(t).toContain('target_trigger = {')
    expect(t).toContain('war_with_on_complete = FRA')
    expect(t).toContain('state_target = yes')
    expect(t).toContain('targets = { 64 65 }')
    expect(t).toContain('ai_will_do = {\n\t\t\tbase = 1')
    expect(t).not.toContain('\\"')
  })

  it('el costo personalizado usa custom_cost_trigger y no escribe cost', () => {
    let p = full()
    const d = p.decisions[0]
    p = updateDecision(p, d.uid, {
      cost: {
        mode: 'custom',
        pp: 0,
        customTrigger: script('has_political_power > 10\n'),
        customText: 'Cuesta 10',
        aiHintPp: 10
      }
    })
    const t = decisionFiles(p).find((f) => f.path.endsWith('_decisions.txt'))!.text!
    expect(t).toContain('custom_cost_trigger = {')
    expect(t).toContain('custom_cost_text = mi_mod_comprar_cost')
    expect(t).toContain('ai_hint_pp_cost = 10')
    expect(t).not.toContain('cost = 50')
    expect(decisionLoc(p)[0].text).toContain('mi_mod_comprar_cost:0 "Cuesta 10"')
  })

  it('íconos: del juego sin el prefijo; propios con prefijo del mod y .dds + .gfx', () => {
    let p = full()
    p = {
      ...p,
      icons: [
        {
          id: 'a1',
          name: 'x',
          target: 'idea',
          png: 'data:image/png;base64,AA',
          width: 66,
          height: 66
        }
      ]
    }
    p = updateDecision(p, p.decisions[0].uid, {
      icon: { kind: 'game', gfx: 'GFX_decision_generic_ally' }
    })
    p = updateDecision(p, p.decisions[1].uid, { icon: { kind: 'asset', assetId: 'a1' } })
    const files = decisionFiles(p)
    const t = files.find((f) => f.path.endsWith('_decisions.txt'))!.text!
    expect(t).toContain('icon = generic_ally')
    expect(t).toContain('icon = mi_mod_mi_mod_mision')
    const gfx = files.find((f) => f.path === 'interface/mi_mod_decisions.gfx')!.text!
    expect(gfx).toContain('name = "GFX_decision_mi_mod_mi_mod_mision"')
    expect(gfx).toContain('texturefile = "gfx/interface/decisions/mi_mod_mi_mod_mision.dds"')
    expect(decisionImagePaths(p)).toEqual(['gfx/interface/decisions/mi_mod_mi_mod_mision.dds'])
  })

  it('las rutas pasan por el registro con prefijo del mod y la localización va en UTF-8 con BOM', () => {
    const r = sectionFiles(full())
    expect(r.issues).toEqual([])
    expect(r.files.map((f) => f.path)).toContain(
      'localisation/english/mi_mod_decisions_l_english.yml'
    )
    const loc = r.files.find((f) => f.path.endsWith('mi_mod_decisions_l_english.yml'))!
    expect(loc.bom).toBe(true)
    expect(loc.text!.startsWith('l_english:\n')).toBe(true)
    expect(loc.text).toContain('mi_mod_politica:0 "Política"')
    expect(loc.text).toContain('mi_mod_politica_desc:0 "Cosas"')
    expect(plannedPaths(full())).toContain('common/decisions/mi_mod_decisions.txt')
  })

  it('ordena por prioridad, duplica y borrar una categoría deja las decisiones sueltas', () => {
    let p = full()
    p = updateDecision(p, p.decisions[3].uid, { priority: 5 })
    expect(decisionsOf(p, p.decisionCategories[0].uid)[0].name).toBe('Estados')
    const dup = duplicateDecision(p, p.decisions[0].uid)!
    expect(dup.decision.id).not.toBe(p.decisions[0].id)
    p = deleteCategory(dup.project, p.decisionCategories[0].uid)
    expect(p.decisions.every((d) => d.categoryUid === null)).toBe(true)
    expect(validateDecisions(p).some((i) => /no tiene categoría/.test(i.message))).toBe(true)
  })

  it('validador: misión con visible, costo sin restar, sin IA, imagen sin descripción, sin activar', () => {
    let p = full()
    p = updateDecision(p, p.decisions[1].uid, { visible: script('has_war = yes\n') })
    p = updateDecision(p, p.decisions[0].uid, {
      cost: {
        mode: 'custom',
        pp: 0,
        customTrigger: script('x = y\n'),
        customText: '',
        aiHintPp: 0
      },
      complete: script('add_stability = 0.1\n')
    })
    p = {
      ...p,
      decisionCategories: [
        {
          ...p.decisionCategories[0],
          description: '',
          picture: { kind: 'game', gfx: 'GFX_decision_category_x' }
        }
      ]
    }
    const msgs = validateDecisions(p).map((i) => i.message)
    expect(msgs.some((m) => /misión con "visible"/.test(m))).toBe(true)
    expect(msgs.some((m) => /costo personalizado sin restarlo/.test(m))).toBe(true)
    expect(msgs.some((m) => /sin ai_will_do/.test(m))).toBe(true)
    expect(msgs.some((m) => /no descripción/.test(m))).toBe(true)
    expect(msgs.some((m) => /nadie la activa/.test(m))).toBe(true)
    const act = validateDecisions(p, [`activate_mission = ${p.decisions[1].id}`]).map(
      (i) => i.message
    )
    expect(act.some((m) => /nadie la activa/.test(m))).toBe(false)
  })

  it('validador: IDs repetidos y objetivos vacíos son errores', () => {
    let p = full()
    p = updateDecision(p, p.decisions[1].uid, { id: p.decisions[0].id })
    p = updateDecision(p, p.decisions[2].uid, { targetCountries: [], targetTrigger: script('') })
    const errs = validateDecisions(p)
      .filter((i) => i.severity === 'error')
      .map((i) => i.message)
    expect(errs.some((m) => /ID repetido/.test(m))).toBe(true)
    expect(errs.some((m) => /con objetivo/.test(m))).toBe(true)
  })

  it('el bloque "Activar misión" genera activate_mission', () => {
    const ws = new Blockly.Workspace()
    Blockly.serialization.workspaces.load(
      {
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: 'area_root_effect_country',
              inputs: {
                BODY: { block: { type: 'eff_activate_mission', fields: { MISSION: 'mi_mod_m' } } }
              }
            }
          ]
        }
      },
      ws
    )
    expect(generateArea(ws)).toBe('\tactivate_mission = mi_mod_m\n')
  })
})
