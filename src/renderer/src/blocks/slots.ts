// El bloque raíz "Foco": UN solo bloque con tres secciones (requisitos, saltar si, recompensa).
// Cada sección acepta solo condiciones o solo efectos. Crece hacia abajo, así nada se superpone.
import * as Blockly from 'blockly'
import { CHECK_CONDITION, CHECK_EFFECT, COLOR_SLOT } from './checks'

export const FOCUS_ROOT = 'focus_root'

/** Nombre de las tres secciones (entradas de sentencia) del bloque raíz */
export const SLOT_INPUTS = {
  available: 'AVAILABLE',
  bypass: 'BYPASS',
  reward: 'REWARD'
} as const

/** Tipos de los tres bloques sueltos de versiones anteriores (solo para migrar) */
export const OLD_SLOT_TYPES = {
  available: 'slot_available',
  bypass: 'slot_bypass',
  reward: 'slot_reward'
} as const

export const slotBlocks = [
  {
    type: FOCUS_ROOT,
    message0: '🎯 Foco: %1',
    args0: [{ type: 'field_label', name: 'NAME', text: '' }],
    message1: '📋 Requisitos (available) %1',
    args1: [{ type: 'input_statement', name: SLOT_INPUTS.available, check: CHECK_CONDITION }],
    message2: '⏭ Saltar si (bypass) %1',
    args2: [{ type: 'input_statement', name: SLOT_INPUTS.bypass, check: CHECK_CONDITION }],
    message3: '🎁 Recompensa (completion_reward) %1',
    args3: [{ type: 'input_statement', name: SLOT_INPUTS.reward, check: CHECK_EFFECT }],
    colour: COLOR_SLOT,
    deletable: false,
    tooltip: 'Requisitos para empezar, condiciones para saltarlo y efectos al completarlo'
  }
]

export function registerSlotBlocks(): void {
  Blockly.common.defineBlocksWithJsonArray(slotBlocks)
  const block = Blockly.Blocks[FOCUS_ROOT]
  // La raíz es única: no se duplica ni se copia
  block.isDuplicatable = () => false
  block.isDeletable = () => false
}

/** Crea el bloque raíz en un espacio de trabajo vacío */
export function createSlots(ws: Blockly.Workspace, name = ''): Blockly.Block {
  const b = ws.newBlock(FOCUS_ROOT)
  b.setFieldValue(name, 'NAME')
  b.moveBy(20, 20)
  if (b instanceof Blockly.BlockSvg) {
    b.initSvg()
    b.render()
  }
  return b
}

export function focusRoot(ws: Blockly.Workspace): Blockly.Block | undefined {
  return ws.getBlocksByType(FOCUS_ROOT, false)[0]
}

export function setFocusRootName(ws: Blockly.Workspace, name: string): void {
  const r = focusRoot(ws)
  if (r && r.getFieldValue('NAME') !== name) r.setFieldValue(name, 'NAME')
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Migración: convierte el JSON guardado con los tres bloques viejos al bloque único.
 * El contenido de cada ranura pasa a la sección correspondiente; los demás bloques sueltos
 * se conservan. Si ya hay una raíz, no cambia nada. Sin bloques devuelve una raíz vacía.
 */
export function migrateFocusBlocks(json: unknown): unknown {
  const old: any = json && typeof json === 'object' ? json : {}
  const list: any[] = Array.isArray(old.blocks?.blocks) ? old.blocks.blocks : []
  const oldTypes = Object.values(OLD_SLOT_TYPES) as string[]
  const hasRoot = list.some((b) => b?.type === FOCUS_ROOT)
  const rest = list.filter((b) => b && !oldTypes.includes(b.type))
  if (hasRoot) return { ...old, blocks: { ...old.blocks, languageVersion: 0, blocks: rest } }
  const root: any = { type: FOCUS_ROOT, x: 20, y: 20, inputs: {} }
  const first = list.find((b) => b && oldTypes.includes(b.type))
  if (first && typeof first.x === 'number') root.x = first.x
  if (first && typeof first.y === 'number') root.y = first.y
  for (const [key, type] of Object.entries(OLD_SLOT_TYPES)) {
    const slot = list.find((b) => b?.type === type)
    const body = slot?.inputs?.BODY
    if (body) root.inputs[SLOT_INPUTS[key as keyof typeof SLOT_INPUTS]] = body
  }
  return { ...old, blocks: { ...old.blocks, languageVersion: 0, blocks: [root, ...rest] } }
}

/**
 * Ordena SOLO los bloques sueltos (fuera de la raíz): quedan en columna a la derecha de ella,
 * sin tocarse. La raíz no se mueve. Se llama al cargar y al soltar un bloque.
 */
export function tidyLooseBlocks(ws: Blockly.WorkspaceSvg): void {
  const root = focusRoot(ws) as Blockly.BlockSvg | undefined
  const loose = ws.getTopBlocks(true).filter((b) => b.type !== FOCUS_ROOT) as Blockly.BlockSvg[]
  if (!loose.length) return
  const rootBox = root?.getBoundingRectangle()
  const x = rootBox ? rootBox.right + 60 : 20
  let y = rootBox ? rootBox.top : 20
  Blockly.Events.setGroup(true)
  try {
    for (const b of loose) {
      const pos = b.getRelativeToSurfaceXY()
      b.moveBy(x - pos.x, y - pos.y)
      y += b.getHeightWidth().height + 24
    }
  } finally {
    Blockly.Events.setGroup(false)
  }
}

/** ¿Algún bloque suelto se toca con la raíz o con otro bloque suelto? */
export function hasOverlap(ws: Blockly.WorkspaceSvg): boolean {
  const tops = ws.getTopBlocks(false) as Blockly.BlockSvg[]
  const boxes = tops.map((b) => b.getBoundingRectangle())
  for (let i = 0; i < boxes.length; i++)
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i]
      const c = boxes[j]
      if (a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom) return true
    }
  return false
}
