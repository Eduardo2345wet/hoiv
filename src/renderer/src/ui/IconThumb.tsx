// Miniatura real del ícono de un foco o espíritu
import type { IconRef, Project } from '../types'
import { ImageIcon } from 'lucide-react'

interface Props {
  icon: IconRef | null
  project: Project
  /** alto en píxeles (el ancho se ajusta) */
  height: number
}

export default function IconThumb({ icon, project, height }: Props): JSX.Element {
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
  if (icon?.kind === 'game')
    return (
      // Ícono del juego: no incluimos arte de Paradox, se muestra una miniatura genérica
      <div
        title={icon.gfx}
        className="flex items-center justify-center rounded bg-[#3a3a44] ring-1 ring-hoi-border"
        style={{ height, width: height * 1.1 }}
      >
        <ImageIcon size={Math.max(12, height * 0.45)} className="text-hoi-muted" />
      </div>
    )
  return (
    <div
      className="flex items-center justify-center rounded border border-dashed border-red-500 text-red-400"
      style={{ height, width: height }}
    >
      ?
    </div>
  )
}
