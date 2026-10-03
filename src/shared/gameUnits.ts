// Batallones (common/units) y equipos (common/units/equipment) del juego, para el editor de ejército.
import { entries, topValue } from './gameBuildings'
import { tokenizePdx } from './countryHistory'

export interface GameSubUnit {
  id: string
  /** `group` del archivo (infantry, mobile, armor, support, combat_support…); vacío en aéreas y navales */
  group: string
  /** `type` del archivo, con sus palabras separadas por espacio ("infantry artillery"; en el juego es un bloque) */
  type?: string
  /** `map_icon_category` del archivo (infantry, armored, ship, other…) */
  mapIcon?: string
  /** `sprite` del archivo (nombre del dibujo del batallón) */
  sprite?: string
  /** Sprite GFX_… de interface/*.gfx que se usa como ícono (si se encontró) */
  gfx?: string | null
}

const unquote = (v: string): string => v.replace(/^"|"$/g, '')

/**
 * Confirmado en common/units de 1.19.3: `sub_units = { infantry = { group = infantry … } }`, y
 * `type` puede ser un valor (`type = infantry`) o un bloque (`type = { infantry artillery }`).
 * Lector tolerante: un archivo puede traer varios `sub_units`.
 */
export function parseSubUnits(text: string): GameSubUnit[] {
  const t = tokenizePdx(text)
  const out: GameSubUnit[] = []
  for (let i = 0; i + 2 < t.length; i++) {
    if (t[i].v !== 'sub_units' || t[i + 1].v !== '=' || t[i + 2].v !== '{') continue
    const outer = t[i + 2].depth
    let j = i + 3
    for (; j < t.length && !(t[j].v === '}' && t[j].depth === outer); j++) {
      // una unidad: `id = {` justo dentro de sub_units
      if (t[j].depth !== outer + 1 || t[j + 1]?.v !== '=' || t[j + 2]?.v !== '{') continue
      const d = t[j + 2].depth
      const u: GameSubUnit = { id: t[j].v, group: '' }
      let k = j + 3
      for (; k < t.length && !(t[k].v === '}' && t[k].depth === d); k++) {
        if (t[k].depth !== d + 1 || t[k + 1]?.v !== '=' || !t[k + 2]) continue
        const key = t[k].v
        const val = t[k + 2]
        if (val.v === '{' && key === 'type') {
          const words: string[] = []
          for (let m = k + 3; m < t.length && !(t[m].v === '}' && t[m].depth === val.depth); m++)
            if (t[m].depth === val.depth + 1) words.push(unquote(t[m].v))
          if (words.length) u.type = words.join(' ')
        } else if (val.v !== '{' && val.v !== '}') {
          const v = unquote(val.v)
          if (key === 'group') u.group = v
          else if (key === 'type') u.type = v
          else if (key === 'map_icon_category') u.mapIcon = v
          else if (key === 'sprite') u.sprite = v
        }
      }
      out.push(u)
      j = k
    }
    i = j
  }
  return out
}

/** Equipos: claves de `equipments = { … }` que no son solo arquetipos */
export function parseEquipments(text: string): string[] {
  return entries(text, 'equipments')
    .filter(({ body }) => topValue(body, 'is_archetype') !== 'yes')
    .map((e) => e.key)
}

// ---------------------------------------------------------------- categorías terrestres

/** Tipos de batallón que caben en una plantilla de división (solo tierra) */
export type UnitCategory = 'infantry' | 'mobile' | 'armor' | 'artillery' | 'support'

export const UNIT_CATEGORIES: { id: UnitCategory; label: string }[] = [
  { id: 'infantry', label: 'Infantería' },
  { id: 'mobile', label: 'Móviles' },
  { id: 'armor', label: 'Blindados' },
  { id: 'artillery', label: 'Artillería, antitanque y antiaérea' },
  { id: 'support', label: 'Apoyo' }
]

/**
 * Los `group` de las unidades terrestres, leídos de TODOS los archivos de common/units de 1.19.3
 * (122 terrestres): infantry (13), mobile (9), armor (11), support (68), combat_support (4: artillería,
 * antitanque y antiaérea de línea), mobile_combat_support (5: las motorizadas) y armor_combat_support
 * (12: autopropulsadas y cazacarros). Las 36 sin `group` son aéreas (25), navales (9) y cañones de tren (2).
 */
const LAND_GROUPS: Record<string, UnitCategory> = {
  infantry: 'infantry',
  mobile: 'mobile',
  armor: 'armor',
  support: 'support',
  combat_support: 'artillery',
  mobile_combat_support: 'artillery',
  armor_combat_support: 'artillery'
}
/** `map_icon_category` de los barcos; las terrestres usan infantry o armored (y other la caballería) */
const NAVAL_ICON = 'ship'
const LAND_ICONS = new Set(['infantry', 'armored'])

/** Categoría por las palabras de `type` (grupos que no conocemos, p. ej. los de un mod) */
function categoryByType(words: string[]): UnitCategory | null {
  const has = (...w: string[]): boolean => w.some((x) => words.includes(x))
  if (has('support')) return 'support'
  if (has('artillery', 'anti_air', 'anti_tank')) return 'artillery'
  if (has('armor')) return 'armor'
  if (has('motorized', 'mechanized')) return 'mobile'
  if (has('infantry', 'cavalry')) return 'infantry'
  return null
}

/**
 * Categoría terrestre de un batallón, o null si no es terrestre (aéreo, naval, misil o cañón de tren).
 * 1) un `group` conocido manda; 2) con otro `group`, se decide por las palabras de `type`;
 * 3) sin `group`, solo cuenta si su ícono de mapa es terrestre. Un `map_icon_category = ship` nunca es terrestre.
 */
export function unitCategory(u: {
  id?: string
  group: string
  type?: string
  mapIcon?: string
}): UnitCategory | null {
  const icon = (u.mapIcon ?? '').toLowerCase()
  if (icon === NAVAL_ICON) return null
  const group = u.group.toLowerCase()
  const byGroup = LAND_GROUPS[group]
  if (byGroup) return byGroup
  if (!group && !LAND_ICONS.has(icon)) return null
  return categoryByType((u.type ?? '').toLowerCase().split(/\s+/).filter(Boolean))
}

// ---------------------------------------------------------------- nombres

/** Nombres en español de los batallones del juego base (reserva si el juego no trae localización) */
export const UNIT_NAMES_ES: Record<string, string> = {
  infantry: 'Infantería',
  cavalry: 'Caballería',
  motorized: 'Motorizada',
  mechanized: 'Mecanizada',
  marine: 'Infantería de marina',
  mountaineers: 'Tropas de montaña',
  paratrooper: 'Paracaidistas',
  bicycle_battalion: 'Infantería en bicicleta',
  light_armor: 'Blindado ligero',
  medium_armor: 'Blindado medio',
  heavy_armor: 'Blindado pesado',
  modern_armor: 'Blindado moderno',
  super_heavy_armor: 'Blindado superpesado',
  amphibious_armor: 'Blindado anfibio',
  armored_car: 'Autoametralladora',
  artillery_brigade: 'Artillería',
  anti_tank_brigade: 'Antitanque',
  anti_air_brigade: 'Antiaérea',
  rocket_artillery_brigade: 'Artillería de cohetes',
  motorized_rocket_brigade: 'Cohetes motorizada',
  engineer: 'Ingenieros',
  recon: 'Reconocimiento',
  field_hospital: 'Hospital de campaña',
  logistics_company: 'Compañía logística',
  maintenance_company: 'Compañía de mantenimiento',
  military_police: 'Policía militar',
  signal_company: 'Compañía de señales',
  artillery: 'Artillería de apoyo',
  anti_air: 'Antiaérea de apoyo',
  anti_tank: 'Antitanque de apoyo',
  rocket_artillery: 'Cohetes de apoyo',
  flame_tank: 'Tanque lanzallamas',
  mountain_infantry: 'Infantería de montaña'
}

/** "heavy_tank_destroyer" → "Heavy tank destroyer" (último recurso) */
export function humanizeUnit(id: string): string {
  const t = id.replace(/_/g, ' ').trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export interface UnitNames {
  es?: string
  en?: string
}

/** Nombre del batallón: localización española del juego, luego la tabla propia, luego la inglesa */
export function unitName(id: string, names?: Record<string, UnitNames> | null): string {
  const n = names?.[id]
  return n?.es || UNIT_NAMES_ES[id] || n?.en || humanizeUnit(id)
}

/** Nombres de las unidades pedidas en el texto de un .yml: clave → texto (sin comillas) */
export function parseUnitNames(text: string, ids: Set<string>): Map<string, string> {
  const out = new Map<string, string>()
  for (const m of text.matchAll(/^\s*([A-Za-z0-9_.-]+):\d*\s*"(.*)"\s*$/gm))
    if (ids.has(m[1])) out.set(m[1], m[2])
  return out
}

// ---------------------------------------------------------------- íconos

/**
 * Ícono del batallón, confirmado en 1.19.3 (interface/subuniticons.gfx): GFX_unit_<ID de la unidad>_icon_medium.
 * El campo `sprite` NO va primero: artillery_brigade tiene sprite = artillery, y ese nombre es el ícono de
 * la artillería de APOYO. Solo si no existe el ícono con el ID se prueba el del sprite; si tampoco, el
 * llamador usa el ícono genérico del tipo.
 */
export function unitSpriteCandidates(u: { id: string; sprite?: string }): string[] {
  const out: string[] = []
  for (const s of [u.id, u.sprite]) {
    const c = s ? `GFX_unit_${s}_icon_medium` : ''
    if (c && !out.includes(c)) out.push(c)
  }
  return out
}
