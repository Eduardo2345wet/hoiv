// Miniatura de un sprite del juego (leída de la caché); genérica si no se pudo leer.
import { ImageIcon } from 'lucide-react'
import { useSpriteThumb } from '../catalog/gameSprites'

export default function GameSprite({
  name,
  height,
  title
}: {
  name: string | null
  height: number
  title?: string
}): JSX.Element {
  const src = useSpriteThumb(name)
  if (src)
    return (
      <img
        src={src}
        alt=""
        title={title ?? name ?? undefined}
        draggable={false}
        style={{ height, maxWidth: height * 2 }}
        className="object-contain"
      />
    )
  return (
    <div
      title={title ?? name ?? undefined}
      className="flex items-center justify-center rounded bg-hoi-card"
      style={{ height, width: height }}
    >
      <ImageIcon size={Math.max(12, height * 0.4)} className="text-hoi-muted" />
    </div>
  )
}
