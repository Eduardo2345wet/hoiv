// Archivos de los países del mod.
// - País NUEVO: country_tags, common/countries, historia, OOB, 15 banderas TGA,
//   líderes (DDS + .gfx + characters) y localización.
// - País EXISTENTE: solo lo que el usuario cambió (ver Parte 4).
import { IDEOLOGIES, type Country, type Project } from '../types'
import type { GameCatalog } from '../catalog/catalog'
import { safeFolderName } from '../../../shared/names'
import { characterId, namesFor, rulingLeader } from '../countries/countryOps'
import { BASIC_DIVISION_TEMPLATE, BASIC_TECHNOLOGIES, LEADER_EXPIRE } from '../countries/gameData'
import { PORTRAIT_SIZE } from '../countries/placeholders'
import {
  renderFlagPlaceholder,
  renderPlainFlag,
  renderPortraitPlaceholder
} from '../icons/renderer'
import { locText } from '../generator/focusTree'
import { patchHistory } from '../countries/history'
import { writeDDS, writeTGA } from './images'
import type { ModFile } from './exportMod'

export interface RGBAImage {
  width: number
  height: number
  rgba: Uint8Array | Uint8ClampedArray
}
/** Lee un PNG y lo devuelve a w×h (en la app con canvas; en las pruebas, uno falso) */
export type ImageReader = (png: string, w: number, h: number) => Promise<RGBAImage>

/** "Nueva Granada" → "Nueva Granada" solo ASCII (sin tildes ni símbolos, conserva espacios) */
export function asciiName(text: string): string {
  return (
    text
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^A-Za-z0-9 _-]+/g, '')
      .replace(/\s+/g, ' ')
      .trim() || 'Pais'
  )
}

/** Nombre de archivo de common/countries: espacios → _ */
export const countryFileName = (c: Country): string =>
  `${asciiName(c.names.name).replace(/ /g, '_')}.txt`
/** Nombre de archivo de historia: "TAG - Nombre.txt" (como el juego) */
export const historyFileName = (c: Country): string => `${c.tag} - ${asciiName(c.names.name)}.txt`
export { characterId }

/** Tamaños de bandera: [carpeta, ancho, alto] */
export const FLAG_FOLDERS: [string, number, number][] = [
  ['gfx/flags', 82, 52],
  ['gfx/flags/medium', 41, 26],
  ['gfx/flags/small', 10, 7]
]

// ======================= Textos =======================

/** Bloques set_politics / set_popularities / recruit_character de la historia */
export function politicsBlock(c: Country): string {
  const pol = c.politics
  const lines: string[] = []
  // recruit_character va ANTES de set_politics (nunca como última línea del archivo)
  const ruler = rulingLeader(c)
  const ordered = ruler ? [ruler, ...c.leaders.filter((l) => l !== ruler)] : c.leaders
  for (const l of ordered) lines.push(`recruit_character = ${characterId(c, l.id)}`)
  lines.push(
    'set_politics = {',
    `\truling_party = ${pol.ruling}`,
    `\tlast_election = "${pol.lastElection}"`,
    `\telection_frequency = ${pol.electionFrequency}`,
    `\telections_allowed = ${pol.electionsAllowed ? 'yes' : 'no'}`,
    '}',
    'set_popularities = {',
    ...IDEOLOGIES.map((i) => `\t${i} = ${pol.popularities[i]}`),
    '}'
  )
  return lines.join('\n') + '\n'
}

export function historyText(c: Country): string {
  return (
    [
      `capital = ${c.capital ?? 1}`,
      `oob = "${c.tag}_1936"`,
      'set_research_slots = 3',
      'set_technology = {',
      ...BASIC_TECHNOLOGIES.map((t) => `\t${t} = 1`),
      '}',
      politicsBlock(c).trimEnd()
    ].join('\n') + '\n'
  )
}

export function charactersText(c: Country): string {
  const blocks = c.leaders.map((l) => {
    const id = characterId(c, l.id)
    return [
      `\t${id} = {`,
      `\t\tname = ${id}`,
      '\t\tportraits = {',
      '\t\t\tcivilian = {',
      `\t\t\t\tlarge = GFX_${id}`,
      '\t\t\t}',
      '\t\t}',
      '\t\tcountry_leader = {',
      `\t\t\tideology = ${l.subideology}`,
      '\t\t\ttraits = { }',
      `\t\t\texpire = "${LEADER_EXPIRE}"`,
      '\t\t}',
      '\t}'
    ].join('\n')
  })
  return `characters = {\n${blocks.join('\n')}\n}\n`
}

/** Claves de nombre: TAG, TAG_DEF, TAG_ADJ y las de cada ideología */
function nameLoc(c: Country): string[] {
  const lines = [
    ` ${c.tag}:0 "${locText(c.names.name)}"`,
    ` ${c.tag}_DEF:0 "${locText(c.names.def || c.names.name)}"`,
    ` ${c.tag}_ADJ:0 "${locText(c.names.adj)}"`
  ]
  for (const i of IDEOLOGIES) {
    const n = namesFor(c, i)
    lines.push(
      ` ${c.tag}_${i}:0 "${locText(n.name)}"`,
      ` ${c.tag}_${i}_DEF:0 "${locText(n.def)}"`,
      ` ${c.tag}_${i}_ADJ:0 "${locText(n.adj)}"`
    )
  }
  return lines
}

function partyLoc(c: Country): string[] {
  return IDEOLOGIES.flatMap((i) => [
    ` ${c.tag}_${i}_party:0 "${locText(c.politics.parties[i].short)}"`,
    ` ${c.tag}_${i}_party_long:0 "${locText(c.politics.parties[i].long)}"`
  ])
}

const leaderLoc = (c: Country): string[] =>
  c.leaders.map((l) => ` ${characterId(c, l.id)}:0 "${locText(l.name)}"`)

/** Archivos de texto de todos los países (sin imágenes) */
export function countryTextFiles(project: Project, game: GameCatalog | null = null): ModFile[] {
  void game
  const mod = safeFolderName(project.modName)
  const files: ModFile[] = []
  const tagLines: string[] = []
  const loc: string[] = []
  const replaceLoc: string[] = []
  const leaderSprites: string[] = []

  for (const c of project.countries) {
    // País del juego ligero (solo tag + referencia): no exporta nada
    if (c.light) continue
    if (c.mode === 'nuevo') {
      tagLines.push(`${c.tag} = "countries/${countryFileName(c)}"`)
      files.push({
        path: `common/countries/${countryFileName(c)}`,
        text:
          [
            `graphical_culture = ${c.graphicalCulture}`,
            `graphical_culture_2d = ${c.graphicalCulture2d}`,
            `color = rgb { ${c.color.join(' ')} }`
          ].join('\n') + '\n'
      })
      files.push({ path: `history/countries/${historyFileName(c)}`, text: historyText(c) })
      files.push({ path: `history/units/${c.tag}_1936.txt`, text: BASIC_DIVISION_TEMPLATE })
      loc.push(...nameLoc(c), ...partyLoc(c))
    } else {
      files.push(...existingCountryTextFiles(c))
      if (c.existing.renameInGame) replaceLoc.push(...nameLoc(c))
    }

    // Líderes: archivo propio para AÑADIR personajes sin borrar los del juego
    if (c.leaders.length) {
      files.push({
        path: `common/characters/${mod}_${c.tag}_characters.txt`,
        text: charactersText(c)
      })
      loc.push(...leaderLoc(c))
      for (const l of c.leaders)
        leaderSprites.push(
          `\tspriteType = {\n\t\tname = "GFX_${characterId(c, l.id)}"\n\t\ttexturefile = "gfx/leaders/${c.tag}/${l.id}.dds"\n\t}`
        )
    }
  }

  // Un solo archivo de tags para todo el mod (NUNCA 00_countries.txt)
  if (tagLines.length)
    files.push({ path: `common/country_tags/01_${mod}_tags.txt`, text: tagLines.join('\n') + '\n' })
  if (leaderSprites.length)
    files.push({
      path: `interface/${mod}_leaders.gfx`,
      text: `spriteTypes = {\n${leaderSprites.join('\n')}\n}\n`
    })
  if (loc.length)
    files.push({
      path: `localisation/english/${mod}_countries_l_english.yml`,
      text: `l_english:\n${loc.join('\n')}\n`,
      bom: true
    })
  // por verificar: la carpeta localisation/english/replace/ sustituye claves del juego
  if (replaceLoc.length)
    files.push({
      path: `localisation/english/replace/${mod}_countries_l_english.yml`,
      text: `l_english:\n${replaceLoc.join('\n')}\n`,
      bom: true
    })
  return files
}

/**
 * País existente: nunca country_tags ni common/countries. La historia solo se puede
 * sobrescribir con el nombre EXACTO del archivo del juego, así que se exporta únicamente
 * si se leyó de la carpeta del juego y el usuario cambió capital, política o líderes.
 */
export function existingCountryTextFiles(c: Country): ModFile[] {
  const e = c.existing
  if (!e.historyEdited || !e.historyText || !e.historyFile) return []
  return [{ path: `history/countries/${e.historyFile}`, text: patchHistory(e.historyText, c) }]
}

// ======================= Imágenes =======================

/** Banderas a exportar de un país: [nombre sin extensión, PNG] */
export function flagVariants(c: Country): [string, string][] {
  if (c.light) return []
  // País técnico: bandera gris lisa generada
  const main = c.technical
    ? renderPlainFlag(c.color)
    : (c.flags.main ?? renderFlagPlaceholder(c.tag, c.color))
  const all: [string, string][] = [
    [c.tag, main],
    ...IDEOLOGIES.map((i): [string, string] => [`${c.tag}_${i}`, c.flags.byIdeology[i] ?? main])
  ]
  if (c.mode === 'nuevo') return all
  // País del JUEGO: SOLO las variantes que el usuario personalizó, con los mismos nombres que el
  // juego (así sustituyen a las originales). Las que no tocó no se exportan.
  const out: [string, string][] = []
  if (c.flags.main) out.push([c.tag, c.flags.main])
  for (const i of IDEOLOGIES)
    if (c.flags.byIdeology[i]) out.push([`${c.tag}_${i}`, c.flags.byIdeology[i]!])
  return out
}

/**
 * Auto-revisión: cada bandera que se va a exportar debe tener sus 3 tamaños
 * (gfx/flags, medium/ y small/). Devuelve los archivos que faltarían.
 */
export function missingFlagSizes(
  project: Project,
  paths: string[] = countryImagePaths(project)
): string[] {
  const have = new Set(paths)
  const missing: string[] = []
  for (const c of project.countries)
    for (const [name] of flagVariants(c))
      for (const [folder] of FLAG_FOLDERS) {
        const p = `${folder}/${name}.tga`
        if (!have.has(p)) missing.push(p)
      }
  return missing
}

/** 15 banderas TGA por país (5 × 3 tamaños) + retratos DDS de los líderes */
export async function countryImageFiles(project: Project, read: ImageReader): Promise<ModFile[]> {
  const files: ModFile[] = []
  for (const c of project.countries) {
    if (c.light) continue
    for (const [folder, w, h] of FLAG_FOLDERS)
      for (const [name, png] of flagVariants(c)) {
        const img = await read(png, w, h)
        files.push({
          path: `${folder}/${name}.tga`,
          data: writeTGA(img.width, img.height, img.rgba)
        })
      }
    for (const l of c.leaders) {
      const img = await read(
        l.portrait ?? renderPortraitPlaceholder(l.name),
        PORTRAIT_SIZE.w,
        PORTRAIT_SIZE.h
      )
      files.push({
        path: `gfx/leaders/${c.tag}/${l.id}.dds`,
        data: writeDDS(img.width, img.height, img.rgba)
      })
    }
  }
  return files
}

/** Rutas de las imágenes de los países (sin generarlas) */
export function countryImagePaths(project: Project): string[] {
  const out: string[] = []
  for (const c of project.countries) {
    if (c.light) continue
    for (const [folder] of FLAG_FOLDERS)
      for (const [name] of flagVariants(c)) out.push(`${folder}/${name}.tga`)
    for (const l of c.leaders) out.push(`gfx/leaders/${c.tag}/${l.id}.dds`)
  }
  return out
}
