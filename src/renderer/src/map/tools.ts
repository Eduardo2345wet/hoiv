// Herramientas del mapa. Cada acción = 1 paso de deshacer (una pincelada completa también).
import { store } from '../store/appStore'
import { NO_NATION, countryLabel, setBrush } from './brush'
import { isPainted } from './colors'
import {
  addCore,
  connectedSameOwner,
  effectiveOwner,
  eraseStates,
  paintStates,
  removeCore,
  setCapital,
  type PaintOptions
} from './mapOps'

export type ToolId = 'select' | 'brush' | 'bucket' | 'capital' | 'core' | 'eraser' | 'eyedropper'

/** Herramientas que pintan o borran (el clic derecho borra con ellas) */
export const PAINT_TOOLS: ToolId[] = ['brush', 'bucket', 'eraser', 'eyedropper']

export interface ToolContext {
  /** Aviso pequeño (toast); nunca ventanas durante el pintado */
  toast: (msg: string, opts?: { undo?: boolean; error?: boolean }) => void
  /** Opciones del pincel */
  brush: PaintOptions
}

let strokeCounter = 0
let strokeGroup = ''

/** ¿Lienzo en blanco? (los estados sin pintar se ven blancos) */
const isBlank = (): boolean => store.get().project?.mapSettings?.base === 'blank'

/**
 * Clave de "color" de un estado para la cubeta: en el lienzo en blanco, todos los estados
 * sin pintar son del mismo color (blanco), aunque en la base tengan dueños distintos.
 */
function colorKeyOf(id: number): string {
  const { map, project } = store.get()
  const s = map?.states.find((x) => x.id === id)
  if (!s || !project) return ''
  if (isBlank() && !isPainted(id, project)) return '\u0000blanco'
  return effectiveOwner(s, project)
}

/** Maneja un trazo (inicio / movimiento / fin) de la herramienta activa */
export function handleStroke(
  tool: ToolId,
  phase: 'start' | 'move' | 'end',
  stateId: number,
  e: { shift: boolean; erase?: boolean },
  ctx: ToolContext
): void {
  const { map, project, activeTag } = store.get()
  if (!map || !project) return

  // Fin del trazo: la pincelada completa queda como UN paso de deshacer
  if (phase === 'end') {
    store.endGroup()
    return
  }
  if (phase === 'start') strokeGroup = `drag:mapa-${++strokeCounter}`
  const state = stateId ? map.states.find((s) => s.id === stateId) : undefined
  const game = store.catalogGame()

  if (tool === 'select') {
    if (phase !== 'start') return
    store.set({ selectedStateId: stateId || null })
    return
  }
  if (!state) {
    if (phase === 'start' && PAINT_TOOLS.includes(tool))
      ctx.toast('El mar y los lagos no se pueden pintar.')
    return
  }

  // Clic derecho = borrar (como el segundo color de Paint); también el Borrador y el pincel "Sin nación"
  const erasing =
    tool === 'eraser' ||
    (!!e.erase && PAINT_TOOLS.includes(tool)) ||
    (tool === 'brush' && activeTag === NO_NATION)
  if (erasing) {
    store.updateProject((p) => eraseStates(p, [state.id]), { group: strokeGroup })
    return
  }

  if (tool === 'eyedropper') {
    if (phase !== 'start') return
    if (isBlank() && !isPainted(state.id, project)) {
      // Estado sin pintar: en modo Sin nación, el pincel pasa a ser "Sin nación"
      if (project.mapSettings.unpainted === 'noNation') {
        setBrush(NO_NATION)
        ctx.toast('Pincel: Sin nación (devuelve estados a pendiente)')
      } else ctx.toast('Ese estado está sin pintar.')
      return
    }
    const owner = effectiveOwner(state, project)
    setBrush(owner)
    ctx.toast(`Pincel: ${countryLabel(owner, project, game)} (${owner})`)
    return
  }

  // El resto asigna cosas al país activo
  if (!activeTag) {
    if (phase === 'start') ctx.toast('Primero elige un color en la Paleta (o crea un país rápido).')
    return
  }

  if (tool === 'brush') {
    store.updateProject((p) => paintStates(p, map, [state.id], activeTag, ctx.brush), {
      group: strokeGroup
    })
    return
  }
  if (phase !== 'start') return

  if (tool === 'bucket') {
    if (activeTag === NO_NATION) {
      const ids = connectedSameOwner(project, map, state.id, colorKeyOf)
      store.updateProject((p) => eraseStates(p, ids))
      ctx.toast(`Devolviste ${ids.length} estado(s) a pendiente`, { undo: true })
      return
    }
    const ids = connectedSameOwner(project, map, state.id, colorKeyOf)
    store.updateProject((p) => paintStates(p, map, ids, activeTag, ctx.brush))
    ctx.toast(`Pintaste ${ids.length} estado(s)`, { undo: true })
  } else if (tool === 'capital') {
    const country = project.countries.find((c) => c.tag === activeTag)
    if (!country)
      return ctx.toast('Ese país no está en tu mod: usa "Editar este país…" en la Paleta.', {
        error: true
      })
    const res = setCapital(project, map, country.uid, state.id)
    if (typeof res === 'string')
      ctx.toast('Ese estado no es de tu país: píntalo primero.', { error: true })
    else {
      store.updateProject(() => res)
      ctx.toast(`Capital de ${country.names.name || activeTag}: ${state.name}`, { undo: true })
    }
  } else if (tool === 'core') {
    if (activeTag === NO_NATION) return ctx.toast('"Sin nación" no tiene cores.', { error: true })
    if (e.shift) {
      store.updateProject((p) => removeCore(p, map, state.id, activeTag))
      ctx.toast(`Core de ${activeTag} quitado de ${state.name}`, { undo: true })
    } else {
      store.updateProject((p) => addCore(p, map, state.id, activeTag))
      ctx.toast(`Core de ${activeTag} agregado a ${state.name} (Shift+clic para quitar)`, {
        undo: true
      })
    }
  }
}

/** Hace activo un país del mapa sin preguntar nada (sigue existiendo por compatibilidad) */
export function activateTag(tag: string): boolean {
  setBrush(tag)
  return true
}
