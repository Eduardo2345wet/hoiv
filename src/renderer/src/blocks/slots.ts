// Las 3 "ranuras" de cada foco. Son bloques fijos (no se pueden borrar)
// con una entrada que solo acepta condiciones o solo efectos.
import * as Blockly from 'blockly'
import { CHECK_CONDITION, CHECK_EFFECT, COLOR_SLOT } from './checks'

export const SLOT_TYPES = {
  available: 'slot_available',
  bypass: 'slot_bypass',
  reward: 'slot_reward'
} as const

export const slotBlocks = [
  {
    type: SLOT_TYPES.available,
    message0: '📋 Requisitos (available) %1 %2',
    args0: [
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'BODY', check: CHECK_CONDITION }
    ],
    colour: COLOR_SLOT,
    tooltip: 'Condiciones para poder empezar el foco'
  },
  {
    type: SLOT_TYPES.bypass,
    message0: '⏭ Saltar si (bypass) %1 %2',
    args0: [
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'BODY', check: CHECK_CONDITION }
    ],
    colour: COLOR_SLOT,
    tooltip: 'Si se cumplen, el foco se completa solo'
  },
  {
    type: SLOT_TYPES.reward,
    message0: '🎁 Recompensa (completion_reward) %1 %2',
    args0: [
      { type: 'input_dummy' },
      { type: 'input_statement', name: 'BODY', check: CHECK_EFFECT }
    ],
    colour: COLOR_SLOT,
    tooltip: 'Efectos al completar el foco'
  }
]

export function registerSlotBlocks(): void {
  Blockly.common.defineBlocksWithJsonArray(slotBlocks)
}

/** Crea las 3 ranuras en un espacio de trabajo vacío */
export function createSlots(ws: Blockly.Workspace): void {
  const types = [SLOT_TYPES.available, SLOT_TYPES.bypass, SLOT_TYPES.reward]
  let y = 20
  for (const t of types) {
    const b = ws.newBlock(t)
    b.setDeletable(false)
    b.moveBy(20, y)
    if (b instanceof Blockly.BlockSvg) {
      b.initSvg()
      b.render()
    }
    y += 150
  }
}
