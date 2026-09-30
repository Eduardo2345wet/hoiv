// Campo "Ícono" para focos y espíritus: miniatura grande + 4 botones + restablecer
import { useState } from 'react'
import type { EmojiRecipe, IconAsset, IconRef, IconTarget, Project } from '../types'
import { newUid } from '../types'
import { store } from '../store/appStore'
import {
  addAsset,
  resetFocusIcon,
  resetIdeaIcon,
  setFocusIcon,
  setIdeaIcon,
  updateAsset
} from './projectOps'
import { DEFAULT_COLOR, ICON_SIZES } from '../icons/sizes'
import { pickAutoEmoji } from '../icons/emojiData'
import IconThumb from './IconThumb'
import EmojiPicker from './EmojiPicker'
import ImageUploader from './ImageUploader'
import Modal from './Modal'
import { FOCUS_ICONS } from './icons'

interface Props {
  project: Project
  target: IconTarget
  ownerUid: string
  ownerName: string
  icon: IconRef | null
  iconAuto: boolean
}

type Dialog = 'emoji' | 'upload' | 'library' | 'game' | null

export default function IconField({
  project,
  target,
  ownerUid,
  ownerName,
  icon,
  iconAuto
}: Props): JSX.Element {
  const [dialog, setDialog] = useState<Dialog>(null)
  const current =
    icon?.kind === 'asset' ? project.icons.find((a) => a.id === icon.assetId) : undefined

  const choose = (ref: IconRef, asset?: IconAsset): void => {
    store.updateProject((p) => {
      const withAsset = asset ? addAsset(p, asset) : p
      return target === 'focus'
        ? setFocusIcon(withAsset, ownerUid, ref)
        : setIdeaIcon(withAsset, ownerUid, ref)
    })
    setDialog(null)
  }

  const acceptEmoji = (recipe: EmojiRecipe, png: string): void => {
    // Si ya es un emoji puesto a mano, se edita el mismo ícono (se conserva la receta)
    if (current?.recipe && !iconAuto) {
      store.updateProject((p) => updateAsset(p, current.id, { recipe, png }))
      setDialog(null)
      return
    }
    const { w, h } = ICON_SIZES[target]
    const asset: IconAsset = {
      id: newUid(),
      name: `${ownerName} ${recipe.emoji}`.trim(),
      target,
      png,
      width: w,
      height: h,
      recipe
    }
    choose({ kind: 'asset', assetId: asset.id }, asset)
  }

  const initialRecipe: EmojiRecipe = current?.recipe ?? {
    emoji: pickAutoEmoji(ownerName),
    color: DEFAULT_COLOR[target]
  }

  return (
    <div>
      <label className="label">
        Ícono {iconAuto && <span className="text-hoi-accent">(automático)</span>}
      </label>
      <div className="mb-2 flex h-24 items-center justify-center rounded bg-[#101013]">
        <IconThumb icon={icon} project={project} height={target === 'focus' ? 80 : 68} />
      </div>
      <div className="grid grid-cols-2 gap-1">
        <button className="btn justify-center text-xs" onClick={() => setDialog('emoji')}>
          😀 Usar emoji
        </button>
        <button className="btn justify-center text-xs" onClick={() => setDialog('upload')}>
          ⬆ Subir imagen
        </button>
        <button className="btn justify-center text-xs" onClick={() => setDialog('library')}>
          🖼 De mi biblioteca
        </button>
        <button
          className="btn justify-center text-xs disabled:opacity-40"
          disabled={target !== 'focus'}
          title={target !== 'focus' ? 'Solo para focos' : ''}
          onClick={() => setDialog('game')}
        >
          🎮 Del juego
        </button>
      </div>
      {!iconAuto && (
        <button
          className="mt-1 text-xs text-hoi-muted underline hover:text-hoi-accent"
          onClick={() =>
            store.updateProject((p) =>
              target === 'focus' ? resetFocusIcon(p, ownerUid) : resetIdeaIcon(p, ownerUid)
            )
          }
        >
          Restablecer al automático
        </button>
      )}
      {icon?.kind === 'game' && (
        <p className="mt-1 break-all font-mono text-[10px] text-hoi-muted">{icon.gfx}</p>
      )}

      {dialog === 'emoji' && (
        <EmojiPicker
          target={target}
          initial={initialRecipe}
          onAccept={acceptEmoji}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'upload' && (
        <ImageUploader
          target={target}
          onAccept={(a) => choose({ kind: 'asset', assetId: a.id }, a)}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'library' && (
        <Modal title="Elegir de mi biblioteca" width={600} onClose={() => setDialog(null)}>
          <div className="grid grid-cols-4 gap-2">
            {project.icons
              .filter((a) => a.target === target)
              .map((a) => (
                <button
                  key={a.id}
                  onClick={() => choose({ kind: 'asset', assetId: a.id })}
                  className="flex flex-col items-center gap-1 rounded border border-hoi-border p-2 hover:border-hoi-accent"
                >
                  <img src={a.png} alt="" style={{ height: 56 }} />
                  <span className="w-full truncate text-[11px]">{a.name}</span>
                </button>
              ))}
          </div>
          {!project.icons.some((a) => a.target === target) && (
            <p className="text-sm text-hoi-muted">
              Todavía no hay íconos de este tipo en la biblioteca.
            </p>
          )}
        </Modal>
      )}
      {dialog === 'game' && (
        <Modal
          title="Ícono del juego (no agrega archivos al mod)"
          width={600}
          onClose={() => setDialog(null)}
        >
          <div className="grid grid-cols-3 gap-1">
            {FOCUS_ICONS.map(([gfx, label, emoji]) => (
              <button
                key={gfx}
                title={gfx}
                onClick={() => choose({ kind: 'game', gfx })}
                className="flex items-center gap-2 rounded border border-hoi-border p-1 text-left text-xs hover:border-hoi-accent"
              >
                <span className="text-xl">{emoji}</span>
                {label}
              </button>
            ))}
          </div>
        </Modal>
      )}
    </div>
  )
}
