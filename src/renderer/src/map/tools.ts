// Herramientas del mapa. Cada acción = 1 paso de deshacer (una pincelada completa también).
import { store } from '../store/appStore'
import { addCountry, newCountry } from '../countries/countryOps'
import {
  addCore,
  connectedSameOwner,
  effectiveOwner,
  eraseStates,
  paintStates,
  removeCore,
  setCapital
} from './mapOps'

export type ToolId = 'select' | 'brush' | 'bucket' | 'capital' | 'core' | 'eraser' | 'eyedropper'

export interface ToolContext {
  /** Mensaje para la barra inferior */
  say: (msg: string) => void
  /** Opciones del pincel */
  brush: { giveCore: boolean; removePreviousCores: boolean }
}

let strokeCounter = 0
let strokeGroup = ''

/** Maneja un trazo (inicio / movimiento / fin) de la herramienta activa */
export function handleStroke(
  tool: ToolId,
  phase: 'start' | 'move' | 'end',
  stateId: number,
  e: { shift: boolean },
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

  if (tool === 'select') {
    if (phase !== 'start') return
    store.set({ selectedStateId: stateId || null })
    if (!stateId) ctx.say('Eso es mar o un lago: no tiene estado.')
    return
  }
  if (!state) {
    if (phase === 'start') ctx.say('El mar y los lagos no se pueden pintar.')
    return
  }

  if (tool === 'eyedropper') {
    if (phase !== 'start') return
    const owner = effectiveOwner(state, project)
    if (activateTag(owner, store.catalogGame()?.countries.find(([t]) => t === owner)?.[1]))
      ctx.say(`País activo: ${owner}`)
    return
  }

  if (tool === 'eraser') {
    store.updateProject((p) => eraseStates(p, [state.id]), { group: strokeGroup })
    return
  }

  // El resto asigna cosas al país activo
  if (!activeTag) {
    if (phase === 'start') ctx.say('Primero elige o crea un país.')
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
    const ids = connectedSameOwner(project, map, state.id)
    if (
      ids.length > 30 &&
      !confirm(`La cubeta va a pintar ${ids.length} estados conectados. ¿Continuar?`)
    )
      return
    store.updateProject((p) => paintStates(p, map, ids, activeTag, ctx.brush))
    ctx.say(`${ids.length} estado(s) pintados para ${activeTag}.`)
  } else if (tool === 'capital') {
    const country = project.countries.find((c) => c.tag === activeTag)
    if (!country) return ctx.say('Ese país no está en el mod.')
    const res = setCapital(project, map, country.uid, state.id)
    if (typeof res === 'string') ctx.say(res)
    else {
      store.updateProject(() => res)
      ctx.say(`Capital de ${activeTag}: ${state.name}.`)
    }
  } else if (tool === 'core') {
    if (e.shift) {
      store.updateProject((p) => removeCore(p, map, state.id, activeTag))
      ctx.say(`Core de ${activeTag} quitado de ${state.name}.`)
    } else {
      store.updateProject((p) => addCore(p, map, state.id, activeTag))
      ctx.say(`Core de ${activeTag} agregado a ${state.name}. (Shift+clic para quitar)`)
    }
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
