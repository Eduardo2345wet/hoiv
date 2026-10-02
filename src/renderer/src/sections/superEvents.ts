// Súper eventos: ventana grande propia (scripted GUI + .gui + .gfx + sonido). No existen en el
// juego base; se generan con un sistema propio (nada copiado de otros mods).
import type { Project } from '../types'
import { newUid } from '../types'
import { safeFolderName } from '../../../shared/names'
import { block, file, kv, raw, str, type Node } from '../export/clausewitz'
import { localisationFiles, type LocText } from '../export/localisation'
import type { ModFile } from '../export/exportMod'
import { registerSectionGenerator } from './generators'
import { eventPng } from './events'
import type { SuperEvent } from './types'

// por verificar en el juego: posiciones y tamaños de la ventana (px), y el nombre de los eventos
// de botón del scripted GUI (<botón>_click_enabled / <botón>_click)
export const SUPER_WINDOW = { width: 800, height: 520 }
export const SUPER_IMAGE_SIZE = { w: 760, h: 300 }
/** por verificar con documentation/effects_documentation: sintaxis del efecto que reproduce el sonido */
export const SOUND_EFFECT = (soundName: string): string => `play_song = { song = "${soundName}" }`

export const superPrefix = (p: Project): string => safeFolderName(p.modName)
export const superEffectName = (id: string): string => `${id}_show`

/** id sugerido: <mod>_<nombre> */
export function superIdFor(p: Project, name: string): string {
  const base = `${superPrefix(p)}_${safeFolderName(name).replace(/^mi_mod$/, 'super')}`
  const taken = new Set(p.superEvents.map((s) => s.id))
  let id = base
  for (let n = 2; taken.has(id); n++) id = `${base}_${n}`
  return id
}

export function newSuperEvent(p: Project, over: Partial<SuperEvent> = {}): SuperEvent {
  return {
    uid: newUid(),
    id: superIdFor(p, over.title || 'super_evento'),
    title: '',
    quote: '',
    author: '',
    button: 'Continuar',
    image: null,
    sound: null,
    audience: 'self',
    countries: [],
    queue: true,
    ...over
  }
}
export function createSuperEvent(
  p: Project,
  over: Partial<SuperEvent> = {}
): { project: Project; superEvent: SuperEvent } {
  const superEvent = newSuperEvent(p, over)
  return { project: { ...p, superEvents: [...p.superEvents, superEvent] }, superEvent }
}
export const updateSuperEvent = (p: Project, uid: string, patch: Partial<SuperEvent>): Project => ({
  ...p,
  superEvents: p.superEvents.map((s) => (s.uid === uid ? { ...s, ...patch } : s))
})
export const deleteSuperEvent = (p: Project, uid: string): Project => ({
  ...p,
  superEvents: p.superEvents.filter((s) => s.uid !== uid)
})

/** ¿Es un WAV PCM sin comprimir? (los efectos de sonido del juego solo aceptan .wav) */
export function isPcmWav(base64: string): boolean {
  try {
    const b = Buffer.from(base64, 'base64')
    if (
      b.length < 44 ||
      b.toString('latin1', 0, 4) !== 'RIFF' ||
      b.toString('latin1', 8, 12) !== 'WAVE'
    )
      return false
    let i = 12
    while (i + 8 <= b.length) {
      const id = b.toString('latin1', i, i + 4)
      const size = b.readUInt32LE(i + 4)
      if (id === 'fmt ') return b.readUInt16LE(i + 8) === 1
      i += 8 + size + (size % 2)
    }
  } catch {
    // no es un WAV legible
  }
  return false
}

const soundName = (s: SuperEvent): string => `${s.id}_sfx`
export const superImagePath = (s: SuperEvent): string => `gfx/super_events/${s.id}.dds`
export const superSoundPath = (s: SuperEvent): string => `sound/${s.id}.wav`
const sprite = (s: SuperEvent): string => `GFX_${s.id}_image`

export const superImagePaths = (p: Project): string[] =>
  (p.superEvents ?? []).filter((s) => eventPng(p, s.image)).map(superImagePath)

/** Efecto guardado: <id>_show = yes. Solo humanos; con cola o reemplazando la ventana abierta */
function showEffect(p: Project, s: SuperEvent): Node[] {
  const others = p.superEvents.filter((o) => o.uid !== s.uid)
  const forHuman = (inner: Node[]): Node[] => [
    block('if', [block('limit', [kv('is_ai', false)]), ...inner])
  ]
  const apply: Node[] = [
    ...(s.queue ? [] : others.map((o) => kv('clr_country_flag', o.id))),
    kv('set_country_flag', s.id),
    ...(s.sound ? [raw(SOUND_EFFECT(soundName(s)))] : [])
  ]
  if (s.audience === 'self') return forHuman(apply)
  if (s.audience === 'all')
    return [block('every_country', [block('limit', [kv('is_ai', false)]), ...apply])]
  return s.countries.map((t) => block(t, forHuman(apply)))
}

export function superEventFiles(p: Project): ModFile[] {
  const mod = superPrefix(p)
  const list = p.superEvents
  const out: ModFile[] = []
  // Efectos: <id>_show
  out.push({
    path: `common/scripted_effects/${mod}_super_events.txt`,
    text: file(list.map((s) => block(superEffectName(s.id), showEffect(p, s))))
  })
  // Un scripted_gui por súper evento; la cola respeta el orden de la lista
  out.push({
    path: `common/scripted_guis/${mod}_super_events.txt`,
    text: file([
      block(
        'scripted_gui',
        list.map((s, i) => {
          const earlier = list.slice(0, i).map((o) => kv('has_country_flag', o.id))
          const visible: Node[] = [
            kv('has_country_flag', s.id),
            ...(s.queue && earlier.length ? [block('NOT', [block('OR', earlier)])] : [])
          ]
          return block(`${s.id}_gui`, [
            kv('context_type', 'player_context'),
            str('window_name', `${s.id}_window`),
            block('visible', visible),
            block('triggers', [block(`${s.id}_close_click_enabled`, [kv('always', true)])]),
            block('effects', [block(`${s.id}_close_click`, [kv('clr_country_flag', s.id)])])
          ])
        })
      )
    ])
  })
  // Ventana (.gui) y sprites (.gfx)
  const W = SUPER_WINDOW
  out.push({
    path: `interface/${mod}_super_events.gui`,
    text: file([
      block(
        'guiTypes',
        list.map((s) =>
          block('containerWindowType', [
            str('name', `${s.id}_window`),
            block('position', [kv('x', -W.width / 2), kv('y', -W.height / 2)]),
            block('size', [kv('width', W.width), kv('height', W.height)]),
            str('orientation', 'CENTER'),
            str('origo', 'CENTER'),
            block('iconType', [
              str('name', 'frame'),
              str('spriteType', 'GFX_tiled_window'),
              block('position', [kv('x', 0), kv('y', 0)])
            ]),
            block('iconType', [
              str('name', 'image'),
              str('spriteType', sprite(s)),
              block('position', [kv('x', 20), kv('y', 20)])
            ]),
            block('instantTextBoxType', [
              str('name', 'title'),
              block('position', [kv('x', 20), kv('y', 330)]),
              block('textBoxSize', [kv('x', 760), kv('y', 40)]),
              str('text', `${s.id}_title`),
              str('font', 'hoi_20mb')
            ]),
            block('instantTextBoxType', [
              str('name', 'quote'),
              block('position', [kv('x', 20), kv('y', 380)]),
              block('textBoxSize', [kv('x', 760), kv('y', 80)]),
              str('text', `${s.id}_quote`),
              str('font', 'hoi_18mbs')
            ]),
            block('buttonType', [
              str('name', `${s.id}_close`),
              block('position', [kv('x', 330), kv('y', 470)]),
              str('quadTextureSprite', 'GFX_tiny_button'),
              str('buttonText', `${s.id}_button`),
              str('buttonFont', 'hoi_18mbs')
            ])
          ])
        )
      )
    ])
  })
  out.push({
    path: `interface/${mod}_super_events.gfx`,
    text: file([
      block(
        'spriteTypes',
        list.map((s) =>
          block('SpriteType', [str('name', sprite(s)), str('texturefile', superImagePath(s))])
        )
      )
    ])
  })
  // Sonidos: sound + soundeffect por cada .wav
  const withSound = list.filter((s) => s.sound)
  if (withSound.length) {
    out.push({
      path: `sound/${mod}_super_events.asset`,
      text: file(
        withSound.flatMap((s) => [
          block('sound', [str('name', soundName(s)), str('file', `${s.id}.wav`), kv('volume', 1)]),
          block('soundeffect', [
            str('name', soundName(s)),
            block('sounds', [str('sound', soundName(s))]),
            kv('volume', 1)
          ])
        ])
      )
    })
    for (const s of withSound)
      out.push({
        path: superSoundPath(s),
        data: new Uint8Array(Buffer.from(s.sound!.base64, 'base64'))
      })
  }
  // Localización
  const loc: Record<string, LocText> = {}
  for (const s of list) {
    loc[`${s.id}_title`] = s.title
    loc[`${s.id}_quote`] = s.author ? `${s.quote}\\n- ${s.author}` : s.quote
    loc[`${s.id}_button`] = s.button
  }
  out.push(...localisationFiles(p, 'super_events', loc))
  return out
}

registerSectionGenerator({
  id: 'super-eventos',
  generate: (p) => (p.superEvents?.length ? superEventFiles(p) : [])
})

export interface SuperIssue {
  severity: 'error' | 'aviso'
  message: string
  uid: string
}

/** `scripts`: todos los textos de bloques del proyecto (para ver a qué súper evento apuntan) */
export function validateSuperEvents(p: Project, scripts: string[] = []): SuperIssue[] {
  const out: SuperIssue[] = []
  const seen = new Set<string>()
  const mod = superPrefix(p)
  for (const s of p.superEvents ?? []) {
    const at = (severity: SuperIssue['severity'], m: string): number =>
      out.push({ severity, message: `Súper evento ${s.id}: ${m}`, uid: s.uid })
    if (!/^[a-z0-9_]+$/.test(s.id) || !s.id.startsWith(`${mod}_`))
      at('error', `el id debe ser minúsculas, números y _ y empezar con ${mod}_.`)
    if (seen.has(s.id)) at('error', 'id repetido.')
    seen.add(s.id)
    if (!s.title.trim()) at('error', 'falta el título.')
    if (!s.image) at('error', 'falta la imagen.')
    else if (
      s.image.kind === 'asset' &&
      !p.icons.some((a) => a.id === (s.image as { assetId: string }).assetId)
    )
      at('error', 'la imagen de la biblioteca ya no existe.')
    if (s.audience === 'list' && !s.countries.length) at('error', 'la lista de países está vacía.')
    if (s.sound) {
      if (!isPcmWav(s.sound.base64))
        at('aviso', 'el sonido no es un WAV PCM: el juego solo acepta .wav sin comprimir.')
      at(
        'aviso',
        'la sintaxis del efecto de sonido está sin verificar en el juego (comprueba effects_documentation).'
      )
    }
  }
  const ids = new Set((p.superEvents ?? []).map((s) => s.id))
  for (const code of scripts)
    for (const m of code.matchAll(new RegExp(`\\b(${mod}_[a-z0-9_]+?)_show\\s*=\\s*yes`, 'g')))
      if (!ids.has(m[1]))
        out.push({
          severity: 'error',
          message: `Un bloque muestra el súper evento ${m[1]}, que no existe.`,
          uid: ''
        })
  return out
}
