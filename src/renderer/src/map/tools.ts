// Herramientas del mapa. Cada acción = 1 paso de deshacer (una pincelada completa también).
import { store } from '../store/appStore'
import { addCountry, newCountry } from '../countries/countryOps'

export type ToolId = 'select' | 'brush' | 'bucket' | 'capital' | 'core' | 'eraser' | 'eyedropper'

export interface ToolContext {
  /** Mensaje para la barra inferior */
  say: (msg: string) => void
  /** Opciones del pincel */
  brush: { giveCore: boolean; removePreviousCores: boolean }
}

/** Maneja un trazo (inicio / movimiento / fin) de la herramienta activa */
export function handleStroke(
  tool: ToolId,
  phase: 'start' | 'move' | 'end',
  stateId: number,
  _e: { shift: boolean },
  ctx: ToolContext
): void {
  if (phase === 'end') return
  if (tool === 'select' && phase === 'start') {
    store.set({ selectedStateId: stateId || null })
    if (!stateId) ctx.say('Eso es mar o un lago: no tiene estado.')
  }
}

/**
 * Hace activo un país del mapa. Si es un país del juego que no está en el mod,
 * pregunta si agregarlo como país "existente" (así se puede pintar con él).
 */
export function activateTag(tag: string, label?: string): boolean {
  const p = store.get().project
  if (!p) return false
  if (!p.countries.some((c) => c.tag === tag)) {
    const name = label ?? tag
    if (
      !confirm(
        `${name} (${tag}) es un país del juego que no está en tu mod. ¿Agregarlo como país "existente"?`
      )
    )
      return false
    store.updateProject((pr) => addCountry(pr, newCountry({ mode: 'existente', tag, name })))
  }
  store.set({ activeTag: tag })
  return true
}
