// Pruebas: bloques → script PDX, árbol completo, validador y exportación
import { describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import * as Blockly from 'blockly'
import { registerAllBlocks } from '../src/renderer/src/blocks'
import {
  FOCUS_ROOT,
  migrateFocusBlocks,
  OLD_SLOT_TYPES as SLOT_TYPES
} from '../src/renderer/src/blocks/slots'
import { generateSlots } from '../src/renderer/src/generator/pdx'
import { generateFocusTree, generateLocalisation } from '../src/renderer/src/generator/focusTree'
import { validateProject, validateTag } from '../src/renderer/src/export/validator'
import { createFocus, deleteFocus, togglePrerequisite } from '../src/renderer/src/ui/projectOps'
import { handleExportMod } from '../src/main/export'
import type { Project } from '../src/renderer/src/types'

import { emptyProject } from './fixtures'

registerAllBlocks()

function workspaceWithBlocks(): Blockly.Workspace {
  const ws = new Blockly.Workspace()
  Blockly.serialization.workspaces.load(
    migrateFocusBlocks({
      blocks: {
        blocks: [
          {
            type: SLOT_TYPES.available,
            inputs: {
              BODY: {
                block: {
                  type: 'cond_not',
                  inputs: {
                    CHILDREN: {
                      block: { type: 'cond_has_war', fields: { VALUE: 'yes' } }
                    }
                  },
                  next: {
                    block: {
                      type: 'cond_date_after',
                      fields: { YEAR: 1938, MONTH: 3, DAY: 1 }
                    }
                  }
                }
              }
            }
          },
          { type: SLOT_TYPES.bypass },
          {
            type: SLOT_TYPES.reward,
            inputs: {
              BODY: {
                block: {
                  type: 'eff_add_stability',
                  fields: { PERCENT: 5 },
                  next: {
                    block: {
                      type: 'eff_if',
                      inputs: {
                        LIMIT: {
                          block: { type: 'cond_tag', fields: { TAG: 'ger' } }
                        },
                        DO: {
                          block: {
                            type: 'eff_state_scope',
                            fields: { STATE: 64 },
                            inputs: {
                              DO: {
                                block: {
                                  type: 'eff_add_building_construction',
                                  fields: {
                                    LEVEL: 2,
                                    BUILDING: 'arms_factory'
                                  }
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        ]
      }
    }) as object,
    ws
  )
  return ws
}

describe('generador PDX', () => {
  it('genera las 3 ranuras', () => {
    const s = generateSlots(workspaceWithBlocks())
    expect(s.available).toBe('\tNOT = {\n\t\thas_war = yes\n\t}\n\tdate > 1938.3.1\n')
    expect(s.bypass).toBe('')
    expect(s.reward).toContain('\tadd_stability = 0.05\n')
    expect(s.reward).toContain('\t\tlimit = {\n\t\t\ttag = GER\n\t\t}\n')
    expect(s.reward).toContain('\t\t64 = {\n\t\t\tadd_building_construction = {\n')
  })

  it('setCheck impide poner un efecto en Requisitos', () => {
    const ws = new Blockly.Workspace()
    const slot = ws.newBlock(FOCUS_ROOT)
    const eff = ws.newBlock('eff_add_political_power')
    const conn = slot.getInput('AVAILABLE')!.connection!
    expect(conn.getConnectionChecker().canConnect(conn, eff.previousConnection, false)).toBe(false)
    const cond = ws.newBlock('cond_has_war')
    expect(conn.getConnectionChecker().canConnect(conn, cond.previousConnection, false)).toBe(true)
  })
})

export function sampleProject(): Project {
  let p: Project = { ...emptyProject(), modName: 'Mi Mod México' }
  const ra = createFocus(p, 0, 0)
  const rb = createFocus(ra.project, 0, 1)
  p = rb.project
  const [a, b] = p.focuses
  a.name = 'Industria "moderna"'
  b.name = 'Ejército'
  b.scripts = { ...generateSlots(workspaceWithBlocks()) }
  a.scripts.reward = '\tadd_political_power = 100\n'
  p = togglePrerequisite(p, a.uid, b.uid)
  return p
}

describe('árbol de focos', () => {
  it('genera focus_tree con llaves balanceadas', () => {
    const txt = generateFocusTree(sampleProject())
    expect(txt).toContain('focus_tree = {\n\tid = MEX_focus_tree')
    expect(txt).toContain('\t\t\ttag = MEX')
    expect(txt).toContain('\tdefault = no')
    expect(txt).toContain('\t\tprerequisite = { focus = mi_mod_mexico_MEX_foco_1 }')
    expect(txt).toContain('\t\tavailable = {\n\t\t\tNOT = {\n\t\t\t\thas_war = yes\n\t\t\t}')
    expect((txt.match(/{/g) ?? []).length).toBe((txt.match(/}/g) ?? []).length)
  })

  it('genera localización', () => {
    const loc = generateLocalisation(sampleProject())
    expect(
      loc.startsWith('l_english:\n mi_mod_mexico_MEX_foco_1:0 "Industria \\"moderna\\""')
    ).toBe(true)
    expect(loc).toContain(' mi_mod_mexico_MEX_foco_1_desc:0 ""')
  })
})

describe('validador', () => {
  it('valida tags', () => {
    expect(validateTag('MEX')).toBeNull()
    expect(validateTag('M1X')).toBeNull()
    expect(validateTag('mex')).not.toBeNull()
    expect(validateTag('1AB')).not.toBeNull()
    expect(validateTag('NOT')).not.toBeNull()
    expect(validateTag('RED')).not.toBeNull()
  })

  it('detecta ids duplicados, focos sin nombre y prerrequisitos borrados', () => {
    const p = sampleProject()
    p.focuses[1].id = p.focuses[0].id
    p.focuses[0].name = ''
    p.focuses[1].prerequisites.push('uid_inexistente')
    const msgs = validateProject(p).map((i) => i.message)
    expect(msgs.some((m) => m.includes('repetido'))).toBe(true)
    expect(msgs.some((m) => m.includes('no tiene nombre'))).toBe(true)
    expect(msgs.some((m) => m.includes('foco borrado'))).toBe(true)
  })

  it('detecta llaves desbalanceadas', () => {
    const p = sampleProject()
    p.focuses[0].scripts.reward = '\tif = {\n'
    expect(validateProject(p).some((i) => i.message.startsWith('Llaves desbalanceadas'))).toBe(true)
  })

  it('un proyecto correcto no tiene errores y borrar limpia las líneas', () => {
    const p = sampleProject()
    expect(validateProject(p).filter((i) => i.severity === 'error')).toEqual([])
    const after = deleteFocus(p, p.focuses[0].uid)
    expect(after.focuses[0].prerequisites).toEqual([])
  })
})

describe('exportación', () => {
  it('crea los archivos con/sin BOM', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi4-'))
    const p = sampleProject()
    const res = await handleExportMod({
      exportPath: dir,
      modName: p.modName,
      tag: p.tag,
      focusTreeScript: generateFocusTree(p),
      locYaml: generateLocalisation(p)
    })
    expect(res.success).toBe(true)
    const folder = path.join(dir, 'mi_mod_mexico')
    const outer = fs.readFileSync(path.join(dir, 'mi_mod_mexico.mod'))
    const desc = fs.readFileSync(path.join(folder, 'descriptor.mod'))
    const loc = fs.readFileSync(
      path.join(folder, 'localisation/english/mi_mod_mexico_l_english.yml')
    )
    expect(outer.toString()).toContain('path="')
    expect(desc[0]).not.toBe(0xef)
    expect([loc[0], loc[1], loc[2]]).toEqual([0xef, 0xbb, 0xbf])
    expect(loc.toString('utf-8').slice(1).startsWith('l_english:')).toBe(true)
    expect(fs.existsSync(path.join(folder, 'common/national_focus/MEX_focus.txt'))).toBe(true)
  })

  it('se niega a escribir en la carpeta del juego', async () => {
    const res = await handleExportMod({
      exportPath: 'C:/Program Files (x86)/Steam/steamapps/common/Hearts of Iron IV',
      modName: 'x',
      tag: 'MEX',
      focusTreeScript: '',
      locYaml: ''
    })
    expect(res.success).toBe(false)
  })
})
