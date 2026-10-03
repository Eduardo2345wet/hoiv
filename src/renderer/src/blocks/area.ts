// Bloque raíz de una ranura reutilizable (opciones de eventos, efectos de decisiones, etc.): una sola
// boca que acepta condiciones, efectos de país o efectos de estado. Usa el mismo generador PDX y la
// misma caja de herramientas (filtrada por contexto) que los focos.
import * as Blockly from 'blockly'
import { CHECK_CONDITION, CHECK_EFFECT, CHECK_STATE_EFFECT, COLOR_SLOT } from './checks'
import { pdxGenerator } from '../generator/pdx'
import { toolbox as fullToolbox } from './index'

export type AreaMode = 'effect' | 'condition'
export type AreaScope = 'country' | 'state'

export const AREA_ROOT = 'area_root'
const CHECKS: Record<string, string> = {
  'effect:country': CHECK_EFFECT,
  'effect:state': CHECK_STATE_EFFECT,
  'condition:country': CHECK_CONDITION,
  'condition:state': CHECK_CONDITION
}
export const areaRootType = (mode: AreaMode, scope: AreaScope): string =>
  `${AREA_ROOT}_${mode}_${scope}`

let registered = false
/** Registra los cuatro bloques raíz (una vez) */
export function registerAreaBlocks(): void {
  if (registered) return
  registered = true
  const defs = (['effect', 'condition'] as AreaMode[]).flatMap((mode) =>
    (['country', 'state'] as AreaScope[]).map((scope) => ({
      type: areaRootType(mode, scope),
      message0:
        mode === 'effect' ? (scope === 'state' ? 'Efectos de estado' : 'Efectos') : 'Condiciones',
      message1: '%1',
      args1: [{ type: 'input_statement', name: 'BODY', check: CHECKS[`${mode}:${scope}`] }],
      colour: COLOR_SLOT,
      deletable: false,
      tooltip: 'Arrastra aquí los bloques'
    }))
  )
  Blockly.common.defineBlocksWithJsonArray(defs)
  for (const d of defs) {
    Blockly.Blocks[d.type].isDuplicatable = () => false
    Blockly.Blocks[d.type].isDeletable = () => false
  }
}

/** Caja de herramientas filtrada por contexto (efectos frente a condiciones; país o estado) */
export function areaToolbox(mode: AreaMode, scope: AreaScope): typeof fullToolbox {
  const cats = fullToolbox.contents as { name: string }[]
  const keep =
    mode === 'condition'
      ? ['Condiciones', 'Lógica (NO / O / Y)']
      : scope === 'state'
        ? ['Condiciones', 'Lógica (NO / O / Y)', 'Estados']
        : ['Condiciones', 'Lógica (NO / O / Y)', 'Efectos', 'Estados']
  return { ...fullToolbox, contents: cats.filter((c) => keep.includes(c.name)) as never }
}

export const areaRoot = (ws: Blockly.Workspace): Blockly.Block | undefined =>
  ws.getAllBlocks(false).find((b) => b.type.startsWith(AREA_ROOT))

/** Texto del script de la ranura (los bloques sueltos no generan código) */
export function generateArea(ws: Blockly.Workspace): string {
  pdxGenerator.init(ws)
  const root = areaRoot(ws)
  return root ? pdxGenerator.statementToCode(root, 'BODY') : ''
}

/** Texto de un script de bloques guardado (sin interfaz: espacio de trabajo sin dibujar) */
export function codeOfBlocks(blocks: unknown): string {
  if (!blocks) return ''
  registerAreaBlocks()
  const ws = new Blockly.Workspace()
  try {
    Blockly.serialization.workspaces.load(blocks as object, ws)
    return generateArea(ws)
  } finally {
    ws.dispose()
  }
}

/**
 * Agrega un bloque (JSON de serialización) al final de la boca de una ranura y devuelve el script
 * nuevo con su texto. Sirve para "Enlazar a evento…" sin abrir el editor de bloques.
 */
export function appendBlock(
  script: { blocks: unknown | null; code: string },
  mode: AreaMode,
  scope: AreaScope,
  block: Record<string, unknown>
): { blocks: unknown; code: string } {
  type Json = { blocks?: { blocks?: Record<string, any>[] } } // eslint-disable-line @typescript-eslint/no-explicit-any
  const base: Json = script.blocks
    ? (JSON.parse(JSON.stringify(script.blocks)) as Json)
    : { blocks: { blocks: [] } }
  const list = (base.blocks ??= { blocks: [] }).blocks ?? (base.blocks.blocks = [])
  let root = list.find((b) => String(b.type).startsWith(AREA_ROOT))
  if (!root) {
    root = { type: areaRootType(mode, scope), x: 20, y: 20 }
    list.unshift(root)
  }
  root.inputs ??= {}
  if (!root.inputs.BODY) root.inputs.BODY = { block }
  else {
    let cur = root.inputs.BODY.block
    while (cur.next?.block) cur = cur.next.block
    cur.next = { block }
  }
  const out = { blocks: { languageVersion: 0, blocks: list } }
  return { blocks: out, code: codeOfBlocks(out) }
}
