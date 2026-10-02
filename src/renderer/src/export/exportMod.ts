// Prepara todos los archivos del mod y pide al proceso principal (Node) que
// los escriba. La interfaz nunca toca el disco directamente.
import type { Project } from '../types'
import type { ExportModPayload } from '../../../preload/index.d'
import { generateAllFocusTrees, generateLocalisation } from '../generator/focusTree'
import { generateIdeas } from '../generator/ideas'
import { safeFolderName } from '../../../shared/names'
import { planIconExport } from './gfx'
import { writeDDS } from './images'
import { pngToRGBA, pngToRGBAResized } from './imageCanvas'
import {
  countryImageFiles,
  countryImagePaths,
  missingFlagSizes,
  countryTextFiles,
  type ImageReader
} from './countryExport'
import type { GameCatalog } from '../catalog/catalog'
import { store } from '../store/appStore'
import { sectionFiles } from '../sections/generators'
import { SUPER_IMAGE_SIZE, superImagePath, superImagePaths } from '../sections/superEvents'
import { EVENT_PICTURE_SIZE, eventImagePath, eventImagePaths, eventPng } from '../sections/events'
import { decisionImagePaths, decisionImages } from '../sections/decisions'
import { characterImagePaths, characterImages } from '../sections/characters'
import { bookmarkImages } from '../sections/start'
import { baseMod } from './statesExport'
import { withTechnicalCapital } from '../map/noNation'
import { withMovedCapitals } from '../map/capitals'

export interface ModFile {
  /** Ruta dentro de la carpeta del mod, con "/" */
  path: string
  text?: string
  /** Escribir con BOM UTF-8 (solo localización) */
  bom?: boolean
  data?: Uint8Array
}

/** Archivos extra (ideas, íconos .dds y .gfx). Recibe el decodificador para poder probarlo. */
export async function buildExtraFiles(
  project: Project,
  decode: (png: string) => Promise<{
    width: number
    height: number
    rgba: Uint8Array | Uint8ClampedArray
  }>,
  /** Lector de imágenes a un tamaño dado (banderas y retratos de los países) */
  read?: ImageReader,
  game: GameCatalog | null = null
): Promise<ModFile[]> {
  const mod = safeFolderName(project.modName)
  const files: ModFile[] = []
  // Un archivo por árbol de focos, con el tag de su país
  for (const t of generateAllFocusTrees(project))
    if (project.focuses.some((f) => f.treeId === t.treeId))
      files.push({ path: `common/national_focus/${t.tag}_focus.txt`, text: t.text })
  if (project.ideas.length)
    files.push({
      path: `common/ideas/${mod}_ideas.txt`,
      text: generateIdeas(project)
    })
  const plan = planIconExport(project)
  for (const d of plan.dds) {
    const asset = project.icons.find((a) => a.id === d.assetId)!
    const img = await decode(asset.png)
    files.push({
      path: d.path,
      data: writeDDS(img.width, img.height, img.rgba)
    })
  }
  if (plan.gfx) files.push({ path: plan.gfxPath, text: plan.gfx })
  if (plan.shineGfx) files.push({ path: plan.shinePath, text: plan.shineGfx })
  // Países: textos (tags, countries, historia, OOB, personajes, localización) e imágenes
  files.push(...countryTextFiles(project, game))
  // Secciones nuevas (eventos, decisiones…): cada generador aporta sus archivos
  files.push(...sectionFiles(project).files)
  if (read) {
    files.push(...(await countryImageFiles(project, read)))
    // Imágenes de eventos (subidas o de la biblioteca): DDS al tamaño de las del juego
    for (const e of project.events ?? []) {
      const png = eventPng(project, e.picture)
      if (!png) continue
      const img = await read(png, EVENT_PICTURE_SIZE.w, EVENT_PICTURE_SIZE.h)
      files.push({
        path: eventImagePath(project, e),
        data: writeDDS(img.width, img.height, img.rgba)
      })
    }
    for (const i of characterImages(project)) {
      const img = await read(i.png, i.w, i.h)
      files.push({ path: i.path, data: writeDDS(img.width, img.height, img.rgba) })
    }
    for (const i of bookmarkImages(project)) {
      const img = await read(i.png, i.w, i.h)
      files.push({ path: i.path, data: writeDDS(img.width, img.height, img.rgba) })
    }
    // Íconos propios de decisiones y categorías
    for (const i of decisionImages(project)) {
      const img = await read(i.png, i.w, i.h)
      files.push({ path: i.path, data: writeDDS(img.width, img.height, img.rgba) })
    }
    // Imágenes de los súper eventos
    for (const s of project.superEvents ?? []) {
      const png = eventPng(project, s.image)
      if (!png) continue
      const img = await read(png, SUPER_IMAGE_SIZE.w, SUPER_IMAGE_SIZE.h)
      files.push({ path: superImagePath(s), data: writeDDS(img.width, img.height, img.rgba) })
    }
  }
  return files
}

/**
 * Rutas de TODOS los archivos que va a escribir el mod (sin leer imágenes),
 * para detectar dos archivos con el mismo nombre antes de exportar.
 */
export function plannedPaths(project: Project, game: GameCatalog | null = null): string[] {
  const mod = safeFolderName(project.modName)
  const paths = ['descriptor.mod']
  if (/^\s*[A-Za-z0-9_.-]+:\d*\s*"/m.test(generateLocalisation(project)))
    paths.push(`localisation/english/${mod}_l_english.yml`)
  for (const t of generateAllFocusTrees(project))
    if (project.focuses.some((f) => f.treeId === t.treeId))
      paths.push(`common/national_focus/${t.tag}_focus.txt`)
  if (project.ideas.length) paths.push(`common/ideas/${mod}_ideas.txt`)
  const plan = planIconExport(project)
  paths.push(...plan.dds.map((d) => d.path))
  if (plan.gfx) paths.push(plan.gfxPath)
  if (plan.shineGfx) paths.push(plan.shinePath)
  paths.push(...countryTextFiles(project, game).map((f) => f.path))
  paths.push(...sectionFiles(project).files.map((f) => f.path))
  paths.push(...countryImagePaths(project))
  paths.push(...eventImagePaths(project))
  paths.push(...superImagePaths(project))
  paths.push(...decisionImagePaths(project))
  paths.push(...characterImagePaths(project))
  paths.push(...bookmarkImages(project).map((i) => i.path))
  return paths
}

/**
 * Arma lo que se escribe en disco (con la auto-revisión de banderas) para "Exportar mod".
 */
export async function buildModPayload(
  project: Project,
  exportPath: string,
  extraFiles: ModFile[] = []
): Promise<{ ok: true; payload: ExportModPayload } | { ok: false; message: string }> {
  // País técnico "Sin nación": su capital es el primer estado pendiente
  project = withTechnicalCapital(project, store.get().map)
  // Capital perdida de un país del juego editado con el asistente: va en su mismo archivo
  project = withMovedCapitals(project, store.get().map, store.catalogGame())
  const extra = await buildExtraFiles(project, pngToRGBA, pngToRGBAResized, store.catalogGame())
  // Auto-revisión: cada bandera exportada trae sus 3 tamaños
  const generated = new Set([...extra, ...extraFiles].map((f) => f.path))
  const missing = missingFlagSizes(project, [...generated])
  if (missing.length)
    return { ok: false, message: `Faltan archivos de bandera (3 tamaños): ${missing.join(', ')}` }
  const mod = baseMod(project)
  return {
    ok: true,
    payload: {
      // Base de mapa de otro mod: el nuestro depende de él
      dependencies: mod ? [mod.name] : [],
      exportPath,
      modName: project.modName,
      tag: project.tag,
      // Los árboles van en `files` (uno por país)
      focusTreeScript: '',
      locYaml: generateLocalisation(project),
      files: [...extra, ...extraFiles]
    }
  }
}

/**
 * Exporta el mod a una carpeta que elige el usuario (por defecto en el Escritorio). Crea la
 * carpeta del mod y su .mod; el usuario los copia a mano a la carpeta de mods de HOI4.
 * `extraFiles` = archivos ya preparados (estados y capitales parchados del mapa).
 */
export async function exportMod(
  project: Project,
  extraFiles: ModFile[] = []
): Promise<{ ok: boolean; message: string; folder?: string }> {
  const api = window.electronAPI
  if (!api)
    return {
      ok: false,
      message: 'Esta función solo está disponible dentro de la app de escritorio.'
    }

  const info = await api.getExportInfo()
  const folder = await store.askExportFolder(info, project.modName)
  if (!folder) return { ok: false, message: 'Exportación cancelada.' }
  let replacePrevious = false
  if (await api.exportExists(folder, project.modName)) {
    const a = await store.askUser({
      title: '¿Reemplazar la exportación anterior?',
      message: `Ya hay una exportación de "${project.modName}" en ${folder}. Se borrará por completo su carpeta y su .mod (solo ahí) y se escribirán de nuevo.`,
      buttons: [
        { label: 'Reemplazar', value: 'ok', primary: true },
        { label: 'Cancelar', value: 'no' }
      ]
    })
    if (a !== 'ok') return { ok: false, message: 'Exportación cancelada.' }
    replacePrevious = true
  }
  const built = await buildModPayload(project, folder, extraFiles)
  if (!built.ok) return built
  const result = await api.exportMod({
    ...built.payload,
    gameModsDir: info.modsDir,
    // Versión del juego instalado; si no se puede leer, la constante editable de Ajustes
    supportedVersion: info.installedVersion ?? info.fallbackVersion,
    replacePrevious
  })
  if (!result.success) return { ok: false, message: result.error ?? 'Error desconocido' }
  void api.setSettings({ lastExportDir: folder })
  return { ok: true, message: `Mod exportado en:\n${result.modFolder}`, folder }
}
