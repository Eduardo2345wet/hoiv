// Operaciones puras sobre el proyecto (crear, mover, conectar, renombrar, borrar...).
// Siempre devuelven un proyecto NUEVO (React necesita objetos nuevos para redibujar).
import {
  EMPTY_SCRIPTS,
  newUid,
  type Focus,
  type IconAsset,
  type IconRef,
  type IconTarget,
  type Idea,
  type Project
} from '../types'
import { pickAutoEmoji, normalize } from '../icons/emojiData'
import { renderEmojiIcon } from '../icons/renderer'
import { DEFAULT_COLOR, ICON_SIZES } from '../icons/sizes'

// ======================= Íconos =======================

/** Crea (o vuelve a dibujar) el ícono automático de un foco/espíritu según su nombre */
function autoAsset(
  p: Project,
  ownerUid: string,
  target: IconTarget,
  name: string,
  label: string
): Project {
  const assetId = `auto_${ownerUid}`
  const old = p.icons.find((a) => a.id === assetId)
  const emoji = pickAutoEmoji(name)
  const color = old?.recipe?.color ?? DEFAULT_COLOR[target]
  if (old && old.recipe?.emoji === emoji && old.png) return p
  const recipe = { emoji, color }
  const asset: IconAsset = {
    id: assetId,
    name: label,
    target,
    png: renderEmojiIcon(recipe, target),
    width: ICON_SIZES[target].w,
    height: ICON_SIZES[target].h,
    recipe
  }
  return {
    ...p,
    icons: old ? p.icons.map((a) => (a.id === assetId ? asset : a)) : [...p.icons, asset]
  }
}

/** ¿Quién usa este ícono? Devuelve nombres legibles */
export function assetUsage(p: Project, assetId: string): string[] {
  const used = (r: IconRef | null): boolean => r?.kind === 'asset' && r.assetId === assetId
  return [
    ...p.focuses.filter((f) => used(f.icon)).map((f) => `foco "${f.name || f.id}"`),
    ...p.ideas.filter((i) => used(i.icon)).map((i) => `espíritu "${i.name || i.id}"`)
  ]
}

/** Borra los íconos automáticos que ya nadie usa */
function dropUnusedAuto(p: Project): Project {
  const icons = p.icons.filter((a) => !a.id.startsWith('auto_') || assetUsage(p, a.id).length > 0)
  return icons.length === p.icons.length ? p : { ...p, icons }
}

export function addAsset(p: Project, asset: IconAsset): Project {
  return { ...p, icons: [...p.icons.filter((a) => a.id !== asset.id), asset] }
}

export function updateAsset(p: Project, id: string, patch: Partial<IconAsset>): Project {
  return {
    ...p,
    icons: p.icons.map((a) => (a.id === id ? { ...a, ...patch } : a))
  }
}

/** Borra un ícono de la biblioteca; quien lo usaba vuelve al ícono automático */
export function removeAsset(p: Project, id: string): Project {
  let next: Project = { ...p, icons: p.icons.filter((a) => a.id !== id) }
  for (const f of next.focuses)
    if (f.icon.kind === 'asset' && f.icon.assetId === id) next = resetFocusIcon(next, f.uid)
  for (const i of next.ideas)
    if (i.icon?.kind === 'asset' && i.icon.assetId === id) next = resetIdeaIcon(next, i.uid)
  return next
}

/** El usuario eligió un ícono a mano: ya no es automático */
export function setFocusIcon(p: Project, uid: string, icon: IconRef): Project {
  return dropUnusedAuto(updateFocus(p, uid, { icon, iconAuto: false }))
}
export function setIdeaIcon(p: Project, uid: string, icon: IconRef): Project {
  return dropUnusedAuto(updateIdea(p, uid, { icon, iconAuto: false }))
}

/** "Restablecer al automático" */
export function resetFocusIcon(p: Project, uid: string): Project {
  const f = p.focuses.find((x) => x.uid === uid)
  if (!f) return p
  const withAsset = autoAsset(p, uid, 'focus', f.name, f.id)
  return updateFocus(withAsset, uid, {
    icon: { kind: 'asset', assetId: `auto_${uid}` },
    iconAuto: true
  })
}
export function resetIdeaIcon(p: Project, uid: string): Project {
  const i = p.ideas.find((x) => x.uid === uid)
  if (!i) return p
  const withAsset = autoAsset(p, uid, 'idea', i.name, i.id)
  return updateIdea(withAsset, uid, {
    icon: { kind: 'asset', assetId: `auto_${uid}` },
    iconAuto: true
  })
}

// ======================= Focos =======================

/** Crea un foco con ícono automático en la casilla x,y */
export function createFocus(
  p: Project,
  x: number,
  y: number,
  name?: string,
  treeId?: string
): { project: Project; focus: Focus } {
  // Árbol: el indicado o el primero; si no hay ninguno, se crea uno
  let base = p
  let tree = treeId ?? p.focusTrees?.[0]?.id
  if (!tree) {
    tree = 'arbol_1'
    base = { ...p, focusTrees: [...(p.focusTrees ?? []), { id: tree, name: 'Árbol de focos' }] }
  }
  // Prefijo del id: el tag del país dueño del árbol
  const tag = base.countries?.find((c) => c.focusTreeId === tree)?.tag ?? p.tag
  let n = base.focuses.length + 1
  while (base.focuses.some((f) => f.id === `${tag}_foco_${n}`)) n++
  const uid = newUid()
  const focus: Focus = {
    uid,
    treeId: tree,
    id: name ? uniqueId(base, `${tag}_${slug(name)}`) : `${tag}_foco_${n}`,
    name: name ?? `Foco ${n}`,
    description: '',
    cost: 10,
    icon: { kind: 'asset', assetId: `auto_${uid}` },
    iconAuto: true,
    x,
    y,
    prerequisites: [],
    mutuallyExclusive: [],
    blocks: null,
    scripts: { ...EMPTY_SCRIPTS }
  }
  let next: Project = { ...base, focuses: [...base.focuses, focus] }
  next = autoAsset(next, uid, 'focus', focus.name, focus.id)
  return { project: next, focus }
}

/** Crea un foco en la primera casilla libre debajo de otro */
export function createFocusBelow(
  p: Project,
  parentUid: string | null,
  name?: string,
  treeId?: string
): { project: Project; focus: Focus } {
  const parent = p.focuses.find((f) => f.uid === parentUid)
  const tree = parent?.treeId ?? treeId ?? p.focusTrees?.[0]?.id
  const y = parent ? parent.y + 1 : 0
  let x = parent ? parent.x : 0
  while (p.focuses.some((f) => f.treeId === tree && f.x === x && f.y === y)) x++
  return createFocus(p, x, y, name, tree)
}

export function updateFocus(p: Project, uid: string, patch: Partial<Focus>): Project {
  return {
    ...p,
    focuses: p.focuses.map((f) => (f.uid === uid ? { ...f, ...patch } : f))
  }
}

/** Cambia el nombre; si el ícono sigue siendo automático, vuelve a elegir el emoji */
export function setFocusName(p: Project, uid: string, name: string): Project {
  let next = updateFocus(p, uid, { name })
  const f = next.focuses.find((x) => x.uid === uid)
  if (f?.iconAuto) next = autoAsset(next, uid, 'focus', name, f.id)
  return next
}

// ---- Referencias dentro de los bloques ----
const FOCUS_REFS: Record<string, string> = {
  cond_has_completed_focus: 'FOCUS'
}
const IDEA_REFS: Record<string, string> = {
  cond_has_idea: 'IDEA',
  eff_add_ideas: 'IDEA',
  eff_remove_ideas: 'IDEA'
}

/** Recorre el JSON de Blockly y cambia old → new en los campos indicados */
/* eslint-disable @typescript-eslint/no-explicit-any */
export function replaceBlockRefs(
  json: any,
  refs: Record<string, string>,
  oldId: string,
  newId: string
): any {
  if (Array.isArray(json)) return json.map((x) => replaceBlockRefs(x, refs, oldId, newId))
  if (!json || typeof json !== 'object') return json
  const out: any = {}
  for (const k of Object.keys(json)) out[k] = replaceBlockRefs(json[k], refs, oldId, newId)
  const field = refs[out.type]
  if (field && out.fields && out.fields[field] === oldId)
    out.fields = { ...out.fields, [field]: newId }
  return out
}

function replaceScriptRefs(text: string, keys: string[], oldId: string, newId: string): string {
  const esc = oldId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(\\b(?:${keys.join('|')}) = )${esc}(?=\\s|$)`, 'g')
  return text.replace(re, `$1${newId}`)
}

function renameRefsEverywhere(
  p: Project,
  refs: Record<string, string>,
  keys: string[],
  oldId: string,
  newId: string
): Project {
  if (!oldId || oldId === newId) return p
  return {
    ...p,
    focuses: p.focuses.map((f) => ({
      ...f,
      blocks: f.blocks ? replaceBlockRefs(f.blocks, refs, oldId, newId) : f.blocks,
      scripts: {
        available: replaceScriptRefs(f.scripts.available, keys, oldId, newId),
        bypass: replaceScriptRefs(f.scripts.bypass, keys, oldId, newId),
        reward: replaceScriptRefs(f.scripts.reward, keys, oldId, newId)
      }
    }))
  }
}

/**
 * Cambia el id de un foco y actualiza todas sus referencias en los bloques.
 * (Prerrequisitos y excluyentes se guardan por uid, así que no cambian.)
 */
export function renameFocusId(p: Project, uid: string, newId: string): Project {
  const f = p.focuses.find((x) => x.uid === uid)
  if (!f) return p
  const renamed = updateFocus(p, uid, { id: newId })
  // Solo se actualizan referencias si ningún otro foco usaba ya el id viejo
  if (p.focuses.some((x) => x.uid !== uid && x.id === f.id)) return renamed
  return renameRefsEverywhere(renamed, FOCUS_REFS, ['has_completed_focus'], f.id, newId)
}

/** Borra un foco y limpia las líneas que apuntaban a él (los bloques quedan como "ya no existe") */
export function deleteFocus(p: Project, uid: string): Project {
  return dropUnusedAuto({
    ...p,
    focuses: p.focuses
      .filter((f) => f.uid !== uid)
      .map((f) => ({
        ...f,
        prerequisites: f.prerequisites.filter((u) => u !== uid),
        mutuallyExclusive: f.mutuallyExclusive.filter((u) => u !== uid)
      }))
  })
}

/** Añade o quita el prerrequisito "parent → child" */
export function togglePrerequisite(p: Project, parent: string, child: string): Project {
  if (parent === child) return p
  return {
    ...p,
    focuses: p.focuses.map((f) => {
      if (f.uid !== child) return f
      const has = f.prerequisites.includes(parent)
      return {
        ...f,
        prerequisites: has
          ? f.prerequisites.filter((u) => u !== parent)
          : [...f.prerequisites, parent]
      }
    })
  }
}

/** Añade o quita la exclusión mutua entre a y b (se guarda en los dos) */
export function toggleExclusive(p: Project, a: string, b: string): Project {
  if (a === b) return p
  const target = p.focuses.find((f) => f.uid === a)
  const has = !!target?.mutuallyExclusive.includes(b)
  return {
    ...p,
    focuses: p.focuses.map((f) => {
      const other = f.uid === a ? b : f.uid === b ? a : null
      if (!other) return f
      const list = f.mutuallyExclusive.filter((u) => u !== other)
      return { ...f, mutuallyExclusive: has ? list : [...list, other] }
    })
  }
}

// ======================= Espíritus nacionales =======================

/** "Industria Pesada" → "industria_pesada" (ASCII, minúsculas, _) */
export function slug(text: string): string {
  return (
    normalize(text)
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'sin_nombre'
  )
}

function uniqueId(p: Project, base: string, ignoreUid?: string): string {
  const taken = new Set([
    ...p.ideas.filter((i) => i.uid !== ignoreUid).map((i) => i.id),
    ...p.focuses.filter((f) => f.uid !== ignoreUid).map((f) => f.id)
  ])
  let id = base
  let n = 2
  while (taken.has(id)) id = `${base}_${n++}`
  return id
}

export function ideaIdFor(p: Project, name: string, ignoreUid?: string): string {
  return uniqueId(p, `${p.countries?.[0]?.tag ?? p.tag}_${slug(name)}`, ignoreUid)
}

export function createIdea(p: Project, name = 'Nuevo espíritu'): { project: Project; idea: Idea } {
  const uid = newUid()
  const idea: Idea = {
    uid,
    id: ideaIdFor(p, name),
    idAuto: true,
    name,
    description: '',
    modifiers: [{ key: 'stability_factor', value: 5 }],
    icon: { kind: 'asset', assetId: `auto_${uid}` },
    iconAuto: true
  }
  let next: Project = { ...p, ideas: [...p.ideas, idea] }
  next = autoAsset(next, uid, 'idea', name, idea.id)
  return { project: next, idea }
}

export function updateIdea(p: Project, uid: string, patch: Partial<Idea>): Project {
  return {
    ...p,
    ideas: p.ideas.map((i) => (i.uid === uid ? { ...i, ...patch } : i))
  }
}

/** Cambia el id de un espíritu y actualiza has_idea / add_ideas / remove_ideas */
export function renameIdeaId(p: Project, uid: string, newId: string): Project {
  const i = p.ideas.find((x) => x.uid === uid)
  if (!i) return p
  const renamed = updateIdea(p, uid, { id: newId })
  return renameRefsEverywhere(
    renamed,
    IDEA_REFS,
    ['has_idea', 'add_ideas', 'remove_ideas'],
    i.id,
    newId
  )
}

/** Cambia el nombre; si el id/ícono siguen automáticos, se regeneran */
export function setIdeaName(p: Project, uid: string, name: string): Project {
  let next = updateIdea(p, uid, { name })
  const i = next.ideas.find((x) => x.uid === uid)!
  if (i.idAuto) next = renameIdeaId(next, uid, ideaIdFor(next, name, uid))
  if (i.iconAuto) next = autoAsset(next, uid, 'idea', name, i.id)
  return next
}

export function deleteIdea(p: Project, uid: string): Project {
  return dropUnusedAuto({ ...p, ideas: p.ideas.filter((i) => i.uid !== uid) })
}
