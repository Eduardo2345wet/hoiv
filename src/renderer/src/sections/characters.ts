// Personajes: líderes, asesores, generales y almirantes. Sintaxis según la wiki (Character
// modding). NUNCA se escribe common/characters/<TAG>.txt (borraría los personajes del juego):
// el archivo propio lleva el prefijo del mod.
import type { Project, Country } from '../types'
import { newUid } from '../types'
import { safeFolderName } from '../../../shared/names'
import { block, file, kv, list, raw, str, type Node } from '../export/clausewitz'
import { localisationFiles, type LocText } from '../export/localisation'
import type { ModFile } from '../export/exportMod'
import { registerSectionGenerator } from './generators'
import { registerHistoryContributor } from './historyExtras'
import { emptyScript, type AdvisorSlot, type Character, type CharacterRole } from './types'
import type { GameCatalog } from '../catalog/catalog'
import { characterId } from '../countries/countryOps'
import { LEADER_EXPIRE } from '../countries/gameData'

/** por verificar: tamaños de retrato (el de líder, 156×210, ya existe; los de general y consejero se leen de gfx/leaders del juego) */
export const PORTRAIT_SIZE = {
  civilian: { w: 156, h: 210 },
  army: { w: 156, h: 210 },
  navy: { w: 156, h: 210 }
}
export const ROLES: { id: CharacterRole; label: string }[] = [
  { id: 'country_leader', label: 'Líder del país' },
  { id: 'advisor', label: 'Consejero' },
  { id: 'corps_commander', label: 'General' },
  { id: 'field_marshal', label: 'Mariscal' },
  { id: 'navy_leader', label: 'Almirante' }
]
export const ADVISOR_SLOTS: { id: AdvisorSlot; label: string }[] = [
  { id: 'political_advisor', label: 'Consejero político' },
  { id: 'theorist', label: 'Teórico' },
  { id: 'army_chief', label: 'Jefe del ejército' },
  { id: 'navy_chief', label: 'Jefe de la armada' },
  { id: 'air_chief', label: 'Jefe de la fuerza aérea' },
  { id: 'high_command', label: 'Alto mando' }
]
export const SKILL_RANGE = { min: 1, max: 10 }

const mod = (p: Project): string => safeFolderName(p.modName)

export function newCharacter(p: Project, over: Partial<Character> = {}): Character {
  const country = over.country ?? ''
  const taken = new Set((p.characters ?? []).map((c) => c.id))
  const slug = safeFolderName(over.name || 'personaje').replace(/^mi_mod$/, 'personaje')
  let id = over.id ?? `${country || 'XXX'}_${slug}`
  for (let n = 2; taken.has(id); n++) id = `${over.id ?? `${country || 'XXX'}_${slug}`}_${n}`
  return {
    uid: newUid(),
    name: '',
    country,
    roles: [],
    portraits: { civilian: null, army: null, navy: null },
    recruit: true,
    leader: { ideology: 'neutrality_neutrality', traits: [], expire: LEADER_EXPIRE },
    advisor: {
      slot: 'political_advisor',
      ideaToken: `${id}_advisor`,
      cost: 150,
      traits: [],
      allowed: emptyScript(),
      canBeFired: true
    },
    army: { skill: 1, attack: 1, defense: 1, planning: 1, logistics: 1, traits: [] },
    navy: { skill: 1, attack: 1, defense: 1, maneuvering: 1, coordination: 1, traits: [] },
    ...over,
    id
  }
}
export function createCharacter(
  p: Project,
  over: Partial<Character> = {}
): { project: Project; character: Character } {
  const character = newCharacter(p, over)
  return { project: { ...p, characters: [...(p.characters ?? []), character] }, character }
}
export const updateCharacter = (p: Project, uid: string, patch: Partial<Character>): Project => ({
  ...p,
  characters: (p.characters ?? []).map((c) => (c.uid === uid ? { ...c, ...patch } : c))
})
export const deleteCharacter = (p: Project, uid: string): Project => ({
  ...p,
  characters: (p.characters ?? []).filter((c) => c.uid !== uid)
})
export function duplicateCharacter(
  p: Project,
  uid: string
): { project: Project; character: Character } | null {
  const src = (p.characters ?? []).find((c) => c.uid === uid)
  if (!src) return null
  const copy = newCharacter(p, {
    ...JSON.parse(JSON.stringify(src)),
    uid: newUid(),
    id: `${src.id}_copia`,
    name: src.name ? `${src.name} (copia)` : ''
  })
  copy.advisor.ideaToken = `${copy.id}_advisor`
  return { project: { ...p, characters: [...p.characters, copy] }, character: copy }
}

/** ¿Dónde se usa este personaje? (reclutado o nombrado en algún script) */
export function characterUsage(p: Project, c: Character, scripts: string[] = []): string[] {
  void p
  const out: string[] = []
  if (c.recruit) out.push('se recluta al inicio')
  if (scripts.some((s) => s.includes(c.id))) out.push('lo nombra algún script')
  return out
}

/** Líderes del asistente de países → personajes (los quita del país: ya no se exportan dos veces) */
export function leadersToCharacters(p: Project): Project {
  let out = p
  for (const c of p.countries) {
    if (!c.leaders.length) continue
    for (const l of c.leaders) {
      const id = characterId(c, l.id)
      if ((out.characters ?? []).some((x) => x.id === id)) continue
      out = createCharacter(out, {
        id,
        name: l.name,
        country: c.tag,
        roles: ['country_leader'],
        recruit: c.politics.ruling === l.ideology,
        portraits: { civilian: l.portrait, army: null, navy: null },
        leader: { ideology: l.subideology, traits: [], expire: LEADER_EXPIRE }
      }).project
    }
    out = {
      ...out,
      countries: out.countries.map((x) => (x.uid === c.uid ? { ...x, leaders: [] } : x))
    }
  }
  return out
}

// ---------------------------------------------------------------- generación

export const portraitSprite = (c: Character, kind: 'civilian' | 'army' | 'navy'): string =>
  kind === 'civilian' ? `GFX_${c.id}` : `GFX_${c.id}_${kind}`
export const portraitPath = (c: Character, kind: 'civilian' | 'army' | 'navy'): string =>
  `gfx/leaders/${c.country || 'XXX'}/${mod2(c)}_${kind}.dds`
const mod2 = (c: Character): string => c.id

/** Imágenes de retrato a exportar */
export function characterImages(p: Project): { path: string; png: string; w: number; h: number }[] {
  const out: { path: string; png: string; w: number; h: number }[] = []
  void p
  for (const c of p.characters ?? [])
    for (const k of ['civilian', 'army', 'navy'] as const)
      if (c.portraits[k])
        out.push({ path: portraitPath(c, k), png: c.portraits[k]!, ...PORTRAIT_SIZE[k] })
  return out
}
export const characterImagePaths = (p: Project): string[] => characterImages(p).map((i) => i.path)

const traitsNode = (t: string[]): Node => list('traits', t)

export function characterNode(c: Character): Node {
  const kids: Node[] = [kv('name', c.id)]
  const pk: Node[] = []
  for (const k of ['civilian', 'army', 'navy'] as const)
    if (c.portraits[k]) pk.push(block(k, [kv('large', portraitSprite(c, k))]))
  if (pk.length) kids.push(block('portraits', pk))
  if (c.roles.includes('country_leader'))
    kids.push(
      block('country_leader', [
        kv('ideology', c.leader.ideology),
        traitsNode(c.leader.traits),
        str('expire', c.leader.expire)
      ])
    )
  if (c.roles.includes('advisor')) {
    const a = c.advisor
    kids.push(
      block('advisor', [
        kv('slot', a.slot),
        kv('idea_token', a.ideaToken),
        ...(a.allowed.code.trim() ? [block('allowed', [raw(a.allowed.code)])] : []),
        kv('cost', a.cost),
        ...(a.canBeFired ? [] : [kv('can_be_fired', false)]),
        traitsNode(a.traits)
      ])
    )
  }
  for (const r of ['field_marshal', 'corps_commander'] as const)
    if (c.roles.includes(r))
      kids.push(
        block(r, [
          kv('skill', c.army.skill),
          kv('attack_skill', c.army.attack),
          kv('defense_skill', c.army.defense),
          kv('planning_skill', c.army.planning),
          kv('logistics_skill', c.army.logistics),
          traitsNode(c.army.traits),
          kv('legacy_id', -1)
        ])
      )
  if (c.roles.includes('navy_leader'))
    kids.push(
      block('navy_leader', [
        kv('skill', c.navy.skill),
        kv('attack_skill', c.navy.attack),
        kv('defense_skill', c.navy.defense),
        kv('maneuvering_skill', c.navy.maneuvering),
        kv('coordination_skill', c.navy.coordination),
        traitsNode(c.navy.traits)
      ])
    )
  return block(c.id, kids)
}

/**
 * Un archivo por país con prefijo del mod. Si el asistente de países ya escribe
 * <mod>_<TAG>_characters.txt (líderes sin migrar), este lleva el sufijo _personajes.
 */
export function characterFiles(p: Project): ModFile[] {
  const byTag = new Map<string, Character[]>()
  for (const c of p.characters ?? []) {
    const tag = c.country || 'XXX'
    byTag.set(tag, [...(byTag.get(tag) ?? []), c])
  }
  const out: ModFile[] = []
  for (const [tag, list_] of byTag) {
    const assistant = p.countries.some((x) => x.tag === tag && !x.light && x.leaders.length)
    out.push({
      path: `common/characters/${mod(p)}_${tag}_${assistant ? 'personajes' : 'characters'}.txt`,
      text: file([block('characters', list_.map(characterNode))])
    })
  }
  // Países sin historia editable: se reclutan al iniciar con on_actions (sin tocar nada del juego)
  const loose = (p.characters ?? []).filter(
    (c) => c.recruit && c.roles.length && c.country && !historyEditable(p, c.country)
  )
  if (loose.length)
    out.push({
      path: `common/on_actions/${mod(p)}_characters.txt`,
      text: file([
        block('on_actions', [
          block('on_startup', [
            block(
              'effect',
              loose.map((c) => block(c.country, [kv('recruit_character', c.id)]))
            )
          ])
        ])
      ])
    })
  const sprites: Node[] = []
  for (const c of p.characters ?? [])
    for (const k of ['civilian', 'army', 'navy'] as const)
      if (c.portraits[k])
        sprites.push(
          block('SpriteType', [
            str('name', portraitSprite(c, k)),
            str('texturefile', portraitPath(c, k))
          ])
        )
  if (sprites.length)
    out.push({
      path: `interface/${mod(p)}_portraits.gfx`,
      text: file([block('spriteTypes', sprites)])
    })
  return out
}

export function characterLoc(p: Project): ModFile[] {
  const e: Record<string, LocText> = {}
  for (const c of p.characters ?? []) {
    e[c.id] = c.name
    if (c.roles.includes('advisor')) e[c.advisor.ideaToken] = c.name
  }
  return localisationFiles(p, 'characters', e)
}

registerSectionGenerator({
  id: 'personajes',
  generate: (p) => (p.characters?.length ? [...characterFiles(p), ...characterLoc(p)] : [])
})

/** recruit_character de los personajes de un país: va en su historia, antes de set_politics */
registerHistoryContributor('personajes', (p, c: Country) => ({
  lines: (p.characters ?? [])
    .filter((x) => x.country === c.tag && x.recruit && x.roles.length)
    .map((x) => `recruit_character = ${x.id}`)
}))

// ---------------------------------------------------------------- validación

export interface CharacterIssue {
  severity: 'error' | 'aviso'
  message: string
  uid: string
}

/** ¿Se escribe la historia de este país? (nuevo, o del juego con su archivo leído y no ligero) */
export function historyEditable(p: Project, tag: string): boolean {
  return p.countries.some(
    (x) =>
      x.tag === tag &&
      !x.light &&
      (x.mode === 'nuevo' || !!(x.existing.historyText && x.existing.historyFile))
  )
}

export function validateCharacters(p: Project, game?: GameCatalog | null): CharacterIssue[] {
  const out: CharacterIssue[] = []
  const ids = new Set<string>()
  const tokens = new Set<string>()
  const leaderIds = new Set(p.countries.flatMap((c) => c.leaders.map((l) => characterId(c, l.id))))
  const leaderTraits = game?.leaderTraits ? new Set(game.leaderTraits.map((t) => t.id)) : null
  const unitTraits = game?.unitTraits ? new Set(game.unitTraits.map((t) => t.id)) : null
  for (const c of p.characters ?? []) {
    const at = (severity: CharacterIssue['severity'], m: string): number =>
      out.push({ severity, message: `Personaje ${c.id}: ${m}`, uid: c.uid })
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(c.id)) at('error', 'el ID solo admite letras, números y _.')
    if (ids.has(c.id) || leaderIds.has(c.id)) at('error', 'ID repetido.')
    ids.add(c.id)
    if (!c.name.trim()) at('error', 'falta el nombre.')
    if (!/^[A-Za-z0-9]{3}$/.test(c.country)) at('error', 'elige su país.')
    if (!c.roles.length) at('aviso', 'no tiene ningún rol: no se recluta ni aparece.')
    if (c.country && c.recruit && !historyEditable(p, c.country))
      at(
        'aviso',
        `no hay historia editable de ${c.country}: se recluta con on_actions (agrega el país en Países para escribirlo en su historia).`
      )
    if (c.roles.includes('advisor')) {
      if (tokens.has(c.advisor.ideaToken)) at('error', 'idea_token repetido.')
      tokens.add(c.advisor.ideaToken)
      if (!c.advisor.ideaToken.trim()) at('error', 'el consejero necesita idea_token.')
      if (!ADVISOR_SLOTS.some((s) => s.id === c.advisor.slot))
        at('error', 'ranura de consejero no válida.')
      if (leaderTraits)
        for (const t of c.advisor.traits)
          if (!leaderTraits.has(t)) at('error', `el rasgo ${t} no existe en el juego.`)
    }
    if (c.roles.includes('country_leader') && leaderTraits)
      for (const t of c.leader.traits)
        if (!leaderTraits.has(t)) at('error', `el rasgo ${t} no existe en el juego.`)
    if (c.roles.some((r) => r === 'corps_commander' || r === 'field_marshal')) {
      for (const [k, v] of Object.entries({
        skill: c.army.skill,
        attack: c.army.attack,
        defense: c.army.defense,
        planning: c.army.planning,
        logistics: c.army.logistics
      }))
        if (!(v >= SKILL_RANGE.min && v <= SKILL_RANGE.max))
          at('aviso', `habilidad ${k} fuera de ${SKILL_RANGE.min}–${SKILL_RANGE.max}.`)
      if (unitTraits)
        for (const t of c.army.traits)
          if (!unitTraits.has(t)) at('error', `el rasgo ${t} no existe en el juego.`)
    }
    if (c.roles.includes('navy_leader')) {
      for (const [k, v] of Object.entries({
        skill: c.navy.skill,
        attack: c.navy.attack,
        defense: c.navy.defense,
        maneuvering: c.navy.maneuvering,
        coordination: c.navy.coordination
      }))
        if (!(v >= SKILL_RANGE.min && v <= SKILL_RANGE.max))
          at('aviso', `habilidad ${k} fuera de ${SKILL_RANGE.min}–${SKILL_RANGE.max}.`)
      if (unitTraits)
        for (const t of c.navy.traits)
          if (!unitTraits.has(t)) at('error', `el rasgo ${t} no existe en el juego.`)
    }
    if (!c.portraits.civilian && !c.portraits.army && !c.portraits.navy)
      at('aviso', 'sin retrato: el juego usa uno de relleno.')
  }
  return out
}
