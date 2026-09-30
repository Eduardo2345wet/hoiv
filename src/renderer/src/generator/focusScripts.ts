// Convierte los bloques guardados de un foco en el texto de sus 3 ranuras.

import * as Blockly from 'blockly/core'
import { registerBlocks, SLOT_AVAILABLE, SLOT_BYPASS, SLOT_REWARD } from '../blocks/definitions'
import type { BlocklyState } from '../model/project'
import { pdxGenerator } from './pdx'

export interface FocusScripts {
  available: string
  bypass: string
  completion_reward: string
}

const EMPTY: FocusScripts = { available: '', bypass: '', completion_reward: '' }

/** Texto (sin indentar) de los bloques colocados dentro de una ranura. */
function slotCode(workspace: Blockly.Workspace, slotType: string): string {
  const slot = workspace.getBlocksByType(slotType, false)[0]
  const first = slot?.getInputTargetBlock('STACK')
  if (!first) return ''
  return pdxGenerator.blockToCode(first) as string
}

/** Genera el script de las 3 ranuras a partir de un workspace ya cargado. */
export function generateFromWorkspace(workspace: Blockly.Workspace): FocusScripts {
  pdxGenerator.init(workspace)
  return {
    available: slotCode(workspace, SLOT_AVAILABLE),
    bypass: slotCode(workspace, SLOT_BYPASS),
    completion_reward: slotCode(workspace, SLOT_REWARD)
  }
}

// Caché: el estado de cada foco solo cambia cuando se editan sus bloques.
const cache = new WeakMap<BlocklyState, FocusScripts>()

/** Genera el script de un foco usando un workspace invisible (sin interfaz). */
export function generateFocusScripts(state: BlocklyState | null): FocusScripts {
  if (!state) return EMPTY
  const cached = cache.get(state)
  if (cached) return cached
  const scripts = generateHeadless(state)
  cache.set(state, scripts)
  return scripts
}

function generateHeadless(state: BlocklyState): FocusScripts {
  registerBlocks()
  const workspace = new Blockly.Workspace()
  Blockly.Events.disable()
  try {
    Blockly.serialization.workspaces.load(state, workspace)
    return generateFromWorkspace(workspace)
  } finally {
    Blockly.Events.enable()
    workspace.dispose()
  }
}
