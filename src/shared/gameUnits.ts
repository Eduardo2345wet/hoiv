// Batallones (common/units) y equipos (common/units/equipment) del juego, para el editor de ejército.
import { entries, topValue } from './gameBuildings'

export interface GameSubUnit {
  id: string
  /** group = support para las compañías de apoyo */
  group: string
  /** `type` y `map_icon_category` del archivo, para reconocer las terrestres */
  type?: string
  mapIcon?: string
  /** `sprite` del archivo (nombre del dibujo del batallón) */
  sprite?: string
  /** Sprite GFX_… de interface/*.gfx que se usa como ícono (si se encontró) */
  gfx?: string | null
}

/** por verificar con common/units del juego: sub_units = { infantry = { group = infantry … } } */
export function parseSubUnits(text: string): GameSubUnit[] {
  return entries(text, 'sub_units').map(({ key, body }) => {
    const u: GameSubUnit = { id: key, group: topValue(body, 'group') ?? '' }
    const type = topValue(body, 'type')
    const mapIcon = topValue(body, 'map_icon_category')
    const sprite = topValue(body, 'sprite')
    if (type) u.type = type
    if (mapIcon) u.mapIcon = mapIcon
    if (sprite) u.sprite = sprite
    return u
  })
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

/** por verificar con common/units: el `group` real de cada batallón terrestre */
const LAND_GROUPS: Record<string, UnitCategory> = {
  infantry: 'infantry',
  mobile: 'mobile',
  armor: 'armor',
  artillery: 'artillery',
  support: 'support'
}
/** por verificar: tipos y categorías de mapa de las unidades aéreas y navales, que se excluyen */
const NOT_LAND = /(^|_)(air|naval|ship|ships|fleet|carrier|submarine|plane|planes|aircraft)(_|$)/i
/** por verificar: tipo del batallón cuando su grupo no es de los conocidos */
const LAND_TYPES: Record<string, UnitCategory> = {
  infantry: 'infantry',
  cavalry: 'infantry',
  motorized: 'mobile',
  mechanized: 'mobile',
  armor: 'armor',
  artillery: 'artillery',
  anti_air: 'artillery',
  anti_tank: 'artillery'
}

/** Categoría terrestre de un batallón, o null si no es terrestre (aéreo, naval o desconocido) */
export function unitCategory(u: {
  id?: string
  group: string
  type?: string
  mapIcon?: string
}): UnitCategory | null {
  if (NOT_LAND.test(u.group) || NOT_LAND.test(u.type ?? '') || NOT_LAND.test(u.mapIcon ?? ''))
    return null
  const byGroup = LAND_GROUPS[u.group.toLowerCase()]
  if (byGroup) return byGroup
  return LAND_TYPES[(u.type ?? '').toLowerCase()] ?? null
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
 * Sprite del batallón: confirmado en 1.19.3, GFX_unit_<sprite>_icon_medium (interface/subuniticons.gfx).
 * Se dejan nombres de reserva por si algún mod usa otro.
 */
export function unitSpriteCandidates(u: { id: string; sprite?: string }): string[] {
  const out: string[] = []
  for (const s of [u.sprite, u.id]) {
    if (!s) continue
    for (const c of [`GFX_unit_${s}_icon_medium`, `GFX_unit_${s}_icon_strip`, `GFX_unit_${s}_icon`])
      if (!out.includes(c)) out.push(c)
  }
  return out
}
