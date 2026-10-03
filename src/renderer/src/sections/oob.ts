// Ejército inicial (OOB): plantillas de división, divisiones, producción inicial. Se escribe un
// archivo NUEVO history/units/<mod>_<TAG>_1936.txt por país y la historia del país apunta a él
// (oob = "…") con el parche mínimo. NUNCA se sobrescribe <TAG>_1936.txt del juego.
import type { Project } from '../types'
import { newUid } from '../types'
import { safeFolderName } from '../../../shared/names'
import { block, file, kv, str, type Node } from '../export/clausewitz'
import type { ModFile } from '../export/exportMod'
import type { GameCatalog } from '../catalog/catalog'
import type { MapData } from '../../../shared/map/types'
import { PROVINCE_TYPE } from '../../../shared/map/types'
import { registerSectionGenerator } from './generators'
import { registerHistoryContributor } from './historyExtras'
import type { Oob, OobDivision, OobTemplate } from './types'
import {
  UNIT_CATEGORIES,
  unitCategory,
  unitName,
  type UnitCategory
} from '../../../shared/gameUnits'

/** por verificar con un OOB real del juego: la cuadrícula de combate es 5×5 y el apoyo una columna de 5 */
export const COMBAT_GRID = { w: 5, h: 5 }
export const SUPPORT_SLOTS = 5

/** Reserva si no hay carpeta del juego (por verificar con common/units) */
export const BUILTIN_COMBAT = [
  'infantry',
  'cavalry',
  'motorized',
  'mechanized',
  'marine',
  'mountaineers',
  'paratrooper',
  'light_armor',
  'medium_armor',
  'heavy_armor',
  'artillery_brigade',
  'anti_tank_brigade',
  'anti_air_brigade'
]
export const BUILTIN_SUPPORT = [
  'engineer',
  'recon',
  'field_hospital',
  'logistics_company',
  'maintenance_company',
  'military_police',
  'signal_company',
  'artillery',
  'anti_air',
  'anti_tank'
]

/** Categoría de cada batallón de la lista de reserva */
const BUILTIN_CATEGORY: Record<string, UnitCategory> = {
  infantry: 'infantry',
  cavalry: 'infantry',
  marine: 'infantry',
  mountaineers: 'infantry',
  paratrooper: 'infantry',
  motorized: 'mobile',
  mechanized: 'mobile',
  light_armor: 'armor',
  medium_armor: 'armor',
  heavy_armor: 'armor',
  artillery_brigade: 'artillery',
  anti_tank_brigade: 'artillery',
  anti_air_brigade: 'artillery'
}

/** Un batallón listo para mostrar: nombre del juego, ícono (sprite) y tipo */
export interface UnitInfo {
  id: string
  name: string
  category: UnitCategory
  /** Sprite GFX_… del juego; null = ícono genérico del tipo */
  gfx: string | null
}

/** Solo unidades terrestres (las aéreas y navales no caben en una plantilla de división) */
export function landUnits(game?: GameCatalog | null): UnitInfo[] {
  const names = game?.unitNames
  const fromGame = (game?.subUnits ?? [])
    .map((u) => ({ u, category: unitCategory(u) }))
    .filter((x): x is { u: (typeof x)['u']; category: UnitCategory } => x.category !== null)
    .map(({ u, category }): UnitInfo => ({
      id: u.id,
      name: unitName(u.id, names),
      category,
      gfx: u.gfx ?? null
    }))
  if (fromGame.length) return fromGame
  return [
    ...BUILTIN_COMBAT.map((id): UnitInfo => ({
      id,
      category: BUILTIN_CATEGORY[id],
      gfx: null,
      name: unitName(id)
    })),
    ...BUILTIN_SUPPORT.map((id): UnitInfo => ({
      id,
      category: 'support',
      gfx: null,
      name: unitName(id)
    }))
  ]
}

/** Batallones agrupados por tipo: Infantería, Móviles, Blindados, Artillería… y Apoyo */
export function unitGroups(
  game?: GameCatalog | null
): { category: UnitCategory; label: string; units: UnitInfo[] }[] {
  const all = landUnits(game)
  return UNIT_CATEGORIES.map((c) => ({
    category: c.id,
    label: c.label,
    units: all.filter((u) => u.category === c.id)
  })).filter((g) => g.units.length)
}

/** Batallones disponibles (de combate y de apoyo), del juego o la lista de reserva */
export function unitLists(game?: GameCatalog | null): { combat: string[]; support: string[] } {
  const all = landUnits(game)
  return {
    combat: all.filter((u) => u.category !== 'support').map((u) => u.id),
    support: all.filter((u) => u.category === 'support').map((u) => u.id)
  }
}

const mod = (p: Project): string => safeFolderName(p.modName)
export const oobName = (p: Project, tag: string): string => `${mod(p)}_${tag}_1936`
export const oobFilePath = (p: Project, tag: string): string =>
  `history/units/${oobName(p, tag)}.txt`

export const oobOf = (p: Project, tag: string): Oob | undefined =>
  (p.oobs ?? []).find((o) => o.country === tag)
/** ¿Este país tiene un ejército propio que se exporta? */
export const hasOob = (p: Project, tag: string): boolean => {
  const o = oobOf(p, tag)
  return !!o && (o.templates.length > 0 || o.divisions.length > 0)
}

export const newOob = (country: string): Oob => ({
  country,
  templates: [],
  divisions: [],
  production: []
})
export function updateOob(p: Project, tag: string, f: (o: Oob) => Oob): Project {
  const cur = oobOf(p, tag) ?? newOob(tag)
  const next = f(cur)
  const rest = (p.oobs ?? []).filter((o) => o.country !== tag)
  return { ...p, oobs: [...rest, next] }
}
export const deleteOob = (p: Project, tag: string): Project => ({
  ...p,
  oobs: (p.oobs ?? []).filter((o) => o.country !== tag)
})

/** Plantillas de arranque de la ventana "Nueva plantilla" (formaciones habituales) */
export const DIVISION_PRESETS: {
  id: string
  label: string
  description: string
  /** [tipo, x, y] de los batallones de línea y [tipo, y] de apoyo */
  combat: [string, number, number][]
  support: [string, number][]
}[] = [
  {
    id: 'blank',
    label: 'En blanco',
    description: 'Una cuadrícula vacía para diseñarla desde cero.',
    combat: [],
    support: []
  },
  {
    id: 'infantry',
    label: 'Infantería',
    description: 'Siete batallones de infantería y dos de artillería, con ingenieros.',
    combat: [
      ['infantry', 0, 0],
      ['infantry', 0, 1],
      ['infantry', 0, 2],
      ['infantry', 1, 0],
      ['infantry', 1, 1],
      ['infantry', 1, 2],
      ['infantry', 2, 0],
      ['artillery_brigade', 3, 0],
      ['artillery_brigade', 3, 1]
    ],
    support: [['engineer', 0]]
  },
  {
    id: 'motorized',
    label: 'Motorizada',
    description: 'División rápida: batallones motorizados con apoyo de artillería.',
    combat: [
      ['motorized', 0, 0],
      ['motorized', 0, 1],
      ['motorized', 0, 2],
      ['motorized', 1, 0],
      ['motorized', 1, 1],
      ['motorized', 1, 2],
      ['artillery_brigade', 2, 0]
    ],
    support: [['recon', 0]]
  },
  {
    id: 'armor',
    label: 'Blindada',
    description: 'Tanques medios con algo de infantería motorizada.',
    combat: [
      ['medium_armor', 0, 0],
      ['medium_armor', 0, 1],
      ['medium_armor', 0, 2],
      ['medium_armor', 1, 0],
      ['medium_armor', 1, 1],
      ['medium_armor', 1, 2],
      ['motorized', 2, 0],
      ['motorized', 2, 1]
    ],
    support: [['maintenance_company', 0]]
  }
]

/** Una plantilla nueva a partir de una de arranque; omite los batallones que el juego no tiene */
export function templateFromPreset(
  o: Oob,
  presetId: string,
  name: string,
  game?: GameCatalog | null
): OobTemplate {
  const preset = DIVISION_PRESETS.find((x) => x.id === presetId) ?? DIVISION_PRESETS[0]
  const known = game?.subUnits ? new Set(game.subUnits.map((u) => u.id)) : null
  const ok = (type: string): boolean => !known || known.has(type)
  const t = newTemplate(o, name)
  return {
    ...t,
    regiments: preset.combat.filter(([ty]) => ok(ty)).map(([type, x, y]) => ({ type, x, y })),
    support: preset.support.filter(([ty]) => ok(ty)).map(([type, y]) => ({ type, y }))
  }
}

export function newTemplate(o: Oob, name = 'Nueva plantilla'): OobTemplate {
  const taken = new Set(o.templates.map((t) => t.name))
  let n = name
  for (let i = 2; taken.has(n); i++) n = `${name} ${i}`
  return { name: n, regiments: [], support: [] }
}
export function newDivision(
  o: Oob,
  province: number,
  over: Partial<OobDivision> = {}
): OobDivision {
  return {
    uid: newUid(),
    template: o.templates[0]?.name ?? '',
    province,
    name: '',
    ordinal: null,
    experience: 0,
    equipment: 1,
    ...over
  }
}

// ---------------------------------------------------------------- generación

const f2 = (n: number): number => Math.round(n * 100) / 100

export function templateNode(t: OobTemplate): Node {
  const kids: Node[] = [str('name', t.name)]
  const regs = [...t.regiments].sort((a, b) => a.x - b.x || a.y - b.y)
  kids.push(
    block(
      'regiments',
      regs.map((r) => block(r.type, [kv('x', r.x), kv('y', r.y)]))
    )
  )
  const sup = [...t.support].sort((a, b) => a.y - b.y)
  if (sup.length)
    kids.push(
      block(
        'support',
        sup.map((s) => block(s.type, [kv('x', 0), kv('y', s.y)]))
      )
    )
  return block('division_template', kids)
}

export function divisionNode(d: OobDivision): Node {
  const kids: Node[] = []
  if (d.ordinal !== null && !d.name.trim())
    // por verificar con un OOB real: nombre ordenado (el juego lo numera con su grupo de nombres)
    kids.push(block('division_name', [kv('is_name_ordered', true), kv('name_order', d.ordinal)]))
  else if (d.name.trim()) kids.push(str('name', d.name))
  kids.push(kv('location', d.province), str('division_template', d.template))
  kids.push(kv('start_experience_factor', f2(d.experience)))
  kids.push(kv('start_equipment_factor', f2(d.equipment)))
  return block('division', kids)
}

/** Texto del archivo history/units/… de un país */
export function oobText(tag: string, o: Oob): string {
  const nodes: Node[] = o.templates.map(templateNode)
  nodes.push(block('units', o.divisions.map(divisionNode)))
  const prod = o.production.filter((x) => x.equipment && x.factories > 0)
  if (prod.length)
    // por verificar con un OOB real: producción inicial dentro de instant_effect
    nodes.push(
      block(
        'instant_effect',
        prod.map((x) =>
          block('add_equipment_production', [
            block('equipment', [kv('type', x.equipment), str('creator', tag)]),
            kv('requested_factories', x.factories),
            kv('progress', 0.5),
            kv('efficiency', 100)
          ])
        )
      )
    )
  return file(nodes)
}

export function oobFiles(p: Project): ModFile[] {
  const out: ModFile[] = []
  for (const c of p.countries) {
    if (c.light || !hasOob(p, c.tag)) continue
    out.push({ path: oobFilePath(p, c.tag), text: oobText(c.tag, oobOf(p, c.tag)!) })
  }
  return out
}

registerSectionGenerator({ id: 'ejercito', generate: oobFiles })

/** La historia del país carga SU archivo (país nuevo o del juego, con el parche mínimo de la línea oob) */
registerHistoryContributor('ejercito', (p, c) =>
  hasOob(p, c.tag) ? { oob: oobName(p, c.tag) } : {}
)

// ---------------------------------------------------------------- validación

export interface OobIssue {
  severity: 'error' | 'aviso'
  message: string
  country: string
  /** Nombre de la plantilla afectada (para mostrar el aviso junto a ella) */
  template?: string
  /** uid de la división afectada */
  division?: string
}

export function validateOob(
  p: Project,
  map?: MapData | null,
  game?: GameCatalog | null
): OobIssue[] {
  const out: OobIssue[] = []
  const units = unitLists(game)
  const knownCombat = new Set(units.combat)
  const knownSupport = new Set(units.support)
  // "Existe" = aparece en CUALQUIER sub_units de common/units, sea cual sea su grupo (también las
  // aéreas y navales: esas existen, pero no caben en una división)
  const inGame = game?.subUnits ? new Set(game.subUnits.map((u) => u.id)) : null
  for (const o of p.oobs ?? []) {
    const at = (
      severity: OobIssue['severity'],
      m: string,
      where: { template?: string; division?: string } = {}
    ): number =>
      out.push({
        severity,
        message: `Ejército de ${o.country}: ${m}`,
        country: o.country,
        ...where
      })
    const c = p.countries.find((x) => x.tag === o.country)
    if (!c) at('aviso', 'el país no está en el mod: no se exporta su ejército.')
    else if (c.light)
      at(
        'aviso',
        'es un país del juego ligero: no se escribe su historia (ábrelo con el asistente).'
      )
    else if (c.mode === 'existente' && hasOob(p, o.country))
      at('aviso', 'reemplaza TODO el ejército del juego de este país por el que diseñaste aquí.')
    const names = new Set<string>()
    for (const t of o.templates) {
      const tt = (m: string): number =>
        at('error', `la plantilla "${t.name}" ${m}`, { template: t.name })
      if (!t.name.trim()) at('error', 'una plantilla no tiene nombre.', { template: t.name })
      if (names.has(t.name)) tt('está repetida.')
      names.add(t.name)
      if (!t.regiments.length) tt('necesita al menos un batallón.')
      const seen = new Set<string>()
      for (const r of t.regiments) {
        if (!(r.x >= 0 && r.x < COMBAT_GRID.w && r.y >= 0 && r.y < COMBAT_GRID.h))
          tt(`tiene un batallón fuera de la cuadrícula de ${COMBAT_GRID.w}×${COMBAT_GRID.h}.`)
        const k = `${r.x},${r.y}`
        if (seen.has(k)) tt(`tiene dos batallones en la posición ${k}.`)
        seen.add(k)
        if (inGame && !inGame.has(r.type))
          tt(`usa el batallón ${r.type}, que no existe en el juego.`)
        else if (inGame && !knownCombat.has(r.type) && !knownSupport.has(r.type))
          tt(`usa el batallón ${r.type}, que no es una unidad terrestre y no cabe en una división.`)
      }
      const sy = new Set<number>()
      for (const s of t.support) {
        if (!(s.y >= 0 && s.y < SUPPORT_SLOTS))
          tt(`tiene una compañía de apoyo fuera de la columna (0–${SUPPORT_SLOTS - 1}).`)
        if (sy.has(s.y)) tt(`tiene dos compañías de apoyo en la posición ${s.y}.`)
        sy.add(s.y)
        if (inGame && !inGame.has(s.type))
          tt(`usa la compañía ${s.type}, que no existe en el juego.`)
        else if (inGame && !knownSupport.has(s.type))
          tt(`usa la compañía ${s.type}, que no existe como apoyo en el juego.`)
      }
    }
    for (const d of o.divisions) {
      const dd = (sev: OobIssue['severity'], m: string): number =>
        at(sev, `la división en la provincia ${d.province}: ${m}`, { division: d.uid })
      if (!names.has(d.template)) dd('error', `la plantilla "${d.template}" no existe.`)
      if (map) {
        if (map.provinceType[d.province] !== PROVINCE_TYPE.land)
          dd('error', 'debe estar en una provincia de tierra.')
        else if (c && !c.light) {
          const st = map.states.find((s) => s.id === map.provinceToState[d.province])
          const owner = st ? (p.stateEdits[st.id]?.owner ?? st.owner) : ''
          if (st && owner !== o.country)
            dd('aviso', `está en el estado ${st.name}, que es de ${owner || 'nadie'}.`)
        }
      } else if (!(d.province > 0)) dd('error', 'falta la provincia.')
      if (!(d.experience >= 0 && d.experience <= 1)) dd('error', 'la experiencia va de 0 a 1.')
      if (!(d.equipment >= 0 && d.equipment <= 1)) dd('error', 'el equipo inicial va de 0 a 1.')
    }
    if (game?.equipments)
      for (const x of o.production)
        if (x.equipment && !game.equipments.includes(x.equipment))
          at('error', `la producción usa ${x.equipment}, que no existe en el juego.`)
  }
  return out
}
