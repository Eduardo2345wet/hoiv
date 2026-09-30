// Operaciones puras sobre los cambios del mapa (stateEdits). Se pinta por ESTADO:
// nunca se mueven provincias entre estados. Devuelven un proyecto NUEVO.
import type { Project, StateEdit } from '../types'
import type { MapData, MapState } from '../../../shared/map/types'

export type StateLookup = Map<number, MapState>
export const lookup = (map: MapData): StateLookup => new Map(map.states.map((s) => [s.id, s]))

export function effectiveOwner(s: MapState, p: Project): string {
  return p.stateEdits[s.id]?.owner ?? s.owner
}

export function effectiveCores(s: MapState, p: Project): string[] {
  const e = p.stateEdits[s.id]
  const set = new Set(s.cores)
  for (const t of e?.addCores ?? []) set.add(t)
  for (const t of e?.removeCores ?? []) set.delete(t)
  return [...set].sort()
}

/** Guarda el cambio de un estado dejándolo mínimo; si ya es igual al original, lo borra */
function withEdit(p: Project, s: MapState, owner: string, cores: string[]): Project {
  const orig = new Set(s.cores)
  const now = new Set(cores)
  const edit: StateEdit = {}
  if (owner !== s.owner) edit.owner = owner
  const add = [...now].filter((t) => !orig.has(t)).sort()
  const remove = [...orig].filter((t) => !now.has(t)).sort()
  if (add.length) edit.addCores = add
  if (remove.length) edit.removeCores = remove
  const edits = { ...p.stateEdits }
  if (Object.keys(edit).length) edits[s.id] = edit
  else delete edits[s.id]
  return { ...p, stateEdits: edits }
}

export function isChanged(s: MapState, p: Project): boolean {
  return !!p.stateEdits[s.id]
}

export interface PaintOptions {
  /** Dar core al pintar (por defecto sí) */
  giveCore: boolean
  /** Quitar los cores del dueño anterior (por defecto no) */
  removePreviousCores: boolean
}

/** Pincel / cubeta: los estados pasan al país `tag` */
export function paintStates(
  p: Project,
  map: MapData,
  ids: number[],
  tag: string,
  opts: PaintOptions = { giveCore: true, removePreviousCores: false }
): Project {
  const byId = lookup(map)
  let next = p
  for (const id of ids) {
    const s = byId.get(id)
    if (!s) continue
    const prev = effectiveOwner(s, next)
    let cores = effectiveCores(s, next)
    if (opts.removePreviousCores && prev !== tag) cores = cores.filter((c) => c !== prev)
    if (opts.giveCore && !cores.includes(tag)) cores = [...cores, tag]
    next = withEdit(next, s, tag, cores)
  }
  return next
}

/** Cubeta: estados conectados por tierra con el mismo dueño que el estado clicado */
export function connectedSameOwner(p: Project, map: MapData, startId: number): number[] {
  const byId = lookup(map)
  const start = byId.get(startId)
  if (!start) return []
  const owner = effectiveOwner(start, p)
  const seen = new Set([startId])
  const queue = [startId]
  while (queue.length) {
    const id = queue.shift()!
    for (const n of map.stateAdjacency[id] ?? []) {
      if (seen.has(n)) continue
      const s = byId.get(n)
      if (s && effectiveOwner(s, p) === owner) {
        seen.add(n)
        queue.push(n)
      }
    }
  }
  return [...seen].sort((a, b) => a - b)
}

export function addCore(p: Project, map: MapData, id: number, tag: string): Project {
  const s = lookup(map).get(id)
  if (!s) return p
  const cores = effectiveCores(s, p)
  return cores.includes(tag) ? p : withEdit(p, s, effectiveOwner(s, p), [...cores, tag])
}

export function removeCore(p: Project, map: MapData, id: number, tag: string): Project {
  const s = lookup(map).get(id)
  if (!s) return p
  return withEdit(
    p,
    s,
    effectiveOwner(s, p),
    effectiveCores(s, p).filter((c) => c !== tag)
  )
}

/** Borrador: el estado vuelve a su dueño y cores originales */
export function eraseStates(p: Project, ids: number[]): Project {
  if (!ids.some((id) => p.stateEdits[id])) return p
  const edits = { ...p.stateEdits }
  for (const id of ids) delete edits[id]
  return { ...p, stateEdits: edits }
}

/** Estados (ids) que tiene un país ahora mismo */
export function countryStates(p: Project, map: MapData, tag: string): number[] {
  return map.states.filter((s) => effectiveOwner(s, p) === tag).map((s) => s.id)
}

/** Fijar capital: solo si el estado es del país. Devuelve el proyecto o un mensaje de error */
export function setCapital(
  p: Project,
  map: MapData,
  countryUid: string,
  id: number
): Project | string {
  const c = p.countries.find((x) => x.uid === countryUid)
  const s = lookup(map).get(id)
  if (!c || !s) return 'No se encontró el país o el estado.'
  const owner = effectiveOwner(s, p)
  if (owner !== c.tag)
    return `El estado ${s.name} pertenece a ${owner}, no a ${c.tag}. Primero píntalo con el pincel para que sea suyo.`
  return {
    ...p,
    countries: p.countries.map((x) => (x.uid === countryUid ? { ...x, capital: id } : x))
  }
}

/** ¿Es un estado de tierra pintable? (el mar y los lagos no tienen estado) */
export function stateAtPixel(map: MapData, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return 0
  return map.provinceToState[map.provinceIndex[Math.floor(y) * map.width + Math.floor(x)]]
}
