// Plan de exportación de íconos: qué .dds se escriben, el archivo .gfx
// y qué nombre de sprite usa cada foco/espíritu.
import type { Project } from '../types'
import { asciiSlug, safeFolderName } from '../../../shared/names'
import { shineSprite } from '../../../shared/shine'

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
  /** interface/<mod>_goals_shine.gfx: un "_shine" por cada sprite propio de foco */
  shineGfx: string
  shinePath: string
  /** Sprites de foco propios y sus _shine (para el validador) */
  focusSprites: string[]
  shineSprites: { name: string; owner: string }[]
}

/** Antepone el mod al nombre salvo que ya empiece con él (los ids nuevos ya llevan el prefijo) */
const withMod = (mod: string, slug: string): string =>
  slug.startsWith(`${mod}_`) ? slug : `${mod}_${slug}`

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
    const base = withMod(mod, asciiSlug(a.name) || 'icono')
    let file = `gfx/interface/${folder}/${base}.dds`
    let n = 2
    while (usedFiles.has(file)) file = `gfx/interface/${folder}/${base}_${n++}.dds`
    usedFiles.add(file)
    ddsByKey.set(key, file)
    dds.push({ path: file, assetId })
    return file
  }

  const lines: string[] = []
  const shineLines: string[] = []
  const focusSprites: string[] = []
  const shineSprites: IconExportPlan['shineSprites'] = []
  const sprite = (name: string, file: string, owner: string): void => {
    sprites.push({ name, owner })
    lines.push(`\tspriteType = {\n\t\tname = "${name}"\n\t\ttexturefile = "${file}"\n\t}`)
  }

  for (const f of project.focuses) {
    if (f.icon.kind === 'game') focusIcon.set(f.uid, f.icon.gfx)
    else if (assets.has(f.icon.assetId)) {
      const name = `GFX_${withMod(mod, asciiSlug(f.id))}`
      const file = ddsFor('goals', f.icon.assetId)
      sprite(name, file, `foco "${f.name || f.id}"`)
      focusIcon.set(f.uid, name)
      // El árbol necesita también <nombre>_shine con el MISMO .dds (si no, muestra "?")
      focusSprites.push(name)
      shineSprites.push({ name: `${name}_shine`, owner: `foco "${f.name || f.id}"` })
      shineLines.push(shineSprite(name, file))
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
    sprites,
    // Los íconos del juego (GFX_goal_generic_*) ya tienen su _shine: no se genera nada
    shineGfx: shineLines.length ? `spriteTypes = {\n${shineLines.join('\n\n')}\n}\n` : '',
    shinePath: `interface/${mod}_goals_shine.gfx`,
    focusSprites,
    shineSprites
  }
}
