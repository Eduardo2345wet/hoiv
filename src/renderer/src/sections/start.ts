// Situación inicial de cada país (estabilidad, convoyes, espíritus, tecnologías, diplomacia,
// guerras) y escenarios de inicio (bookmarks). Se aplican a la historia del país con
// historyExtras (país nuevo: archivo generado; país del juego: parche mínimo del real).
import type { Project } from '../types'
import { newUid } from '../types'
import { safeFolderName } from '../../../shared/names'
import { block, file, kv, list, str, type Node } from '../export/clausewitz'
import { localisationFiles, type LocText } from '../export/localisation'
import type { ModFile } from '../export/exportMod'
import { registerSectionGenerator } from './generators'
import { registerHistoryContributor } from './historyExtras'
import { IDEOLOGIES } from '../types'
import type { Bookmark, CountryStart } from './types'
import type { GameCatalog } from '../catalog/catalog'
import { historyEditable } from './characters'

/** por verificar con common/autonomous_states del juego: lista integrada si no hay carpeta del juego */
export const BUILTIN_AUTONOMY = ['autonomy_puppet', 'autonomy_dominion', 'autonomy_colony']
/** por verificar: tamaño de la imagen de un escenario (gfx/interface/bookmarks) */
export const BOOKMARK_PICTURE_SIZE = { w: 640, h: 220 }

export const newStart = (country: string): CountryStart => ({
  country,
  stability: null,
  warSupport: null,
  convoys: null,
  researchSlots: null,
  ideas: [],
  technologies: [],
  faction: null,
  puppets: [],
  guarantees: [],
  wars: [],
  startDate: '1936'
})
export const startOf = (p: Project, tag: string): CountryStart =>
  (p.countryStart ?? []).find((s) => s.country === tag) ?? newStart(tag)
export function setStart(p: Project, tag: string, patch: Partial<CountryStart>): Project {
  const cur = startOf(p, tag)
  const next = { ...cur, ...patch }
  const rest = (p.countryStart ?? []).filter((s) => s.country !== tag)
  return { ...p, countryStart: [...rest, next] }
}

const mod = (p: Project): string => safeFolderName(p.modName)
const frac = (pct: number): string => String(Math.round(pct * 10) / 1000)

/** Líneas de historia de un país: valores propios y la diplomacia que este país ejecuta */
export function startLines(
  p: Project,
  tag: string
): { scalars: Record<string, string>; lines: string[] } {
  const s = (p.countryStart ?? []).find((x) => x.country === tag)
  const scalars: Record<string, string> = {}
  const lines: string[] = []
  if (s) {
    if (s.stability !== null) scalars.set_stability = frac(s.stability)
    if (s.warSupport !== null) scalars.set_war_support = frac(s.warSupport)
    if (s.convoys !== null) scalars.set_convoys = String(s.convoys)
    if (s.researchSlots !== null) scalars.set_research_slots = String(s.researchSlots)
    if (s.ideas.length) lines.push(`add_ideas = { ${s.ideas.join(' ')} }`)
    if (s.technologies.length)
      lines.push('set_technology = {', ...s.technologies.map((t) => `\t${t} = 1`), '}')
    if (s.faction && !s.faction.joins && s.faction.name.trim())
      lines.push(`create_faction = "${s.faction.name.replace(/"/g, "'")}"`)
    for (const g of s.guarantees) lines.push(`give_guarantee = ${g}`)
    for (const pu of s.puppets)
      lines.push(`set_autonomy = {\n\ttarget = ${pu.tag}\n\tautonomy_state = ${pu.autonomy}\n}`)
  }
  // Quien se une a la facción de este país: lo agrega el líder
  for (const o of p.countryStart ?? [])
    if (o.faction?.joins === tag) lines.push(`add_to_faction = ${o.country}`)
  return { scalars, lines }
}

/** Orden de los efectos de diplomacia: la facción se crea antes que los que se unen */
registerHistoryContributor('inicio', (p, c) => {
  const { scalars, lines } = startLines(p, c.tag)
  const s = (p.countryStart ?? []).find((x) => x.country === c.tag)
  if (s?.startDate === '1939') {
    const dated = [...Object.entries(scalars).map(([k, v]) => `${k} = ${v}`), ...lines]
    return dated.length ? { dated: { '1939.1.1': dated.flatMap((l) => l.split('\n')) } } : {}
  }
  return { scalars, lines }
})

// ---------------------------------------------------------------- guerras y escenarios

export function startFiles(p: Project): ModFile[] {
  const out: ModFile[] = []
  const wars = (p.countryStart ?? []).filter((s) => s.wars.length)
  if (wars.length)
    out.push({
      path: `common/on_actions/${mod(p)}_start.txt`,
      text: file([
        block('on_actions', [
          block('on_startup', [
            block(
              'effect',
              wars.map((s) =>
                block(
                  s.country,
                  s.wars.map((w) =>
                    block('declare_war_on', [kv('target', w), kv('type', 'annex_everything')])
                  )
                )
              )
            )
          ])
        ])
      ])
    })
  return out
}

export const bookmarkKey = (p: Project, i: number): string => `${mod(p)}_bookmark_${i + 1}`
export const bookmarkSprite = (p: Project, i: number): string => `GFX_${bookmarkKey(p, i)}`
export const bookmarkImagePath = (p: Project, i: number): string =>
  `gfx/interface/bookmarks/${bookmarkKey(p, i)}.dds`

const pngOf = (p: Project, b: Bookmark): string | null => {
  const pic = b.picture
  return pic?.kind === 'asset' ? (p.icons.find((a) => a.id === pic.assetId)?.png ?? null) : null
}
export function bookmarkImages(p: Project): { path: string; png: string; w: number; h: number }[] {
  const out: { path: string; png: string; w: number; h: number }[] = []
  ;(p.bookmarks ?? []).forEach((b, i) => {
    const png = pngOf(p, b)
    if (png) out.push({ path: bookmarkImagePath(p, i), png, ...BOOKMARK_PICTURE_SIZE })
  })
  return out
}

export function newBookmark(over: Partial<Bookmark> = {}): Bookmark {
  return {
    uid: newUid(),
    name: '',
    description: '',
    date: '1936.1.1.12',
    defaultCountry: '',
    isDefault: false,
    picture: null,
    featured: [],
    ...over
  }
}

export function bookmarkFiles(p: Project): ModFile[] {
  const bs = p.bookmarks ?? []
  if (!bs.length) return []
  const nodes = bs.map((b, i) => {
    const key = bookmarkKey(p, i)
    const pic =
      b.picture?.kind === 'game' ? b.picture.gfx : pngOf(p, b) ? bookmarkSprite(p, i) : null
    const kids: Node[] = [kv('name', key), kv('desc', `${key}_desc`), kv('date', b.date)]
    if (pic) kids.push(kv('picture', pic))
    if (b.defaultCountry) kids.push(str('default_country', b.defaultCountry))
    if (b.isDefault) kids.push(kv('default', true))
    for (const f of b.featured)
      kids.push(
        block(f.tag, [
          str('history', `${f.tag}_${key}_desc`),
          kv('ideology', f.ideology),
          ...(f.ideas.length ? [list('ideas', f.ideas)] : []),
          ...(f.focuses.length ? [list('focuses', f.focuses)] : [])
        ])
      )
    // por verificar con common/bookmarks del juego: el resto de países se lista con "---"
    kids.push(block('"---"', []))
    return block('bookmark', kids)
  })
  const out: ModFile[] = [
    { path: `common/bookmarks/${mod(p)}_bookmarks.txt`, text: file([block('bookmarks', nodes)]) }
  ]
  const sprites = bs
    .map((b, i) => ({ b, i }))
    .filter((x) => pngOf(p, x.b))
    .map((x) =>
      block('SpriteType', [
        str('name', bookmarkSprite(p, x.i)),
        str('texturefile', bookmarkImagePath(p, x.i))
      ])
    )
  if (sprites.length)
    out.push({
      path: `interface/${mod(p)}_bookmarks.gfx`,
      text: file([block('spriteTypes', sprites)])
    })
  const e: Record<string, LocText> = {}
  bs.forEach((b, i) => {
    const key = bookmarkKey(p, i)
    e[key] = b.name
    e[`${key}_desc`] = b.description
    for (const f of b.featured) e[`${f.tag}_${key}_desc`] = f.history
  })
  out.push(...localisationFiles(p, 'bookmarks', e))
  return out
}

/** Nombre de la facción (localización de la facción creada por el país) */
registerSectionGenerator({
  id: 'inicio',
  generate: (p) => [...startFiles(p), ...bookmarkFiles(p)]
})

// ---------------------------------------------------------------- validación

export interface StartIssue {
  severity: 'error' | 'aviso'
  message: string
  tag?: string
}

export function validateStart(p: Project, game?: GameCatalog | null): StartIssue[] {
  const out: StartIssue[] = []
  const starts = p.countryStart ?? []
  const leaderOf = new Map<string, string>() // país → líder de la facción a la que se une
  for (const s of starts) if (s.faction?.joins) leaderOf.set(s.country, s.faction.joins)
  const at = (severity: StartIssue['severity'], tag: string, m: string): number =>
    out.push({ severity, tag, message: `Situación inicial de ${tag}: ${m}` })
  for (const s of starts) {
    const c = p.countries.find((x) => x.tag === s.country)
    if (c && !c.light) {
      const pol = c.politics
      const sum = IDEOLOGIES.reduce((a, i) => a + pol.popularities[i], 0)
      if (sum !== 100) at('error', s.country, `las popularidades suman ${sum}, deben sumar 100.`)
      if (pol.popularities[pol.ruling] <= 0)
        at('error', s.country, 'el partido gobernante tiene 0 %: provocaría un golpe de estado.')
      if (c.capital === null) at('aviso', s.country, 'no tiene capital.')
    }
    for (const [k, v] of [
      ['estabilidad', s.stability],
      ['apoyo a la guerra', s.warSupport]
    ] as const)
      if (v !== null && (v < 0 || v > 100)) at('error', s.country, `${k} debe estar entre 0 y 100.`)
    if (s.faction?.joins) {
      if (s.faction.joins === s.country)
        at('error', s.country, 'no puede unirse a su propia facción.')
      if (leaderOf.has(s.faction.joins))
        at(
          'error',
          s.country,
          `se une a ${s.faction.joins}, que a su vez es miembro de otra facción: un líder no debe pertenecer a otra.`
        )
      if (
        s.faction &&
        starts.some(
          (o) =>
            o.country !== s.country &&
            o.faction &&
            !o.faction.joins &&
            o.faction.name &&
            o.country === s.country
        )
      )
        at('error', s.country, 'crea y se une a facciones a la vez.')
    }
    if (s.faction && !s.faction.joins && !s.faction.name.trim())
      at('aviso', s.country, 'la facción no tiene nombre (falta su localización).')
    // Títeres: nadie es títere de sí mismo ni hay ciclos
    for (const pu of s.puppets)
      if (pu.tag === s.country) at('error', s.country, 'es títere de sí mismo.')
    for (const g of s.guarantees)
      if (g === s.country) at('error', s.country, 'se garantiza a sí mismo.')
    for (const w of s.wars)
      if (w === s.country) at('error', s.country, 'se declara la guerra a sí mismo.')
    for (const t of s.technologies)
      if (game?.technologies && !game.technologies.some((x) => x.id === t))
        at('error', s.country, `la tecnología ${t} no existe en el juego.`)
    for (const pu of s.puppets)
      if (game?.autonomyStates && !game.autonomyStates.includes(pu.autonomy))
        at('error', s.country, `el nivel de autonomía ${pu.autonomy} no existe.`)
    if (
      c &&
      (s.stability !== null ||
        s.ideas.length ||
        s.puppets.length ||
        s.faction ||
        s.technologies.length) &&
      !historyEditable(p, s.country) &&
      !c.light
    )
      at('aviso', s.country, 'no hay historia del juego leída para parchear: no se aplicará.')
    if (c?.light)
      at(
        'aviso',
        s.country,
        'es un país del juego ligero: no se escribe su historia (ábrelo con el asistente).'
      )
  }
  // Ciclos de títeres
  const overlord = new Map<string, string>()
  for (const s of starts) for (const pu of s.puppets) overlord.set(pu.tag, s.country)
  for (const start of overlord.keys()) {
    const seen = new Set<string>([start])
    let cur = overlord.get(start)
    while (cur) {
      if (seen.has(cur)) {
        at('error', start, 'hay un ciclo de títeres.')
        break
      }
      seen.add(cur)
      cur = overlord.get(cur)
    }
  }
  // Un país con relaciones debe tener estados: aviso si no es del juego ni tiene capital
  for (const s of starts) {
    const c = p.countries.find((x) => x.tag === s.country)
    const rel = s.puppets.length || s.guarantees.length || s.faction
    if (c && c.mode === 'nuevo' && rel && c.capital === null)
      at(
        'aviso',
        s.country,
        'tiene relaciones pero no tiene estados: ponle capital y estados en el mapa.'
      )
  }
  // Escenarios
  ;(p.bookmarks ?? []).forEach((b) => {
    const m = (x: string): number =>
      out.push({ severity: 'aviso', message: `Escenario ${b.name || b.date}: ${x}` })
    if (!/^\d{4}\.\d{1,2}\.\d{1,2}(\.\d{1,2})?$/.test(b.date))
      m('la fecha debe verse como 1936.1.1.12.')
    if (!b.name.trim()) m('falta el nombre.')
    if (b.date.startsWith('1939'))
      m(
        'el inicio en 1939 funciona con bloques con fecha; el modo está pensado sobre todo para 1936.'
      )
    if (b.defaultCountry && !b.featured.some((f) => f.tag === b.defaultCountry))
      m('el país por defecto no está entre los destacados.')
  })
  return out
}
