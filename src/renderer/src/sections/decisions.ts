// Decisiones y misiones: categorías, decisiones normales, misiones y con objetivo (países o
// estados). Sintaxis según la wiki (Decision modding). Generador de common/decisions/….
import type { Project, IconRef } from '../types'
import { newUid } from '../types'
import { safeFolderName } from '../../../shared/names'
import { block, file, kv, list, raw, str, type Node } from '../export/clausewitz'
import { localisationFiles, type LocText } from '../export/localisation'
import { modifierScriptValue } from '../catalog/modifiers'
import type { ModFile } from '../export/exportMod'
import { registerSectionGenerator } from './generators'
import {
  emptyScript,
  type BlockScript,
  type Decision,
  type DecisionCategory,
  type DecisionKind
} from './types'

// por verificar en el juego: tamaño de los íconos de decisión y de la imagen de categoría (leerlos
// de un .dds de gfx/interface/decisions), y si `picture` de la categoría lleva el nombre GFX completo
export const DECISION_ICON_SIZE = { w: 66, h: 66 }
export const CATEGORY_PICTURE_SIZE = { w: 460, h: 150 }
const GAME_ICON_PREFIX = 'GFX_decision_'
const GAME_CATEGORY_PREFIX = 'GFX_decision_category_'

export const DECISION_KINDS: { id: DecisionKind; label: string }[] = [
  { id: 'normal', label: 'Normal' },
  { id: 'mission', label: 'Misión (con temporizador)' },
  { id: 'target-country', label: 'Con objetivo: países' },
  { id: 'target-state', label: 'Con objetivo: estados' }
]

const mod = (p: Project): string => safeFolderName(p.modName)

function uniqueId(taken: Set<string>, base: string): string {
  let id = base
  for (let n = 2; taken.has(id); n++) id = `${base}_${n}`
  return id
}
const slug = (s: string, fallback: string): string => {
  const t = safeFolderName(s)
  return !s.trim() || t === 'mi_mod' ? fallback : t
}

// ---------------------------------------------------------------- operaciones

export function newCategory(p: Project, over: Partial<DecisionCategory> = {}): DecisionCategory {
  const taken = new Set((p.decisionCategories ?? []).map((c) => c.id))
  return {
    uid: newUid(),
    id: uniqueId(taken, `${mod(p)}_${slug(over.name ?? '', 'categoria')}`),
    name: '',
    description: '',
    icon: null,
    picture: null,
    priority: 0,
    visibleWhenEmpty: false,
    highlightStates: [],
    mapArea: null,
    ...over
  }
}
export function createCategory(
  p: Project,
  over: Partial<DecisionCategory> = {}
): { project: Project; category: DecisionCategory } {
  const category = newCategory(p, over)
  return {
    project: { ...p, decisionCategories: [...(p.decisionCategories ?? []), category] },
    category
  }
}
export const updateCategory = (
  p: Project,
  uid: string,
  patch: Partial<DecisionCategory>
): Project => ({
  ...p,
  decisionCategories: (p.decisionCategories ?? []).map((c) =>
    c.uid === uid ? { ...c, ...patch } : c
  )
})
/** Borrar una categoría deja sus decisiones sin categoría (el validador lo marca) */
export const deleteCategory = (p: Project, uid: string): Project => ({
  ...p,
  decisionCategories: (p.decisionCategories ?? []).filter((c) => c.uid !== uid),
  decisions: (p.decisions ?? []).map((d) =>
    d.categoryUid === uid ? { ...d, categoryUid: null } : d
  )
})

export function newDecision(p: Project, over: Partial<Decision> = {}): Decision {
  const taken = new Set((p.decisions ?? []).map((d) => d.id))
  return {
    uid: newUid(),
    id: uniqueId(taken, `${mod(p)}_${slug(over.name ?? '', 'decision')}`),
    categoryUid: p.decisionCategories?.[0]?.uid ?? null,
    kind: 'normal',
    name: '',
    description: '',
    icon: null,
    priority: 0,
    countries: [],
    visible: emptyScript(),
    available: emptyScript(),
    complete: emptyScript(),
    remove: emptyScript(),
    timeout: emptyScript(),
    cancel: emptyScript(),
    cancelTrigger: emptyScript(),
    cost: { mode: 'none', pp: 0, customTrigger: emptyScript(), customText: '', aiHintPp: 0 },
    daysReEnable: 0,
    fireOnlyOnce: false,
    daysRemove: 0,
    modifiers: [],
    aiBase: 0,
    aiModifiers: [],
    missionTimeoutDays: 0,
    selectableMission: false,
    isGood: true,
    activation: emptyScript(),
    targetCountries: [],
    targetStates: [],
    targetTrigger: emptyScript(),
    onMapMode: '',
    warWithOnComplete: '',
    warWithOnRemove: '',
    ...over
  }
}
export function createDecision(
  p: Project,
  over: Partial<Decision> = {}
): { project: Project; decision: Decision } {
  const decision = newDecision(p, over)
  return { project: { ...p, decisions: [...(p.decisions ?? []), decision] }, decision }
}
export const updateDecision = (p: Project, uid: string, patch: Partial<Decision>): Project => ({
  ...p,
  decisions: (p.decisions ?? []).map((d) => (d.uid === uid ? { ...d, ...patch } : d))
})
export const deleteDecision = (p: Project, uid: string): Project => ({
  ...p,
  decisions: (p.decisions ?? []).filter((d) => d.uid !== uid)
})
export function duplicateDecision(
  p: Project,
  uid: string
): { project: Project; decision: Decision } | null {
  const src = (p.decisions ?? []).find((d) => d.uid === uid)
  if (!src) return null
  const taken = new Set(p.decisions.map((d) => d.id))
  const copy: Decision = {
    ...JSON.parse(JSON.stringify(src)),
    uid: newUid(),
    id: uniqueId(taken, `${src.id}_copia`),
    name: src.name ? `${src.name} (copia)` : ''
  }
  return { project: { ...p, decisions: [...p.decisions, copy] }, decision: copy }
}
export const moveDecision = (p: Project, uid: string, categoryUid: string | null): Project =>
  updateDecision(p, uid, { categoryUid })

/** Decisiones de una categoría, por prioridad (mayor primero) y luego por orden de creación */
export const decisionsOf = (p: Project, categoryUid: string | null): Decision[] =>
  (p.decisions ?? [])
    .map((d, i) => ({ d, i }))
    .filter((x) => x.d.categoryUid === categoryUid)
    .sort((a, b) => b.d.priority - a.d.priority || a.i - b.i)
    .map((x) => x.d)

export const DECISION_TEMPLATES = [
  { id: 'normal', label: 'Decisión normal con costo' },
  { id: 'mission', label: 'Misión con temporizador' },
  { id: 'target-country', label: 'Decisión contra otros países' },
  { id: 'target-state', label: 'Decisión sobre estados' }
] as const
export function decisionFromTemplate(p: Project, kind: DecisionKind): Decision {
  const base = { name: '', kind }
  if (kind === 'normal')
    return newDecision(p, { ...base, cost: { ...newDecision(p).cost, mode: 'pp', pp: 50 } })
  if (kind === 'mission') return newDecision(p, { ...base, missionTimeoutDays: 60, isGood: true })
  return newDecision(p, base)
}

// ---------------------------------------------------------------- íconos

const sc = (key: string, s: BlockScript): Node[] =>
  s.code.trim() ? [block(key, [raw(s.code)])] : []

/** Nombre del sprite de un ícono propio de decisión */
export const decisionSprite = (p: Project, d: Decision): string =>
  `${GAME_ICON_PREFIX}${mod(p)}_${d.id}`
export const categorySprite = (c: DecisionCategory): string => `${GAME_CATEGORY_PREFIX}${c.id}`
export const categoryPictureSprite = (c: DecisionCategory): string =>
  `${GAME_CATEGORY_PREFIX}${c.id}_picture`

export const decisionIconPath = (p: Project, d: Decision): string =>
  `gfx/interface/decisions/${mod(p)}_${d.id}.dds`
export const categoryIconPath = (c: DecisionCategory): string =>
  `gfx/interface/decisions/${c.id}.dds`
export const categoryPicturePath = (c: DecisionCategory): string =>
  `gfx/interface/decisions/${c.id}_picture.dds`

const iconPng = (p: Project, ic: IconRef | null): string | null =>
  ic?.kind === 'asset' ? (p.icons.find((a) => a.id === ic.assetId)?.png ?? null) : null

/** Imágenes DDS propias (ruta, PNG de origen y tamaño) */
export function decisionImages(p: Project): { path: string; png: string; w: number; h: number }[] {
  const out: { path: string; png: string; w: number; h: number }[] = []
  for (const c of p.decisionCategories ?? []) {
    const i = iconPng(p, c.icon)
    if (i) out.push({ path: categoryIconPath(c), png: i, ...DECISION_ICON_SIZE })
    const pic = iconPng(p, c.picture)
    if (pic) out.push({ path: categoryPicturePath(c), png: pic, ...CATEGORY_PICTURE_SIZE })
  }
  for (const d of p.decisions ?? []) {
    const i = iconPng(p, d.icon)
    if (i) out.push({ path: decisionIconPath(p, d), png: i, ...DECISION_ICON_SIZE })
  }
  return out
}
export const decisionImagePaths = (p: Project): string[] => decisionImages(p).map((i) => i.path)

/** Valor de `icon =`: sin el prefijo que el juego antepone */
function decisionIconValue(p: Project, d: Decision): string | null {
  const ic = d.icon
  if (!ic) return null
  if (ic.kind === 'game')
    return ic.gfx.startsWith(GAME_ICON_PREFIX) ? ic.gfx.slice(GAME_ICON_PREFIX.length) : ic.gfx
  return iconPng(p, ic) ? `${mod(p)}_${d.id}` : null
}
function categoryIconValue(p: Project, c: DecisionCategory): string | null {
  const ic = c.icon
  if (!ic) return null
  if (ic.kind === 'game')
    return ic.gfx.startsWith(GAME_CATEGORY_PREFIX)
      ? ic.gfx.slice(GAME_CATEGORY_PREFIX.length)
      : ic.gfx
  return iconPng(p, ic) ? c.id : null
}
function categoryPictureValue(p: Project, c: DecisionCategory): string | null {
  const pic = c.picture
  if (!pic) return null
  if (pic.kind === 'game') return pic.gfx
  return iconPng(p, pic) ? categoryPictureSprite(c) : null
}

// ---------------------------------------------------------------- generación

const allowedNode = (countries: string[]): Node[] =>
  countries.length
    ? [
        block(
          'allowed',
          countries.length === 1
            ? [kv('original_tag', countries[0])]
            : [
                block(
                  'OR',
                  countries.map((t) => kv('original_tag', t))
                )
              ]
        )
      ]
    : []

export function decisionNode(p: Project, d: Decision): Node {
  const kids: Node[] = []
  const icon = decisionIconValue(p, d)
  if (icon) kids.push(kv('icon', icon))
  kids.push(...allowedNode(d.countries))
  if (d.priority) kids.push(kv('priority', d.priority))
  if (d.cost.mode === 'pp' && d.cost.pp) kids.push(kv('cost', d.cost.pp))
  if (d.cost.mode === 'custom') {
    kids.push(...sc('custom_cost_trigger', d.cost.customTrigger))
    if (d.cost.customText.trim()) kids.push(kv('custom_cost_text', `${d.id}_cost`))
    if (d.cost.aiHintPp) kids.push(kv('ai_hint_pp_cost', d.cost.aiHintPp))
  }
  if (d.daysReEnable > 0) kids.push(kv('days_re_enable', d.daysReEnable))
  if (d.fireOnlyOnce) kids.push(kv('fire_only_once', true))
  const mission = d.kind === 'mission'
  if (mission) {
    if (d.missionTimeoutDays > 0) kids.push(kv('days_mission_timeout', d.missionTimeoutDays))
    kids.push(...sc('activation', d.activation))
    if (d.selectableMission) kids.push(kv('selectable_mission', true))
    kids.push(kv('is_good', d.isGood))
  }
  kids.push(...sc('visible', d.visible), ...sc('available', d.available))
  if (d.daysRemove > 0) kids.push(kv('days_remove', d.daysRemove))
  const mods = d.modifiers.filter((m) => m.key && Number.isFinite(m.value))
  if (mods.length)
    kids.push(
      block(
        'modifier',
        mods.map((m) => kv(m.key, modifierScriptValue(m.key, m.value)))
      )
    )
  kids.push(...sc('complete_effect', d.complete), ...sc('remove_effect', d.remove))
  if (mission) kids.push(...sc('timeout_effect', d.timeout))
  kids.push(...sc('cancel_trigger', d.cancelTrigger), ...sc('cancel_effect', d.cancel))
  if (d.warWithOnComplete) kids.push(kv('war_with_on_complete', d.warWithOnComplete))
  if (d.warWithOnRemove) kids.push(kv('war_with_on_remove', d.warWithOnRemove))
  if (d.kind === 'target-country' || d.kind === 'target-state') {
    if (d.kind === 'target-state') kids.push(kv('state_target', true))
    const tg = d.kind === 'target-state' ? d.targetStates : d.targetCountries
    if (tg.length) kids.push(list('targets', tg))
    kids.push(...sc('target_trigger', d.targetTrigger))
    if (d.onMapMode) kids.push(kv('on_map_mode', d.onMapMode))
  }
  if (d.aiBase > 0 || d.aiModifiers.length)
    kids.push(
      block('ai_will_do', [
        kv('base', d.aiBase),
        ...d.aiModifiers
          .filter((m) => m.trigger.code.trim())
          .map((m) => block('modifier', [kv('factor', m.factor), raw(m.trigger.code)]))
      ])
    )
  if (d.extraText?.trim()) kids.push(raw(d.extraText))
  return block(d.id, kids)
}

export function categoryNode(p: Project, c: DecisionCategory): Node {
  const kids: Node[] = []
  const icon = categoryIconValue(p, c)
  if (icon) kids.push(kv('icon', icon))
  const pic = categoryPictureValue(p, c)
  if (pic) kids.push(kv('picture', pic))
  if (c.priority) kids.push(kv('priority', c.priority))
  if (c.visibleWhenEmpty) kids.push(kv('visible_when_empty', true))
  if (c.mapArea)
    kids.push(
      block('on_map_area', [kv('x', c.mapArea.x), kv('y', c.mapArea.y), kv('zoom', c.mapArea.zoom)])
    )
  if (c.highlightStates.length)
    kids.push(block('highlight_states', [list('states', c.highlightStates)]))
  return block(c.id, kids)
}

/** Categorías, decisiones (dentro del bloque de su categoría) y gfx de íconos propios */
export function decisionFiles(p: Project): ModFile[] {
  const out: ModFile[] = []
  const cats = p.decisionCategories ?? []
  const decs = p.decisions ?? []
  if (cats.length)
    out.push({
      path: `common/decisions/categories/${mod(p)}_categories.txt`,
      text: file(cats.map((c) => categoryNode(p, c)))
    })
  const blocks = cats
    .map((c) => ({ c, list_: decisionsOf(p, c.uid) }))
    .filter((x) => x.list_.length)
    .map((x) =>
      block(
        x.c.id,
        x.list_.map((d) => decisionNode(p, d))
      )
    )
  if (blocks.length)
    out.push({ path: `common/decisions/${mod(p)}_decisions.txt`, text: file(blocks) })
  const sprites: Node[] = []
  for (const c of cats) {
    if (iconPng(p, c.icon))
      sprites.push(
        block('SpriteType', [
          str('name', categorySprite(c)),
          str('texturefile', categoryIconPath(c))
        ])
      )
    if (iconPng(p, c.picture))
      sprites.push(
        block('SpriteType', [
          str('name', categoryPictureSprite(c)),
          str('texturefile', categoryPicturePath(c))
        ])
      )
  }
  for (const d of decs)
    if (iconPng(p, d.icon))
      sprites.push(
        block('SpriteType', [
          str('name', decisionSprite(p, d)),
          str('texturefile', decisionIconPath(p, d))
        ])
      )
  if (sprites.length)
    out.push({
      path: `interface/${mod(p)}_decisions.gfx`,
      text: file([block('spriteTypes', sprites)])
    })
  return out
}

export function decisionLoc(p: Project): ModFile[] {
  const e: Record<string, LocText> = {}
  for (const c of p.decisionCategories ?? []) {
    e[c.id] = c.name
    if (c.description.trim()) e[`${c.id}_desc`] = c.description
  }
  for (const d of p.decisions ?? []) {
    e[d.id] = d.name
    e[`${d.id}_desc`] = d.description
    if (d.cost.mode === 'custom' && d.cost.customText.trim()) e[`${d.id}_cost`] = d.cost.customText
  }
  return localisationFiles(p, 'decisions', e)
}

registerSectionGenerator({
  id: 'decisiones',
  generate: (p) =>
    p.decisionCategories?.length || p.decisions?.length
      ? [...decisionFiles(p), ...decisionLoc(p)]
      : []
})

// ---------------------------------------------------------------- validación

export interface DecisionIssue {
  severity: 'error' | 'aviso'
  message: string
  uid: string
}

/** `allScripts`: todos los scripts del mod (para ver si alguien activa una misión) */
export function validateDecisions(
  p: Project,
  allScripts: string[] = [],
  known?: { icons?: Set<string>; categoryIcons?: Set<string> }
): DecisionIssue[] {
  const out: DecisionIssue[] = []
  const cats = p.decisionCategories ?? []
  const seen = new Set<string>()
  for (const c of cats) {
    const at = (severity: DecisionIssue['severity'], m: string): number =>
      out.push({ severity, message: `Categoría ${c.id}: ${m}`, uid: c.uid })
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(c.id))
      at('error', 'el ID solo admite letras, números y _.')
    if (seen.has(c.id)) at('error', 'ID repetido.')
    seen.add(c.id)
    if (!c.name.trim()) at('error', 'falta el nombre.')
    if (c.picture && !c.description.trim())
      at('aviso', 'tiene imagen pero no descripción: el juego no la muestra sin descripción.')
    if (
      c.icon?.kind === 'asset' &&
      !p.icons.some((a) => a.id === (c.icon as { assetId: string }).assetId)
    )
      at('error', 'el ícono de la biblioteca ya no existe.')
    if (c.icon?.kind === 'game' && known?.categoryIcons && !known.categoryIcons.has(c.icon.gfx))
      at('aviso', `el ícono ${c.icon.gfx} no está en el juego.`)
  }
  const ids = new Set<string>()
  for (const d of p.decisions ?? []) {
    const at = (severity: DecisionIssue['severity'], m: string): number =>
      out.push({ severity, message: `Decisión ${d.id}: ${m}`, uid: d.uid })
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(d.id))
      at('error', 'el ID solo admite letras, números y _.')
    if (ids.has(d.id)) at('error', 'ID repetido.')
    ids.add(d.id)
    if (!d.name.trim()) at('error', 'falta el nombre.')
    if (!d.categoryUid || !cats.some((c) => c.uid === d.categoryUid))
      at('error', 'no tiene categoría: no aparecería en el juego.')
    if (
      d.icon?.kind === 'asset' &&
      !p.icons.some((a) => a.id === (d.icon as { assetId: string }).assetId)
    )
      at('error', 'el ícono de la biblioteca ya no existe.')
    if (d.icon?.kind === 'game' && known?.icons && !known.icons.has(d.icon.gfx))
      at('aviso', `el ícono ${d.icon.gfx} no está en el juego.`)
    if (d.aiBase <= 0 && !d.aiModifiers.length)
      at(
        'aviso',
        'sin ai_will_do: la IA nunca la elegirá (pon un peso base si quieres que la use).'
      )
    if (d.kind === 'mission') {
      if (d.visible.code.trim())
        at('aviso', 'una misión con "visible": no funciona en misiones (usa activación).')
      if (d.missionTimeoutDays <= 0)
        at('aviso', 'la misión no tiene tiempo límite (days_mission_timeout).')
      if (!allScripts.some((s) => new RegExp(`activate_mission\\s*=\\s*${d.id}\\b`).test(s)))
        at('aviso', 'nadie la activa: usa el bloque "Activar misión" en algún efecto.')
    }
    if (d.cost.mode === 'custom' && !/=\s*-\s*\d|_factor\s*=\s*-/.test(d.complete.code))
      at(
        'aviso',
        'costo personalizado sin restarlo en los efectos: el juego no cobra nada por sí solo.'
      )
    if (d.cost.mode === 'custom' && !d.cost.customTrigger.code.trim())
      at('error', 'el costo personalizado necesita su condición (custom_cost_trigger).')
    if (d.kind === 'target-country' && !d.targetCountries.length && !d.targetTrigger.code.trim())
      at('error', 'con objetivo: elige países o escribe una condición de objetivo.')
    if (d.kind === 'target-state' && !d.targetStates.length && !d.targetTrigger.code.trim())
      at('error', 'con objetivo: elige estados o escribe una condición de objetivo.')
    if (d.daysRemove <= 0 && (d.remove.code.trim() || d.modifiers.length))
      at('aviso', 'tiene efecto/modificador de temporizador pero days_remove es 0.')
  }
  return out
}
