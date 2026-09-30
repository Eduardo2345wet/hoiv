// Plan de exportación de íconos: qué .dds se escriben, el archivo .gfx
// y qué nombre de sprite usa cada foco/espíritu.
import type { Project } from '../types'
import { asciiSlug, safeFolderName } from '../../../shared/names'

export interface IconExportPlan {
  /** Archivos .dds a escribir: ruta dentro del mod + id del ícono de la biblioteca */
  dds: { path: string; assetId: string }[]
  /** Contenido de interface/<mod>_icons.gfx (vacío si no hay íconos propios) */
  gfx: string
  gfxPath: string
  /** uid del foco → valor de icon = ... */
  focusIcon: Map<string, string>
  /** uid del espíritu → valor de picture = ... */
  ideaPicture: Map<string, string>
  /** Sprites (para detectar duplicados) */
  sprites: { name: string; owner: string }[]
}

export function planIconExport(project: Project): IconExportPlan {
  const mod = safeFolderName(project.modName)
  const assets = new Map(project.icons.map((a) => [a.id, a]))
  const ddsByKey = new Map<string, string>() // folder|assetId → ruta
  const usedFiles = new Set<string>()
  const dds: IconExportPlan['dds'] = []
  const sprites: IconExportPlan['sprites'] = []
  const focusIcon = new Map<string, string>()
  const ideaPicture = new Map<string, string>()

  const ddsFor = (folder: 'goals' | 'ideas', assetId: string): string => {
    const key = `${folder}|${assetId}`
    if (ddsByKey.has(key)) return ddsByKey.get(key)!
    const a = assets.get(assetId)!
    const base = `${mod}_${asciiSlug(a.name) || 'icono'}`
    let file = `gfx/interface/${folder}/${base}.dds`
    let n = 2
    while (usedFiles.has(file)) file = `gfx/interface/${folder}/${base}_${n++}.dds`
    usedFiles.add(file)
    ddsByKey.set(key, file)
    dds.push({ path: file, assetId })
    return file
  }

  const lines: string[] = []
  const sprite = (name: string, file: string, owner: string): void => {
    sprites.push({ name, owner })
    lines.push(`\tspriteType = {\n\t\tname = "${name}"\n\t\ttexturefile = "${file}"\n\t}`)
  }

  for (const f of project.focuses) {
    if (f.icon.kind === 'game') focusIcon.set(f.uid, f.icon.gfx)
    else if (assets.has(f.icon.assetId)) {
      const name = `GFX_${mod}_${asciiSlug(f.id)}`
      sprite(name, ddsFor('goals', f.icon.assetId), `foco "${f.name || f.id}"`)
      focusIcon.set(f.uid, name)
    } else focusIcon.set(f.uid, 'GFX_goal_unknown')
  }
  for (const i of project.ideas) {
    if (i.icon?.kind === 'asset' && assets.has(i.icon.assetId)) {
      // El juego antepone GFX_idea_ al valor de picture
      const picture = asciiSlug(i.id)
      sprite(`GFX_idea_${picture}`, ddsFor('ideas', i.icon.assetId), `espíritu "${i.name || i.id}"`)
      ideaPicture.set(i.uid, picture)
    }
  }

  const gfx = lines.length ? `spriteTypes = {\n${lines.join('\n\n')}\n}\n` : ''
  return {
    dds,
    gfx,
    gfxPath: `interface/${mod}_icons.gfx`,
    focusIcon,
    ideaPicture,
    sprites
  }
}
