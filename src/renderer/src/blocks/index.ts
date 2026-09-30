// Punto de entrada de los bloques: los registra una sola vez y
// define la caja de herramientas (toolbox) con sus categorías.
import * as Blockly from 'blockly'
import * as Es from 'blockly/msg/es'
import { registerConditionBlocks, conditionBlocks } from './conditions'
import { registerEffectBlocks, effectBlocks } from './effects'
import { registerSlotBlocks } from './slots'
import { COLOR_CONDITION, COLOR_EFFECT, COLOR_STATE } from './checks'

let registered = false

export function registerAllBlocks(): void {
  if (registered) return
  registered = true
  Blockly.setLocale(Es as unknown as { [key: string]: string })
  registerSlotBlocks()
  registerConditionBlocks()
  registerEffectBlocks()
}

const blocksOf = (defs: { type: string }[], filter: (t: string) => boolean) =>
  defs.filter((d) => filter(d.type)).map((d) => ({ kind: 'block', type: d.type }))

const STATE_TYPES = ['eff_state_scope', 'eff_add_building_construction']

export const toolbox = {
  kind: 'categoryToolbox',
  contents: [
    {
      kind: 'category',
      name: 'Condiciones',
      colour: String(COLOR_CONDITION),
      contents: blocksOf(conditionBlocks, (t) => !['cond_not', 'cond_or', 'cond_and'].includes(t))
    },
    {
      kind: 'category',
      name: 'Lógica (NO / O / Y)',
      colour: String(COLOR_CONDITION),
      contents: blocksOf(conditionBlocks, (t) => ['cond_not', 'cond_or', 'cond_and'].includes(t))
    },
    {
      kind: 'category',
      name: 'Efectos',
      colour: String(COLOR_EFFECT),
      contents: blocksOf(effectBlocks, (t) => !STATE_TYPES.includes(t))
    },
    {
      kind: 'category',
      name: 'Estados',
      colour: String(COLOR_STATE),
      contents: blocksOf(effectBlocks, (t) => STATE_TYPES.includes(t))
    }
  ]
}
