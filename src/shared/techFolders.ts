// Carpetas de la pantalla de investigación con su nombre del juego y su DLC. Puro: el proceso
// principal le pasa lo leído (localización, technology_tags y la carpeta dlc/).
import { bodies, children } from './gameTraits'

export interface FolderInfo {
  id: string
  /** Nombre que muestra el juego (un solo idioma) */
  name: string
  /** Nombre del DLC del que depende, si depende de alguno */
  dlc?: string
  /** El DLC está instalado (o no depende de ninguno) */
  active: boolean
  /** Otra carpeta de un DLC instalado la reemplaza: no se usa de verdad */
  replacedBy?: string
  /** Se muestra por omisión (activa y no reemplazada) */
  visible: boolean
}

/** por verificar: prefijos de carpetas de DLC y su nombre */
export const DLC_PREFIX: Record<string, string> = {
  nsb: 'No Step Back',
  mtg: 'Man the Guns',
  bba: 'By Blood Alone',
  lar: 'La Résistance',
  tgb: 'Together for Victory',
  wtt: 'Waking the Tiger',
  gfm: 'Götterdämmerung'
}

/**
 * por verificar: cómo se declara la condición de DLC de una carpeta en common/technology_tags.
 * Se busca cualquier bloque `nombre = { … has_dlc = "DLC" … }` y se asocia la carpeta por su nombre.
 */
export function parseTechTags(text: string): Record<string, string> {
  const out: Record<string, string> = {}
  const walk = (body: string): void => {
    for (const c of children(body)) {
      // solo la condición del propio bloque (no la de bloques anidados)
      const dlc = /has_dlc\s*=\s*"([^"]+)"/.exec(
        c.body.replace(/[A-Za-z0-9_]+\s*=\s*\{[^{}]*\}/g, '')
      )?.[1]
      if (dlc) out[c.id] = dlc
      walk(c.body)
    }
  }
  walk(text)
  for (const b of bodies(text, 'technology_tags')) walk(b)
  return out
}

const prefixOf = (id: string): string | undefined => {
  const t = id.toLowerCase()
  return Object.keys(DLC_PREFIX).find(
    (p) => t.startsWith(p) && (t[p.length] === '_' || !t.includes('_'))
  )
}

/** Nombre canónico de una carpeta sin prefijo de DLC, guiones ni sufijo (para detectar reemplazos) */
export function folderCanon(id: string): string {
  let t = id.toLowerCase()
  const p = prefixOf(id)
  if (p) t = t.slice(p.length)
  return t.replace(/_/g, '').replace(/(folder|techs)$/, '')
}

const dlcOfPrefix = (id: string): string | undefined => {
  const p = prefixOf(id)
  return p ? DLC_PREFIX[p] : undefined
}

const human = (id: string): string => {
  const t = folderCanon(id).replace(/_/g, ' ')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function buildFolders(input: {
  folders: string[]
  /** id de carpeta → nombre ya resuelto en el idioma elegido (si lo hay) */
  names: Record<string, string>
  /** id de carpeta (o etiqueta) → clave del DLC que exige */
  conditions: Record<string, string>
  /** Nombres de los DLC instalados (carpeta dlc/ del juego) */
  installedDlc: string[]
}): FolderInfo[] {
  const norm = (t: string): string => t.toLowerCase().replace(/[^a-z0-9]/g, '')
  const installed = input.installedDlc.map(norm)
  const dlcInstalled = (...keys: (string | undefined)[]): boolean =>
    keys.some((k) => k && installed.some((d) => d.includes(norm(k)) || norm(k).includes(d)))
  const base = input.folders.map((id) => {
    const cond = input.conditions[id]
    const prefix = prefixOf(id)
    const label = dlcOfPrefix(id) ?? cond
    const needs = cond !== undefined || dlcOfPrefix(id) !== undefined
    const active = !needs || dlcInstalled(cond, dlcOfPrefix(id), prefix, label)
    return { id, label, active }
  })
  const out: FolderInfo[] = base.map((f) => ({
    id: f.id,
    name: input.names[f.id] ?? human(f.id),
    ...(f.label ? { dlc: f.label } : {}),
    active: f.active,
    visible: true
  }))
  // Una carpeta de DLC instalado reemplaza a la normal del mismo nombre
  for (const f of out) {
    if (!f.dlc || !f.active) continue
    const normal = out.find((g) => g !== f && !g.dlc && folderCanon(g.id) === folderCanon(f.id))
    if (normal) normal.replacedBy = f.id
  }
  for (const f of out) f.visible = f.active && !f.replacedBy
  return out.sort((a, b) => a.name.localeCompare(b.name, 'es'))
}
