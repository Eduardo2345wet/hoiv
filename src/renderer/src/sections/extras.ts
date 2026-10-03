// Extras: idiomas (traducciones por clave), música propia, pantallas de carga y portada del mod.
import type { Project } from '../types'
import { newUid } from '../types'
import { safeFolderName } from '../../../shared/names'
import { block, file, kv, raw, str, type Node } from '../export/clausewitz'
import { LANGUAGES, locValue } from '../export/localisation'
import { generateLocalisation } from '../generator/focusTree'
import { countryTextFiles } from '../export/countryExport'
import type { ModFile } from '../export/exportMod'
import { registerSectionGenerator, sectionFiles } from './generators'
import type { LoadingScreen, MusicTrack } from './types'

const mod = (p: Project): string => safeFolderName(p.modName)

// por verificar con archivos del juego: tamaño de las pantallas de carga y de la portada
export const LOADING_SIZE = { w: 1920, h: 1080 }
export const COVER_SIZE = 512

// ---------------------------------------------------------------- idiomas

export interface LocEntry {
  key: string
  /** Texto en inglés (tal cual va en el .yml, ya escapado) */
  english: string
}

const LINE = /^\s*([A-Za-z0-9_.\-']+):\d*\s+"(.*)"\s*$/

/** Claves y textos en inglés de un .yml */
export function parseLoc(text: string): LocEntry[] {
  const out: LocEntry[] = []
  for (const l of text.split(/\r?\n/)) {
    const m = LINE.exec(l)
    if (m) out.push({ key: m[1], english: m[2] })
  }
  return out
}

/** .yml en inglés de los países (si un país está incompleto, simplemente no aporta textos) */
function countryLoc(p: Project): ModFile[] {
  try {
    return countryTextFiles(p, null).filter((f) =>
      /^localisation\/english\/[^/]+_countries_l_english\.yml$/.test(f.path)
    )
  } catch {
    return []
  }
}

/** Archivos .yml en inglés que NO son de una sección (focos/espíritus y países) */
function legacyEnglish(p: Project): { section: string; text: string }[] {
  const out = [{ section: 'focos', text: generateLocalisation(p) }]
  for (const f of countryLoc(p)) out.push({ section: 'paises', text: f.text ?? '' })
  return out
}

/** Todo lo traducible del mod: clave + inglés (sin repetir claves) */
export function translatableEntries(p: Project): LocEntry[] {
  const seen = new Set<string>()
  const out: LocEntry[] = []
  const add = (text: string): void => {
    for (const e of parseLoc(text))
      if (!seen.has(e.key)) {
        seen.add(e.key)
        out.push(e)
      }
  }
  for (const f of legacyEnglish(p)) add(f.text)
  for (const f of sectionFiles(p).files)
    if (/^localisation\/english\//.test(f.path) && f.text) add(f.text)
  return out
}

export const languageLabel = (code: string): string =>
  LANGUAGES.find((l) => l.code === code)?.label ?? code

/** Idiomas distintos del inglés */
export const extraLanguages = (p: Project): string[] =>
  (p.languages ?? []).map((l) => l.code).filter((c) => c !== 'english')

export function setLanguages(p: Project, codes: string[]): Project {
  const keep = new Map((p.languages ?? []).map((l) => [l.code, l]))
  const list = ['english', ...codes.filter((c) => c !== 'english')]
  return { ...p, languages: list.map((c) => keep.get(c) ?? { code: c }) }
}
export function setTranslation(p: Project, lang: string, key: string, text: string): Project {
  return {
    ...p,
    languages: p.languages.map((l) => {
      if (l.code !== lang) return l
      const strings = { ...(l.strings ?? {}) }
      if (text === '') delete strings[key]
      else strings[key] = text
      return { ...l, strings }
    })
  }
}
export const translationOf = (p: Project, lang: string, key: string): string | undefined =>
  p.languages.find((l) => l.code === lang)?.strings?.[key]

/** Faltantes de un idioma (sin traducir: usarán el inglés) */
export const missingKeys = (p: Project, lang: string): string[] =>
  translatableEntries(p)
    .filter((e) => translationOf(p, lang, e.key) === undefined)
    .map((e) => e.key)

/** .yml de los focos, espíritus y países en cada idioma extra (las secciones ya lo hacen solas) */
export function languageFiles(p: Project): ModFile[] {
  const out: ModFile[] = []
  const m = mod(p)
  const langs = extraLanguages(p)
  if (!langs.length) return out
  const sources: { name: string; text: string }[] = [
    { name: `${m}_l_`, text: generateLocalisation(p) },
    ...countryLoc(p).map((f) => ({ name: `${m}_countries_l_`, text: f.text ?? '' }))
  ]
  for (const lang of langs) {
    const strings = p.languages.find((l) => l.code === lang)?.strings ?? {}
    for (const s of sources) {
      const entries = parseLoc(s.text)
      if (!entries.length) continue
      const body = entries
        .map(
          (e) =>
            ` ${e.key}:0 "${strings[e.key] !== undefined ? locValue(strings[e.key]) : e.english}"`
        )
        .join('\n')
      out.push({
        path: `localisation/${lang}/${s.name}${lang}.yml`,
        text: `l_${lang}:\n${body}\n`,
        bom: true
      })
    }
  }
  return out
}

// ---------------------------------------------------------------- música

export const stationOf = (p: Project, t: MusicTrack): string =>
  t.station.trim() || `${mod(p)}_station`
export const songId = (p: Project, t: MusicTrack): string =>
  `${mod(p)}_${safeFolderName(t.name || 'cancion').replace(/^mi_mod$/, 'cancion')}`
export const songPath = (p: Project, t: MusicTrack): string => `music/${songId(p, t)}.ogg`

/** ¿Empieza con la firma de un contenedor Ogg? */
export function isOgg(base64: string): boolean {
  try {
    return Buffer.from(base64.slice(0, 16), 'base64').toString('latin1', 0, 4) === 'OggS'
  } catch {
    return false
  }
}

export function newTrack(over: Partial<MusicTrack> = {}): MusicTrack {
  return {
    uid: newUid(),
    name: '',
    station: '',
    ogg: null,
    weight: 1,
    condition: { blocks: null, code: '' },
    ...over
  }
}

export function musicFiles(p: Project): ModFile[] {
  const tracks = (p.music ?? []).filter((t) => t.ogg)
  if (!tracks.length) return []
  const out: ModFile[] = []
  // .asset propio (NUNCA music/music.asset del juego)
  out.push({
    path: `music/${mod(p)}_music.asset`,
    text: file(
      tracks.map((t) =>
        block('music', [
          str('name', songId(p, t)),
          str('file', `${songId(p, t)}.ogg`),
          kv('volume', 0.9)
        ])
      )
    )
  })
  // Una lista de canciones por estación. por verificar: forma de `chance` y de music_station
  const stations = [...new Set(tracks.map((t) => stationOf(p, t)))]
  for (const st of stations) {
    const nodes: Node[] = [str('music_station', st)]
    for (const t of tracks.filter((x) => stationOf(p, x) === st)) {
      const chance: Node[] = [kv('base', t.weight)]
      if (t.condition.code.trim())
        chance.push(block('modifier', [kv('factor', 0), block('NOT', [raw(t.condition.code)])]))
      nodes.push(block('music', [str('song', songId(p, t)), block('chance', chance)]))
    }
    out.push({ path: `music/${mod(p)}_${safeFolderName(st)}_songs.txt`, text: file(nodes) })
  }
  for (const t of tracks)
    out.push({ path: songPath(p, t), data: new Uint8Array(Buffer.from(t.ogg!.base64, 'base64')) })
  return out
}

// ---------------------------------------------------------------- pantallas de carga

export const loadingKey = (p: Project, i: number): string => `${mod(p)}_loading_${i + 1}`
export const loadingPath = (p: Project, i: number): string =>
  `gfx/loadingscreens/${loadingKey(p, i)}.dds`
export function loadingPng(p: Project, s: LoadingScreen): string | null {
  if (s.upload) return s.upload.png
  const img = s.image
  return img?.kind === 'asset' ? (p.icons.find((a) => a.id === img.assetId)?.png ?? null) : null
}
export const loadingImages = (p: Project): { path: string; png: string; w: number; h: number }[] =>
  (p.loadingScreens ?? []).flatMap((s, i) => {
    const png = loadingPng(p, s)
    return png ? [{ path: loadingPath(p, i), png, ...LOADING_SIZE }] : []
  })

export function loadingFiles(p: Project): ModFile[] {
  const imgs = loadingImages(p)
  if (!imgs.length) return []
  // por verificar con los archivos del juego: nombre del .gfx y de los sprites de pantallas de carga
  const sprites = (p.loadingScreens ?? []).flatMap((s, i) =>
    loadingPng(p, s)
      ? [
          block('SpriteType', [
            str('name', `GFX_${loadingKey(p, i)}`),
            str('texturefile', loadingPath(p, i))
          ])
        ]
      : []
  )
  return [
    { path: `interface/${mod(p)}_loadingscreens.gfx`, text: file([block('spriteTypes', sprites)]) }
  ]
}

// ---------------------------------------------------------------- portada

export function coverBytes(p: Project): Uint8Array | null {
  const m = /^data:image\/png;base64,(.+)$/.exec(p.cover ?? '')
  return m ? new Uint8Array(Buffer.from(m[1], 'base64')) : null
}

registerSectionGenerator({
  id: 'extras',
  generate: (p) => [...musicFiles(p), ...loadingFiles(p), ...languageFiles(p)]
})

// ---------------------------------------------------------------- validación

export interface ExtraIssue {
  severity: 'error' | 'aviso'
  message: string
}

export function validateExtras(p: Project): ExtraIssue[] {
  const out: ExtraIssue[] = []
  const names = new Set<string>()
  for (const t of p.music ?? []) {
    const at = (s: ExtraIssue['severity'], m: string): number =>
      out.push({ severity: s, message: `Canción "${t.name || '(sin nombre)'}": ${m}` })
    if (!t.name.trim()) at('error', 'falta el nombre.')
    if (!t.ogg) at('error', 'falta el archivo .ogg.')
    else if (!isOgg(t.ogg.base64))
      at('error', 'el archivo no es un .ogg válido (solo se acepta Ogg Vorbis).')
    const id = songId(p, t)
    if (names.has(id)) at('error', 'el nombre se repite.')
    names.add(id)
    if (!(t.weight > 0)) at('aviso', 'con peso 0 nunca suena.')
  }
  for (const [i, s] of (p.loadingScreens ?? []).entries())
    if (!loadingPng(p, s))
      out.push({ severity: 'error', message: `Pantalla de carga ${i + 1}: falta la imagen.` })
  for (const lang of extraLanguages(p)) {
    const n = missingKeys(p, lang).length
    if (n)
      out.push({
        severity: 'aviso',
        message: `Idioma ${languageLabel(lang)}: ${n} texto(s) sin traducir (se usará el inglés).`
      })
  }
  return out
}
