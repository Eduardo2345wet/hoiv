// Eventos: operaciones sobre Project, generador de events/<mod>_<namespace>.txt (+ imágenes y
// localización) y reglas del validador. Sintaxis según la wiki (Event modding).
import type { Project } from '../types'
import { newUid } from '../types'
import { safeFolderName } from '../../../shared/names'
import { block, file, kv, raw, str, type Node } from '../export/clausewitz'
import { localisationFiles, type LocText } from '../export/localisation'
import type { ModFile } from '../export/exportMod'
import { registerSectionGenerator } from './generators'
import { emptyScript, type BlockScript, type EventPicture, type GameEvent } from './types'

/** Tamaño de las imágenes de evento del juego. por verificar: leerlo de un .dds de gfx/event_pictures */
export const EVENT_PICTURE_SIZE = { w: 210, h: 176 }
/** Días por defecto para elegir (timeout_days del juego) */
export const DEFAULT_TIMEOUT_DAYS = 13

export const eventId = (e: Pick<GameEvent, 'namespace' | 'number'>): string =>
  `${e.namespace}.${e.number}`
export const defaultNamespace = (p: Project): string => safeFolderName(p.modName)

export function newEvent(p: Project, over: Partial<GameEvent> = {}): GameEvent {
  const namespace = over.namespace ?? defaultNamespace(p)
  // Número libre: sin repetir dentro del namespace (siempre entero y < 100000)
  const used = new Set(p.events.filter((e) => e.namespace === namespace).map((e) => e.number))
  let number = over.number ?? 1
  while (used.has(number)) number++
  return {
    uid: newUid(),
    type: 'country_event',
    namespace,
    number,
    countries: [],
    title: '',
    description: '',
    titleVariants: [],
    descVariants: [],
    picture: null,
    trigger: emptyScript(),
    immediate: emptyScript(),
    after: emptyScript(),
    options: [
      { uid: newUid(), name: '', trigger: emptyScript(), effects: emptyScript(), aiBase: 1 }
    ],
    mtthDays: 0,
    timeoutDays: 0,
    flags: {
      triggeredOnly: true,
      fireOnlyOnce: false,
      major: false,
      hidden: false,
      minorFlavor: false
    },
    ...over
  }
}

export function createEvent(
  p: Project,
  over: Partial<GameEvent> = {}
): { project: Project; event: GameEvent } {
  const event = newEvent(p, over)
  return { project: { ...p, events: [...p.events, event] }, event }
}

export function duplicateEvent(
  p: Project,
  uid: string
): { project: Project; event: GameEvent } | null {
  const src = p.events.find((e) => e.uid === uid)
  if (!src) return null
  const copy = newEvent(p, {
    ...JSON.parse(JSON.stringify(src)),
    uid: newUid(),
    number: src.number + 1,
    title: src.title ? `${src.title} (copia)` : ''
  })
  copy.options = copy.options.map((o) => ({ ...o, uid: newUid() }))
  return { project: { ...p, events: [...p.events, copy] }, event: copy }
}

export const updateEvent = (p: Project, uid: string, patch: Partial<GameEvent>): Project => ({
  ...p,
  events: p.events.map((e) => (e.uid === uid ? { ...e, ...patch } : e))
})
export const deleteEvent = (p: Project, uid: string): Project => ({
  ...p,
  events: p.events.filter((e) => e.uid !== uid)
})

/** Plantillas de partida (no son datos de ejemplo: solo se crean cuando el usuario las pide) */
export type EventTemplate = 'noticias' | 'oculto' | 'eleccion'
export const EVENT_TEMPLATES: { id: EventTemplate; label: string }[] = [
  { id: 'noticias', label: 'Evento de noticias mundial' },
  { id: 'oculto', label: 'Evento oculto con retraso' },
  { id: 'eleccion', label: 'Elección con 2 caminos' }
]
export function eventFromTemplate(p: Project, t: EventTemplate): GameEvent {
  const opt = (name: string): GameEvent['options'][number] => ({
    uid: newUid(),
    name,
    trigger: emptyScript(),
    effects: emptyScript(),
    aiBase: 1
  })
  if (t === 'noticias')
    return newEvent(p, {
      type: 'news_event',
      title: 'Titular',
      description: 'Texto de la noticia.',
      flags: {
        triggeredOnly: true,
        fireOnlyOnce: false,
        major: true,
        hidden: false,
        minorFlavor: false
      },
      options: [opt('Entendido')]
    })
  if (t === 'oculto')
    return newEvent(p, {
      flags: {
        triggeredOnly: true,
        fireOnlyOnce: false,
        major: false,
        hidden: true,
        minorFlavor: false
      },
      options: [opt('')]
    })
  return newEvent(p, {
    title: 'Una decisión',
    description: 'Elige un camino.',
    options: [opt('Camino A'), opt('Camino B')]
  })
}

/** Eventos a los que apunta un script (country_event = { id = X … }) */
export function linkedEventIds(code: string): string[] {
  const out: string[] = []
  for (const m of code.matchAll(
    /(?:country|news|state)_event\s*=\s*\{[^}]*?\bid\s*=\s*([A-Za-z0-9_.]+)/g
  ))
    out.push(m[1])
  return out
}
export function eventLinks(p: Project): { from: string; to: string }[] {
  const idOf = new Map(p.events.map((e) => [eventId(e), e.uid]))
  const out: { from: string; to: string }[] = []
  for (const e of p.events)
    for (const code of [e.immediate.code, e.after.code, ...e.options.map((o) => o.effects.code)])
      for (const id of linkedEventIds(code)) {
        const to = idOf.get(id)
        if (to) out.push({ from: e.uid, to })
      }
  return out
}

// ---------------------------------------------------------------- generación

const sc = (key: string, s: BlockScript): Node[] =>
  s.code.trim() ? [block(key, [raw(s.code)])] : []

function pictureGfx(p: Project, e: GameEvent): string | null {
  const pic = e.picture
  if (!pic) return null
  return pic.kind === 'game'
    ? pic.gfx
    : `GFX_${safeFolderName(p.modName)}_event_${e.namespace}_${e.number}`
}

function textNodes(
  key: 'title' | 'desc',
  base: string,
  variants: { trigger: BlockScript }[],
  keys: string[]
): Node[] {
  if (!variants.length) return [kv(key, base)]
  const out: Node[] = variants.map((v, i) =>
    block(key, [
      kv('text', keys[i]),
      ...(v.trigger.code.trim() ? [block('trigger', [raw(v.trigger.code)])] : [])
    ])
  )
  out.push(kv(key, base))
  return out
}

/** Clave de localización de cada texto de un evento */
export const eventKeys = (
  e: GameEvent
): { t: string; d: string; tv: string[]; dv: string[]; opts: string[] } => {
  const id = eventId(e)
  return {
    t: `${id}.t`,
    d: `${id}.d`,
    tv: e.titleVariants.map((_, i) => `${id}.t.v${i + 1}`),
    dv: e.descVariants.map((_, i) => `${id}.d.v${i + 1}`),
    opts: e.options.map(
      (_, i) => `${id}.${String.fromCharCode(97 + (i % 26))}${i >= 26 ? Math.floor(i / 26) : ''}`
    )
  }
}

/** Nodos de un evento. `major` es obligatorio en news_event y no se combina con fire_only_once */
export function eventNode(p: Project, e: GameEvent): Node {
  const k = eventKeys(e)
  const fl = e.flags
  const isNews = e.type === 'news_event'
  const major = isNews || fl.major
  const kids: Node[] = [kv('id', eventId(e))]
  if (!fl.hidden) kids.push(...textNodes('title', k.t, e.titleVariants, k.tv))
  kids.push(...textNodes('desc', k.d, e.descVariants, k.dv))
  const pic = pictureGfx(p, e)
  if (pic) kids.push(kv('picture', pic))
  if (fl.triggeredOnly) kids.push(kv('is_triggered_only', true))
  if (fl.fireOnlyOnce && !major) kids.push(kv('fire_only_once', true))
  if (major) kids.push(kv('major', true))
  if (fl.hidden) kids.push(kv('hidden', true))
  if (fl.minorFlavor) kids.push(kv('minor_flavor', true))
  if (e.timeoutDays > 0) kids.push(kv('timeout_days', e.timeoutDays))
  if (!fl.triggeredOnly && e.mtthDays > 0)
    kids.push(block('mean_time_to_happen', [kv('days', e.mtthDays)]))
  // Un evento automático solo para ciertos países: el trigger lleva su tag
  const tagCond: Node[] =
    !fl.triggeredOnly && e.countries.length
      ? e.countries.length === 1
        ? [kv('tag', e.countries[0])]
        : [
            block(
              'OR',
              e.countries.map((t) => kv('tag', t))
            )
          ]
      : []
  const trig = e.trigger.code.trim() ? [raw(e.trigger.code)] : []
  if (tagCond.length || trig.length) kids.push(block('trigger', [...tagCond, ...trig]))
  kids.push(...sc('immediate', e.immediate))
  if (e.extraText?.trim()) kids.push(raw(e.extraText))
  e.options.forEach((o, i) => {
    const on: Node[] = [kv('name', k.opts[i])]
    if (o.trigger.code.trim()) on.push(block('trigger', [raw(o.trigger.code)]))
    if (o.aiBase > 0) on.push(block('ai_chance', [kv('base', o.aiBase)]))
    if (o.effects.code.trim()) on.push(raw(o.effects.code))
    kids.push(block('option', on))
  })
  kids.push(...sc('after', e.after))
  return block(e.type, kids)
}

/** events/<mod>_<namespace>.txt: un archivo por namespace */
export function eventFiles(p: Project): ModFile[] {
  const mod = safeFolderName(p.modName)
  const byNs = new Map<string, GameEvent[]>()
  for (const e of p.events) byNs.set(e.namespace, [...(byNs.get(e.namespace) ?? []), e])
  return [...byNs.entries()].map(([ns, list_]) => ({
    path: `events/${mod}_${ns}.txt`,
    text: file([kv('add_namespace', ns), ...list_.map((e) => eventNode(p, e))])
  }))
}

/** Archivo .gfx con un sprite por cada imagen propia (subida o de la biblioteca) */
export function eventGfx(p: Project): ModFile[] {
  const own = p.events.filter((e) => e.picture && e.picture.kind !== 'game')
  if (!own.length) return []
  const mod = safeFolderName(p.modName)
  const sprites = own.map((e) =>
    block('SpriteType', [str('name', pictureGfx(p, e)!), str('texturefile', eventImagePath(p, e))])
  )
  return [{ path: `interface/${mod}_events.gfx`, text: file([block('spriteTypes', sprites)]) }]
}

export const eventImagePath = (p: Project, e: GameEvent): string =>
  `gfx/event_pictures/${safeFolderName(p.modName)}_${e.namespace}_${e.number}.dds`

/** Imagen (PNG) de un evento con imagen propia */
export function eventPng(p: Project, pic: EventPicture | null): string | null {
  if (!pic || pic.kind === 'game') return null
  if (pic.kind === 'upload') return pic.png
  return p.icons.find((a) => a.id === pic.assetId)?.png ?? null
}

export function eventLoc(p: Project): ModFile[] {
  const entries: Record<string, LocText> = {}
  for (const e of p.events) {
    const k = eventKeys(e)
    if (!e.flags.hidden) entries[k.t] = e.title
    entries[k.d] = e.description
    e.titleVariants.forEach((v, i) => (entries[k.tv[i]] = v.text))
    e.descVariants.forEach((v, i) => (entries[k.dv[i]] = v.text))
    e.options.forEach((o, i) => (entries[k.opts[i]] = o.name))
  }
  return localisationFiles(p, 'events', entries)
}

/** Rutas de las imágenes DDS (para planificar y para generarlas con el lector de imágenes) */
export const eventImagePaths = (p: Project): string[] =>
  (p.events ?? []).filter((e) => eventPng(p, e.picture)).map((e) => eventImagePath(p, e))

registerSectionGenerator({
  id: 'eventos',
  generate: (p) => (p.events?.length ? [...eventFiles(p), ...eventGfx(p), ...eventLoc(p)] : [])
})

// ---------------------------------------------------------------- validación

export interface EventIssue {
  severity: 'error' | 'aviso'
  message: string
  uid: string
}

export function validateEvents(p: Project, knownPictures?: Set<string>): EventIssue[] {
  const out: EventIssue[] = []
  const seen = new Map<string, string>()
  for (const e of p.events ?? []) {
    const id = eventId(e)
    const at = (severity: EventIssue['severity'], message: string): number =>
      out.push({ severity, message: `Evento ${id}: ${message}`, uid: e.uid })
    if (!/^[a-z][a-z0-9_]*$/.test(e.namespace))
      at('error', 'el namespace debe ser minúsculas, números y _ (y empezar con letra).')
    if (!Number.isInteger(e.number) || e.number < 1 || e.number >= 100000)
      at(
        'error',
        'el número debe ser un entero entre 1 y 99999 (si no, choca con otros namespaces).'
      )
    if (seen.has(id)) at('error', 'ID repetido.')
    seen.set(id, e.uid)
    if (e.type === 'news_event') {
      if (!e.flags.major)
        at(
          'error',
          'un evento de noticias necesita major = yes (se activa solo al exportar, actívalo para verlo).'
        )
      if (e.flags.fireOnlyOnce)
        at('error', 'un evento de noticias con major no se combina con fire_only_once.')
    }
    if (!e.flags.triggeredOnly) {
      if (!e.countries.length && !/\btag\s*=/.test(e.trigger.code))
        at(
          'aviso',
          'es automático y no limita el país: le puede pasar a cualquiera (agrega un país o un "es el país").'
        )
    } else if (e.mtthDays > 0)
      at('error', 'tiene is_triggered_only y mean_time_to_happen: el MTTH nunca se usa.')
    if (!e.flags.hidden && !e.options.some((o) => !o.trigger.code.trim()))
      at(
        'error',
        'necesita al menos una opción sin condición (si todas son falsas, la ventana queda sin botones).'
      )
    if (!e.flags.hidden && !e.title.trim()) at('error', 'falta el título (clave de localización).')
    if (!e.description.trim() && !e.flags.hidden) at('aviso', 'falta la descripción.')
    e.options.forEach((o, i) => {
      if (!o.name.trim() && !e.flags.hidden) at('error', `la opción ${i + 1} no tiene texto.`)
    })
    const pic = e.picture
    if (pic?.kind === 'asset' && !p.icons.some((a) => a.id === pic.assetId))
      at('error', 'la imagen de la biblioteca ya no existe.')
    if (pic?.kind === 'game' && knownPictures && !knownPictures.has(pic.gfx))
      at('aviso', `la imagen ${pic.gfx} no está en el juego.`)
    for (const t of [e.immediate.code, e.after.code, ...e.options.map((o) => o.effects.code)])
      for (const target of linkedEventIds(t))
        if (!p.events.some((x) => eventId(x) === target) && target.split('.')[0] === e.namespace)
          at('error', `lanza el evento ${target}, que no existe.`)
  }
  return out
}
