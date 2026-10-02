// Bloque único "Foco": una raíz con tres secciones, generador idéntico y migración de los 3 bloques viejos
import { describe, expect, it } from 'vitest'
import * as Blockly from 'blockly'
import { registerAllBlocks } from '../src/renderer/src/blocks'
import { FOCUS_ROOT, migrateFocusBlocks } from '../src/renderer/src/blocks/slots'
import { generateSlots } from '../src/renderer/src/generator/pdx'
import { migrateProject } from '../src/renderer/src/migrate'
import { PROJECT_VERSION } from '../src/renderer/src/types'
import { emptyProject } from './fixtures'

registerAllBlocks()

const notWar = {
  block: {
    type: 'cond_not',
    inputs: { CHILDREN: { block: { type: 'cond_has_war', fields: { VALUE: 'yes' } } } },
    next: { block: { type: 'cond_date_after', fields: { YEAR: 1938, MONTH: 3, DAY: 1 } } }
  }
}
const reward = {
  block: {
    type: 'eff_add_stability',
    fields: { PERCENT: 5 },
    next: { block: { type: 'eff_set_country_flag', fields: { FLAG: 'reforma' } } }
  }
}

/** Formato guardado ANTES de esta versión: tres bloques sueltos */
const oldBlocks = {
  blocks: {
    languageVersion: 0,
    blocks: [
      { type: 'slot_available', x: 20, y: 20, inputs: { BODY: notWar } },
      { type: 'slot_bypass', x: 20, y: 170 },
      { type: 'slot_reward', x: 20, y: 320, inputs: { BODY: reward } },
      { type: 'cond_has_war', x: 400, y: 50, fields: { VALUE: 'no' } }
    ]
  }
}

function load(json: unknown): Blockly.Workspace {
  const ws = new Blockly.Workspace()
  Blockly.serialization.workspaces.load(json as object, ws)
  return ws
}

describe('bloque único Foco', () => {
  it('migra los tres bloques viejos al bloque nuevo sin perder nada', () => {
    const nuevo = migrateFocusBlocks(oldBlocks) as { blocks: { blocks: { type: string }[] } }
    const tipos = nuevo.blocks.blocks.map((b) => b.type)
    expect(tipos.filter((t) => t === FOCUS_ROOT)).toHaveLength(1)
    expect(tipos.some((t) => t.startsWith('slot_'))).toBe(false)
    expect(tipos).toContain('cond_has_war') // el bloque suelto se conserva
    const ws = load(nuevo)
    const raiz = ws.getBlocksByType(FOCUS_ROOT, false)[0]
    expect(raiz.getInputTargetBlock('AVAILABLE')?.type).toBe('cond_not')
    expect(raiz.getInputTargetBlock('BYPASS')).toBeNull()
    expect(raiz.getInputTargetBlock('REWARD')?.type).toBe('eff_add_stability')
  })

  it('el texto generado es idéntico al de siempre', () => {
    const viejo = generateSlots(load(migrateFocusBlocks(oldBlocks)))
    expect(viejo.bypass).toBe('')
    // El mismo contenido escrito directamente en el bloque nuevo da lo mismo
    const directo = generateSlots(
      load({
        blocks: {
          languageVersion: 0,
          blocks: [
            {
              type: FOCUS_ROOT,
              inputs: { AVAILABLE: notWar, REWARD: reward }
            }
          ]
        }
      })
    )
    expect(directo).toEqual(viejo)
    expect(viejo.available).toContain('NOT = {')
    expect(viejo.reward).toContain('set_country_flag = reforma')
  })

  it('los bloques sueltos no generan código', () => {
    const t = generateSlots(load(migrateFocusBlocks(oldBlocks)))
    expect(t.available).not.toContain('has_war = no')
    expect(t.reward).not.toContain('has_war')
  })

  it('la raíz no se puede borrar ni duplicar y no tiene conexiones arriba/abajo', () => {
    const ws = new Blockly.Workspace()
    const b = ws.newBlock(FOCUS_ROOT)
    expect(b.isDeletable()).toBe(false)
    expect(b.isDuplicatable()).toBe(false)
    expect(b.previousConnection).toBeNull()
    expect(b.nextConnection).toBeNull()
    expect(b.isMovable()).toBe(true)
    // Cada sección sigue aceptando solo lo suyo
    expect(b.getInput('AVAILABLE')?.connection?.getCheck()).toEqual(
      b.getInput('BYPASS')?.connection?.getCheck()
    )
    expect(b.getInput('REWARD')?.connection?.getCheck()).not.toEqual(
      b.getInput('AVAILABLE')?.connection?.getCheck()
    )
  })

  it('migrateFocusBlocks sin bloques viejos devuelve una raíz vacía; idempotente', () => {
    const vacio = migrateFocusBlocks(null) as { blocks: { blocks: { type: string }[] } }
    expect(vacio.blocks.blocks.map((b) => b.type)).toEqual([FOCUS_ROOT])
    const otra = migrateFocusBlocks(vacio) as typeof vacio
    expect(otra.blocks.blocks.filter((b) => b.type === FOCUS_ROOT)).toHaveLength(1)
  })

  it('al migrar el proyecto: versión nueva y focos con el bloque único', () => {
    const p = emptyProject()
    const raw = {
      ...p,
      version: 6,
      modSync: { enabled: true, dest: null },
      focuses: [
        {
          uid: 'f1',
          treeId: p.focusTrees[0].id,
          id: 'a_b',
          name: 'A',
          cost: 10,
          x: 0,
          y: 0,
          blocks: oldBlocks,
          scripts: { available: '', bypass: '', reward: '' }
        }
      ]
    }
    const m = migrateProject(raw)
    expect(m.version).toBe(PROJECT_VERSION)
    expect(PROJECT_VERSION).toBeGreaterThanOrEqual(7)
    const tipos = (
      m.focuses[0].blocks as { blocks: { blocks: { type: string }[] } }
    ).blocks.blocks.map((b) => b.type)
    expect(tipos).toContain(FOCUS_ROOT)
    expect(tipos.some((t) => t.startsWith('slot_'))).toBe(false)
    expect('modSync' in m).toBe(false)
  })
})
