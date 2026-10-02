// Seguridad de rutas de exportación (la usan la interfaz y el proceso principal): lista negra,
// carpetas permitidas y archivos con el mismo nombre que uno del juego.

/** Parches mínimos registrados: rutas que SÍ pueden llevar el nombre exacto de un archivo del juego */
const PATCH_PATTERNS: RegExp[] = [
  /^history\/states\/[^/]+\.txt$/,
  /^history\/countries\/[^/]+\.txt$/
]
const extraPatches = new Set<string>()
/** Las secciones S6 y S8 registran aquí sus parches mínimos (con la ruta exacta) */
export function registerPatchPath(path: string): void {
  extraPatches.add(path.toLowerCase())
}
export const isRegisteredPatch = (path: string): boolean =>
  PATCH_PATTERNS.some((r) => r.test(path)) || extraPatches.has(path.toLowerCase())

/** Lista blanca de carpetas para archivos nuevos */
const WHITELIST = [
  'common/',
  'events/',
  'history/units/',
  'history/states/',
  'history/countries/',
  'interface/',
  'gfx/',
  'localisation/',
  'sound/',
  'music/'
]
const ROOT_FILES = new Set(['descriptor.mod', 'thumbnail.png'])

/** Archivos que NUNCA se escriben (salvo parche mínimo registrado) */
const BLACKLIST: { test: (p: string) => boolean; why: string }[] = [
  {
    test: (p) => p.startsWith('map/'),
    why: 'los archivos de map/ (un map/definition.csv parcial tumba el juego)'
  },
  {
    test: (p) => p === 'interface/countrytechtreeview.gui',
    why: 'interface/countrytechtreeview.gui (rompe la pantalla de investigación)'
  },
  {
    test: (p) => p === 'music/music.asset',
    why: 'music/music.asset (reemplaza la música del juego)'
  },
  {
    test: (p) => /^common\/characters\/[A-Za-z][A-Za-z0-9]{2}\.txt$/.test(p),
    why: 'common/characters/<TAG>.txt (borra los personajes del país del juego)'
  }
]

export interface RegistryContext {
  /** Rutas (minúsculas) de archivos del juego, si se conocen */
  gameFiles?: Set<string>
}

/** Problemas de UNA ruta (sin mirar duplicados) */
export function pathProblems(
  path: string,
  ctx: RegistryContext = {},
  requirePrefix?: string
): string[] {
  const p = path.replace(/\\/g, '/')
  const lower = p.toLowerCase()
  const out: string[] = []
  if (p.startsWith('/') || p.split('/').includes('..') || /^[a-z]:/i.test(p))
    return [`Ruta no permitida: ${path}`]
  for (const b of BLACKLIST)
    if (b.test(lower) && !extraPatches.has(lower))
      out.push(`No se puede exportar ${path}: ${b.why}.`)
  if (!ROOT_FILES.has(lower) && !WHITELIST.some((w) => lower.startsWith(w)))
    out.push(
      `${path} está fuera de las carpetas permitidas (common/, events/, history/, interface/, gfx/, localisation/, sound/, music/).`
    )
  if (ctx.gameFiles?.has(lower) && !isRegisteredPatch(p))
    out.push(
      `${path} tiene el mismo nombre que un archivo del juego y lo reemplazaría. Usa un nombre propio con el prefijo del mod.`
    )
  if (requirePrefix && !p.split('/').pop()!.toLowerCase().includes(requirePrefix))
    out.push(`${path} no lleva el prefijo del mod (${requirePrefix}).`)
  return out
}
