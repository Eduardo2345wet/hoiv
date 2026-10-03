// Ajustes de la app y lectura OPCIONAL del contenido del juego base.
// Si no hay carpeta de HOI4, la interfaz usa una lista integrada corta.
import type { ExportManifest } from './export'
import { collectStateNames, listLocFiles } from './stateNames'
import { readTopLevelCapital } from '../shared/countryHistory'
import fs from 'fs'
import path from 'path'
import { shineShape } from '../shared/shine'
import { parseFocusFile } from '../shared/gameFocus'
import { parseTechnologies, topLevelKeys, type GameTech } from '../shared/gameTech'
import { parseBuildings, parseStateCategories } from '../shared/gameBuildings'
import { parseEquipments, parseSubUnits, type GameSubUnit } from '../shared/gameUnits'
import { parseTraits, type GameTrait } from '../shared/gameTraits'

export interface Settings {
  gamePath: string | null
  /** true = la ruta la encontró la app sola (se vuelve a detectar si deja de existir) */
  gamePathAuto?: boolean
  /** Proyectos abiertos hace poco (más reciente primero) */
  recent?: RecentProject[]
  /** Proyectos que estaban abiertos en pestañas al cerrar la app */
  openTabs?: string[]
  /** Volver a abrir las pestañas al iniciar (por defecto sí) */
  restoreTabs?: boolean
  /** Preguntar siempre dónde guardar (por defecto sí) */
  askWhereToSave?: boolean
  /** Última carpeta elegida en "Exportar mod" */
  lastExportDir?: string
  /** supported_version de reserva si no se puede leer la versión del juego (editable en Ajustes) */
  supportedVersion?: string
  recentIdeas?: string[]
  /** Modo ligero: texturas a la mitad, sin animaciones y libera el mapa al minimizar */
  lightMode?: boolean
  recentStates?: number[]
  /** Última exportación de cada mod (slug → archivos y hashes) para "Revisar mod instalado" */
  lastExports?: Record<string, ExportManifest>
}

export interface RecentProject {
  path: string
  name: string
  template: string
  /** ISO */
  date: string
}

export function loadSettings(file: string): Settings {
  try {
    return { gamePath: null, gamePathAuto: false, ...JSON.parse(fs.readFileSync(file, 'utf-8')) }
  } catch {
    return { gamePath: null, gamePathAuto: false }
  }
}

export function saveSettings(file: string, s: Settings): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(s, null, 2), 'utf-8')
}

/** Quita comentarios (# ...) respetando comillas */
function stripComments(text: string): string {
  return text
    .split('\n')
    .map((l) => {
      let q = false
      for (let i = 0; i < l.length; i++) {
        if (l[i] === '"') q = !q
        if (l[i] === '#' && !q) return l.slice(0, i)
      }
      return l
    })
    .join('\n')
}

/** common/country_tags/*.txt → [tag, archivo] */
export function parseCountryTags(text: string): string[] {
  const tags: string[] = []
  for (const m of stripComments(text).matchAll(/^\s*([A-Z][A-Z0-9]{2})\s*=/gm)) tags.push(m[1])
  return tags
}

/** common/ideas/*.txt → ids de ideas (claves de 3er nivel: ideas = { categoría = { ID = {...} } }) */
export function parseIdeaIds(text: string): string[] {
  const ids: string[] = []
  const tokens = stripComments(text).match(/"[^"]*"|[{}=]|[^\s{}=]+/g) ?? []
  const stack: string[] = []
  let lastKey: string | null = null
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t === '{') {
      stack.push(lastKey ?? '')
      if (
        stack.length === 3 &&
        stack[0] === 'ideas' &&
        lastKey &&
        !['designer', 'law', 'use_list_view'].includes(lastKey)
      )
        ids.push(lastKey)
      lastKey = null
    } else if (t === '}') {
      stack.pop()
      lastKey = null
    } else if (t === '=') {
      // la clave es el token anterior
    } else {
      lastKey = tokens[i + 1] === '=' ? t : null
    }
  }
  return ids
}

function readDir(dir: string): string[] {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.txt'))
      .map((f) => fs.readFileSync(path.join(dir, f), 'utf-8'))
  } catch {
    return []
  }
}

/** Lee todos los .txt de una carpeta como [nombre, contenido] */
function readDirNamed(dir: string, ext = '.txt'): [string, string][] {
  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(ext))
      .map((f): [string, string] => [f, fs.readFileSync(path.join(dir, f), 'utf-8')])
  } catch {
    return []
  }
}

/** history/states/*.txt → id, clave de nombre y dueño */
export function parseState(text: string): { id: number; nameKey: string; owner: string } | null {
  const t = stripComments(text)
  const id = t.match(/\bid\s*=\s*(\d+)/)
  if (!id) return null
  const name = t.match(/\bname\s*=\s*"?([A-Za-z0-9_]+)"?/)
  const owner = t.match(/\bowner\s*=\s*([A-Z][A-Z0-9]{2})\b/)
  return { id: Number(id[1]), nameKey: name?.[1] ?? '', owner: owner?.[1] ?? '' }
}

/** Claves "KEY:0 \"Texto\"" de un .yml de localización */
export function parseLocalisation(text: string): Map<string, string> {
  const m = new Map<string, string>()
  for (const r of text.matchAll(/^\s*([A-Za-z0-9_.-]+):\d*\s*"(.*)"\s*$/gm)) m.set(r[1], r[2])
  return m
}

/** common/ideologies → ideología → subideologías (ideologies = { X = { types = { sub = {} } } }) */
export function parseSubideologies(text: string): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  const tokens = stripComments(text).match(/"[^"]*"|[{}=]|[^\s{}=]+/g) ?? []
  const stack: string[] = []
  let lastKey: string | null = null
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]
    if (t === '{') {
      stack.push(lastKey ?? '')
      // ideologies > X > types > SUB
      if (stack.length === 4 && stack[0] === 'ideologies' && stack[2] === 'types' && lastKey)
        (out[stack[1]] ??= []).push(lastKey)
      lastKey = null
    } else if (t === '}') {
      stack.pop()
      lastKey = null
    } else if (t !== '=') lastKey = tokens[i + 1] === '=' ? t : null
  }
  return out
}

export interface GameCatalogResult {
  countries: [string, string][]
  ideas: [string, string][]
  states: { id: number; name: string; owner: string }[]
  subideologies: Record<string, string[]>
  graphicalCultures: string[]
  graphicalCultures2d: string[]
  historyFiles: Record<string, string>
  /** tag → color RGB de common/countries */
  countryColors: Record<string, [number, number, number]>
  /** tag → estado de la capital (capital = N en history/countries) */
  countryCapitals: Record<string, number>
  /** id de todos los focos de common/national_focus del juego */
  focusIds: string[]
  /** tag → prioridad (add) de su árbol propio en el juego */
  focusTreeTags: Record<string, number>
  /** tag → ideología gobernante (ruling_party de set_politics en history/countries) */
  countryRuling: Record<string, string>
  /** Forma (claves en orden) de una entrada real de interface/goals_shine.gfx */
  goalsShineShape?: string
  /** Nombres GFX_report_event_* de interface/eventpictures.gfx */
  eventPictures?: string[]
  /** Nombres GFX_decision_* (sin categorías) y GFX_decision_category_* de interface/*decision*.gfx */
  decisionIcons?: string[]
  /** Rasgos de líderes y consejeros (common/country_leader) y de militares (common/unit_leader) */
  leaderTraits?: GameTrait[]
  /** Tecnologías (common/technologies) y estados de autonomía (common/autonomous_states) */
  technologies?: GameTech[]
  autonomyStates?: string[]
  /** Edificios con su nivel máximo y si van por provincia (common/buildings) */
  buildingMax?: Record<string, { max: number; provincial: boolean }>
  /** Categorías de estado (common/state_category) */
  stateCategories?: string[]
  /** Batallones de common/units y equipos de common/units/equipment */
  subUnits?: GameSubUnit[]
  equipments?: string[]
  unitTraits?: GameTrait[]
  decisionCategoryIcons?: string[]
  /** Cuadrícula del árbol de focos (interface/nationalfocusview.gui) */
  focusGrid?: FocusGrid
}

export interface FocusGrid {
  spacing: { x: number; y: number }
  linkOffsets?: { x: number; y: number }
  linkSpacing?: { x: number; y: number }
}

/** Lee focus_spacing / link_offsets / link_spacing de nationalfocusview.gui (null si no está) */
export function parseFocusGrid(gui: string): FocusGrid | null {
  const pair = (key: string): { x: number; y: number } | undefined => {
    const m = new RegExp(
      `${key}\\s*=\\s*\\{[^}]*?\\bx\\s*=\\s*(-?\\d+)[^}]*?\\by\\s*=\\s*(-?\\d+)`
    ).exec(gui)
    return m ? { x: Number(m[1]), y: Number(m[2]) } : undefined
  }
  const spacing = pair('focus_spacing')
  if (!spacing || spacing.x <= 0 || spacing.y <= 0) return null
  return { spacing, linkOffsets: pair('link_offsets'), linkSpacing: pair('link_spacing') }
}

const cache = new Map<string, GameCatalogResult>()

export function readGameCatalog(gamePath: string): GameCatalogResult | null {
  if (cache.has(gamePath)) return cache.get(gamePath)!
  const tagsDir = path.join(gamePath, 'common', 'country_tags')
  if (!fs.existsSync(tagsDir)) return null

  // Localización en inglés (nombres de países y estados)
  const loc = new Map<string, string>()
  for (const [f, text] of readDirNamed(path.join(gamePath, 'localisation', 'english'), '.yml'))
    if (/countries|state_names/.test(f)) for (const [k, v] of parseLocalisation(text)) loc.set(k, v)

  const tags = [...new Set(readDir(tagsDir).flatMap(parseCountryTags))].sort()
  const ideas = [
    ...new Set(readDir(path.join(gamePath, 'common', 'ideas')).flatMap(parseIdeaIds))
  ].sort()

  const stateNames = collectStateNames(listLocFiles(gamePath, null))
  const states = readDirNamed(path.join(gamePath, 'history', 'states'))
    .map(([, t]) => parseState(t))
    .filter((s): s is NonNullable<typeof s> => !!s)
    .map((s) => ({
      id: s.id,
      name: stateNames.get(s.nameKey) ?? loc.get(s.nameKey) ?? s.nameKey,
      owner: s.owner
    }))
    .sort((a, b) => a.id - b.id)

  const subideologies: Record<string, string[]> = {}
  for (const t of readDir(path.join(gamePath, 'common', 'ideologies')))
    for (const [k, v] of Object.entries(parseSubideologies(t)))
      subideologies[k] = [...(subideologies[k] ?? []), ...v]

  const gc = new Set<string>()
  const gc2 = new Set<string>()
  for (const t of readDir(path.join(gamePath, 'common', 'countries'))) {
    const a = t.match(/graphical_culture\s*=\s*([a-z0-9_]+)/)
    const b = t.match(/graphical_culture_2d\s*=\s*([a-z0-9_]+)/)
    if (a) gc.add(a[1])
    if (b) gc2.add(b[1])
  }

  // "MEX - Mexico.txt" → MEX
  const historyFiles: Record<string, string> = {}
  try {
    for (const f of fs.readdirSync(path.join(gamePath, 'history', 'countries'))) {
      const m = f.match(/^([A-Z][A-Z0-9]{2})\s*-.*\.txt$/)
      if (m) historyFiles[m[1]] = f
    }
  } catch {
    // sin carpeta de historia
  }

  // Capitales: "capital = N" al nivel superior de cada archivo de history/countries
  // (lector con llaves: tolera BOM, sangría y comentarios; ignora bloques con fecha e if/limit)
  const countryCapitals: Record<string, number> = {}
  const countryRuling: Record<string, string> = {}
  for (const [tag, file] of Object.entries(historyFiles))
    try {
      const txt = fs.readFileSync(path.join(gamePath, 'history', 'countries', file), 'latin1')
      const cap = readTopLevelCapital(txt)
      if (cap !== null) countryCapitals[tag] = cap
      // por verificar: ruling_party dentro de set_politics (nombres: democratic, communism…)
      const r = stripComments(txt).match(/set_politics\s*=\s*\{[^}]*?ruling_party\s*=\s*(\w+)/)
      if (r) countryRuling[tag] = r[1]
    } catch {
      // archivo ilegible: sin capital conocida
    }

  // Colores: country_tags (TAG = "countries/X.txt") → color = rgb { R G B } / { R G B }
  const countryColors: Record<string, [number, number, number]> = {}
  for (const t of readDir(tagsDir))
    for (const m of stripComments(t).matchAll(/^\s*([A-Z][A-Z0-9]{2})\s*=\s*"([^"]+)"/gm)) {
      try {
        const txt = fs.readFileSync(path.join(gamePath, 'common', m[2]), 'utf-8')
        const c = txt.match(/\bcolor\s*=\s*(?:rgb\s*)?\{\s*(\d+)\s+(\d+)\s+(\d+)/)
        if (c) countryColors[m[1]] = [Number(c[1]), Number(c[2]), Number(c[3])]
      } catch {
        // archivo de país inexistente
      }
    }

  // Primera entrada con animación de interface/goals_shine.gfx (para comparar con nuestra plantilla)
  let goalsShineShape: string | undefined
  try {
    const gfx = fs.readFileSync(path.join(gamePath, 'interface', 'goals_shine.gfx'), 'utf-8')
    const start = gfx.search(/spriteType\s*=\s*\{/)
    if (start >= 0) {
      let depth = 0
      for (let i = gfx.indexOf('{', start); i < gfx.length; i++) {
        if (gfx[i] === '{') depth++
        else if (gfx[i] === '}' && --depth === 0) {
          goalsShineShape = shineShape(gfx.slice(start, i + 1))
          break
        }
      }
    }
  } catch {
    // sin archivo: no se compara
  }

  // Focos del juego: ids (para no repetirlos) y tags que ya tienen un árbol propio
  const focusIds = new Set<string>()
  const focusTreeTags: Record<string, number> = {}
  for (const t of readDir(path.join(gamePath, 'common', 'national_focus'))) {
    const f = parseFocusFile(t)
    for (const id of f.focusIds) focusIds.add(id)
    Object.assign(focusTreeTags, f.treeTags)
  }

  let focusGrid: FocusGrid | undefined
  try {
    focusGrid =
      parseFocusGrid(
        fs.readFileSync(path.join(gamePath, 'interface', 'nationalfocusview.gui'), 'utf-8')
      ) ?? undefined
  } catch {
    // sin el archivo: se usan las constantes por verificar
  }

  let eventPictures: string[] | undefined
  try {
    const gfx = fs.readFileSync(path.join(gamePath, 'interface', 'eventpictures.gfx'), 'utf-8')
    eventPictures = [
      ...new Set(
        [...gfx.matchAll(/name\s*=\s*"?(GFX_report_event_[A-Za-z0-9_]+)"?/g)].map((m) => m[1])
      )
    ].sort()
  } catch {
    // sin el archivo: solo se ofrecen las propias
  }

  let decisionIcons: string[] | undefined
  let decisionCategoryIcons: string[] | undefined
  try {
    const names = new Set<string>()
    for (const f of fs.readdirSync(path.join(gamePath, 'interface')))
      if (/decision.*\.gfx$/i.test(f))
        for (const m of fs
          .readFileSync(path.join(gamePath, 'interface', f), 'utf-8')
          .matchAll(/name\s*=\s*"?(GFX_decision_[A-Za-z0-9_]+)"?/g))
          names.add(m[1])
    const all = [...names].sort()
    decisionCategoryIcons = all.filter((n) => n.startsWith('GFX_decision_category_'))
    decisionIcons = all.filter((n) => !n.startsWith('GFX_decision_category_'))
  } catch {
    // sin la carpeta: solo se ofrecen las propias
  }

  const readTraits = (dir: string): GameTrait[] | undefined => {
    try {
      const all = new Map<string, GameTrait>()
      for (const f of fs.readdirSync(path.join(gamePath, 'common', dir)))
        if (f.endsWith('.txt'))
          for (const t of parseTraits(
            fs.readFileSync(path.join(gamePath, 'common', dir, f), 'utf-8')
          ))
            all.set(t.id, t)
      return [...all.values()].sort((a, b) => a.id.localeCompare(b.id))
    } catch {
      return undefined
    }
  }
  let technologies: GameTech[] | undefined
  let autonomyStates: string[] | undefined
  try {
    const all = new Map<string, GameTech>()
    for (const f of fs.readdirSync(path.join(gamePath, 'common', 'technologies')))
      if (f.endsWith('.txt'))
        for (const t of parseTechnologies(
          fs.readFileSync(path.join(gamePath, 'common', 'technologies', f), 'utf-8')
        ))
          all.set(t.id, t)
    technologies = [...all.values()]
  } catch {
    // sin la carpeta: no hay lista de tecnologías
  }
  try {
    const keys = new Set<string>()
    for (const f of fs.readdirSync(path.join(gamePath, 'common', 'autonomous_states')))
      if (f.endsWith('.txt'))
        for (const k of topLevelKeys(
          fs.readFileSync(path.join(gamePath, 'common', 'autonomous_states', f), 'utf-8')
        ))
          keys.add(k)
    autonomyStates = [...keys].sort()
  } catch {
    // sin la carpeta: lista integrada
  }
  let buildingMax: Record<string, { max: number; provincial: boolean }> | undefined
  let stateCategories: string[] | undefined
  try {
    const dir = path.join(gamePath, 'common', 'buildings')
    const all: Record<string, { max: number; provincial: boolean }> = {}
    for (const f of fs.readdirSync(dir))
      if (f.endsWith('.txt'))
        for (const b of parseBuildings(fs.readFileSync(path.join(dir, f), 'utf-8')))
          if (b.max > 0) all[b.id] = { max: b.max, provincial: b.provincial }
    if (Object.keys(all).length) buildingMax = all
  } catch {
    // sin la carpeta: máximos de reserva
  }
  try {
    const dir = path.join(gamePath, 'common', 'state_category')
    const all = new Set<string>()
    for (const f of fs.readdirSync(dir))
      if (f.endsWith('.txt'))
        for (const k of parseStateCategories(fs.readFileSync(path.join(dir, f), 'utf-8')))
          all.add(k)
    if (all.size) stateCategories = [...all]
  } catch {
    // sin la carpeta: lista de reserva
  }
  let subUnits: GameSubUnit[] | undefined
  let equipments: string[] | undefined
  try {
    const dir = path.join(gamePath, 'common', 'units')
    const all = new Map<string, GameSubUnit>()
    for (const f of fs.readdirSync(dir))
      if (f.endsWith('.txt'))
        for (const u of parseSubUnits(fs.readFileSync(path.join(dir, f), 'utf-8'))) all.set(u.id, u)
    if (all.size) subUnits = [...all.values()]
  } catch {
    // sin la carpeta: lista de reserva
  }
  try {
    const dir = path.join(gamePath, 'common', 'units', 'equipment')
    const all = new Set<string>()
    for (const f of fs.readdirSync(dir))
      if (f.endsWith('.txt'))
        for (const e of parseEquipments(fs.readFileSync(path.join(dir, f), 'utf-8'))) all.add(e)
    if (all.size) equipments = [...all].sort()
  } catch {
    // sin la carpeta: producción libre
  }
  const leaderTraits = readTraits('country_leader')
  const unitTraits = readTraits('unit_leader')

  const result: GameCatalogResult = {
    subUnits,
    equipments,
    buildingMax,
    stateCategories,
    leaderTraits,
    unitTraits,
    technologies,
    autonomyStates,
    decisionIcons,
    decisionCategoryIcons,
    eventPictures,
    focusGrid,
    focusIds: [...focusIds],
    focusTreeTags,
    goalsShineShape,
    countryColors,
    countryCapitals,
    countryRuling,
    countries: tags.map((t): [string, string] => [t, loc.get(t) ?? t]),
    ideas: ideas.map((i): [string, string] => [i, loc.get(i) ?? i]),
    states,
    subideologies,
    graphicalCultures: [...gc].sort(),
    graphicalCultures2d: [...gc2].sort(),
    historyFiles
  }
  cache.set(gamePath, result)
  return result
}

/** Lee el archivo de historia de un país del juego (nombre EXACTO y contenido) */
export function readCountryHistory(
  gamePath: string,
  fileName: string
): { fileName: string; text: string } | null {
  // Solo nombres simples dentro de history/countries (sin rutas)
  if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) return null
  try {
    const text = fs.readFileSync(path.join(gamePath, 'history', 'countries', fileName), 'utf-8')
    return { fileName, text }
  } catch {
    return null
  }
}
