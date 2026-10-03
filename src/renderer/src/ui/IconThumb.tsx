// Miniatura real del ícono de un foco o espíritu
import type { IconRef, Project } from '../types'
import GameSprite from './GameSprite'

interface Props {
  icon: IconRef | null
  project: Project
  /** alto en píxeles (el ancho se ajusta) */
  height: number
  /** Espíritu del juego sin ícono propio: su picture (sin GFX_idea_) */
  picture?: string
}

export default function IconThumb({ icon, project, height, picture }: Props): JSX.Element {
  if (icon?.kind === 'asset') {
    const a = project.icons.find((x) => x.id === icon.assetId)
    if (a?.png)
      return (
        <img
          src={a.png}
          alt={a.name}
          style={{ height }}
          className="object-contain"
          draggable={false}
        />
      )
  }
  if (icon?.kind === 'game') return <GameSprite name={icon.gfx} height={height} />
  if (!icon && picture) return <GameSprite name={`GFX_idea_${picture}`} height={height} />
  return (
    <div
      className="flex items-center justify-center rounded border border-dashed border-red-500 text-red-400"
      style={{ height, width: height }}
    >
      ?
    </div>
  )
}
