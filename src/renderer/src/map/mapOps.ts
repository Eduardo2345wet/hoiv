// Operaciones puras sobre los cambios del mapa (stateEdits). Se pinta por ESTADO:
// nunca se mueven provincias entre estados. Devuelven un proyecto NUEVO.
import type { Project, StateEdit } from '../types'
import type { MapData, MapState } from '../../../shared/map/types'

export type StateLookup = Map<number, MapState>
export const lookup = (map: MapData): StateLookup => new Map(map.states.map((s) => [s.id, s]))

/** Tag del país técnico "Sin nación" del proyecto ('' si no hay) */
const technicalTag = (p: Project): string => p.countries.find((c) => c.technical)?.tag ?? ''

/**
 * Dueño de un estado a partir de su edición (o ninguna). Es la regla ÚNICA de "dueño efectivo":
 * el dueño TAL COMO SE VE en el mapa del proyecto, '' = en blanco (ningún país).
 *  - Lienzo en blanco (con o sin Sin nación): el pintado; si no está pintado, en blanco.
 *  - Mapa del juego / de un mod: el pintado; si no, el de la base.
 *  - El país técnico "Sin nación" cuenta como en blanco.
 */
export function ownerOf(s: MapState, edit: StateEdit | undefined, p: Project): string {
  const o = edit?.owner ?? (p.mapSettings.base === 'blank' ? '' : s.owner)
  return o && o === technicalTag(p) ? '' : o
}

export function effectiveOwner(s: MapState, p: Project): string {
  return ownerOf(s, p.stateEdits[s.id], p)
}

/** Dueño pintado o, si no, el de la base (aunque el mapa esté en blanco): para validar */
export const ownerWithBase = (s: MapState, p: Project): string =>
  p.stateEdits[s.id]?.owner ?? s.owner

// ---- Conteos de estados por dueño (con memoria e incrementales) ----
export const ownerCountStats = { full: 0, incremental: 0 }
let ocCache: {
  map: MapData
  base: string
  tech: string
  edits: Record<string, StateEdit>
  counts: Map<string, number>
  byId: Map<number, MapState>
} | null = null

/** Olvida los conteos (al abrir un proyecto o cambiar de pestaña: se recalcula completo una vez) */
export const resetOwnerCounts = (): void => {
  ocCache = null
}

/**
 * Estados que tiene cada país según effectiveOwner (sin los "en blanco"). Con la misma base se
 * actualiza SOLO con los estados cuya edición cambió; al cambiar de mapa, plantilla o proyecto
 * (otra pestaña) se recalcula completo una vez. No modificar el Map devuelto.
 */
export function getOwnerCounts(map: MapData, p: Project): Map<string, number> {
  const base = p.mapSettings.base ?? ''
  const tech = technicalTag(p)
  const c = ocCache
  if (c && c.map === map && c.base === base && c.tech === tech) {
    if (c.edits === p.stateEdits) return c.counts
    const counts = new Map(c.counts)
    const bump = (o: string, d: number): void => {
      if (!o) return
      const n = (counts.get(o) ?? 0) + d
      if (n > 0) counts.set(o, n)
      else counts.delete(o)
    }
    const ids = new Set([...Object.keys(c.edits), ...Object.keys(p.stateEdits)])
    for (const id of ids) {
      const a = c.edits[id]
      const b = p.stateEdits[id]
      if (a === b) continue
      const s = c.byId.get(Number(id))
      if (!s) continue
      bump(ownerOf(s, a, p), -1)
      bump(ownerOf(s, b, p), 1)
    }
    ownerCountStats.incremental++
    ocCache = { ...c, edits: p.stateEdits, counts }
    return counts
  }
  ownerCountStats.full++
  const counts = new Map<string, number>()
  const byId = new Map<number, MapState>()
  for (const s of map.states) {
    byId.set(s.id, s)
    const o = ownerOf(s, p.stateEdits[s.id], p)
    if (o) counts.set(o, (counts.get(o) ?? 0) + 1)
  }
  ocCache = { map, base, tech, edits: p.stateEdits, counts, byId }
  return counts
}

export function effectiveCores(s: MapState, p: Project): string[] {
  const e = p.stateEdits[s.id]
  const set = new Set(s.cores)
  for (const t of e?.addCores ?? []) set.add(t)
  for (const t of e?.removeCores ?? []) set.delete(t)
  return [...set].sort()
}

/**
 * Guarda el cambio de un estado dejándolo mínimo; si ya es igual al original, lo borra.
 * `owner` undefined = sin cambio de dueño. `keepOwner` = guardar el dueño aunque sea el
 * original (en el lienzo en blanco, así el estado cuenta como "pintado").
 */
function withEdit(
  p: Project,
  s: MapState,
  owner: string | undefined,
  cores: string[],
  keepOwner = false
): Project {
  const orig = new Set(s.cores)
  const now = new Set(cores)
  // Lo que no es dueño ni cores (población, edificios…) se conserva
  const { owner: _o, addCores: _a, removeCores: _r, ...kept } = p.stateEdits[s.id] ?? {}
  void _o
  void _a
  void _r
  const edit: StateEdit = { ...kept }
  if (owner !== undefined && (owner !== s.owner || keepOwner)) edit.owner = owner
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
  const e = p.stateEdits[s.id]
  return !!e && (e.owner !== undefined || !!e.addCores?.length || !!e.removeCores?.length)
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
    next = withEdit(next, s, tag, cores, p.mapSettings?.base === 'blank')
  }
  return next
}

/**
 * Cubeta: estados conectados por tierra con el mismo "color" que el estado clicado
 * (por defecto, el mismo dueño; en el lienzo en blanco, los blancos van juntos).
 */
export function connectedSameOwner(
  p: Project,
  map: MapData,
  startId: number,
  keyOf?: (id: number) => string
): number[] {
  const byId = lookup(map)
  const start = byId.get(startId)
  if (!start) return []
  const key = keyOf ?? ((id: number) => effectiveOwner(byId.get(id)!, p))
  const owner = key(startId)
  const seen = new Set([startId])
  const queue = [startId]
  while (queue.length) {
    const id = queue.shift()!
    for (const n of map.stateAdjacency[id] ?? []) {
      if (seen.has(n)) continue
      const s = byId.get(n)
      if (s && key(n) === owner) {
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
  return cores.includes(tag) ? p : withEdit(p, s, p.stateEdits[s.id]?.owner, [...cores, tag], true)
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
  for (const id of ids) {
    // El borrador devuelve dueño y cores; población, edificios, etc. se conservan
    const { owner: _o, addCores: _a, removeCores: _r, ...kept } = edits[id] ?? {}
    void _o
    void _a
    void _r
    if (Object.keys(kept).length) edits[id] = kept
    else delete edits[id]
  }
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
