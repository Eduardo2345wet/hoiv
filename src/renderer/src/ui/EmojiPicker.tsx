// Selector de emoji con categorías, buscador en español, colores y vista previa en vivo
import { useMemo, useState } from 'react'
import type { EmojiRecipe, IconColor, IconTarget } from '../types'
import { EMOJI_CATEGORIES, searchEmojis } from '../icons/emojiData'
import { ICON_COLORS, ICON_SIZES } from '../icons/sizes'
import { canDrawEmoji, renderEmojiToPng } from '../icons/canvasRender'
import Modal from './Modal'

interface Props {
  target: IconTarget
  initial: EmojiRecipe
  onAccept: (recipe: EmojiRecipe, png: string) => void
  onClose: () => void
}

export default function EmojiPicker({ target, initial, onAccept, onClose }: Props): JSX.Element {
  const [recipe, setRecipe] = useState<EmojiRecipe>(initial)
  const [query, setQuery] = useState('')
  const png = useMemo(() => renderEmojiToPng(recipe, target), [recipe, target])
  const { w, h } = ICON_SIZES[target]

  // Solo los emojis que el sistema puede dibujar (sin cuadros vacíos)
  const results = query ? searchEmojis(query).filter((e) => canDrawEmoji(e.emoji)) : null

  const cell = (emoji: string): JSX.Element => (
    <button
      key={emoji}
      onClick={() => setRecipe({ ...recipe, emoji })}
      className={`rounded p-1 text-2xl hover:bg-hoi-card ${
        recipe.emoji === emoji ? 'bg-hoi-accent/30 ring-1 ring-hoi-accent' : ''
      }`}
    >
      {emoji}
    </button>
  )

  return (
    <Modal
      title={`Ícono con emoji (${target === 'focus' ? 'foco' : 'espíritu nacional'})`}
      width={720}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" onClick={() => onAccept(recipe, png)}>
            Usar este ícono
          </button>
        </>
      }
    >
      <div className="flex gap-4">
        <div className="min-w-0 flex-1">
          <input
            className="input mb-3"
            placeholder='Buscar: "fábrica", "barco", "dinero"…'
            value={query}
            autoFocus
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="max-h-[50vh] overflow-y-auto pr-1">
            {results ? (
              <div className="grid grid-cols-8 gap-1">
                {results.length ? (
                  results.map((e) => cell(e.emoji))
                ) : (
                  <p className="col-span-8 text-sm text-hoi-muted">Sin resultados</p>
                )}
              </div>
            ) : (
              EMOJI_CATEGORIES.map((c) => {
                const items = c.items.filter((e) => canDrawEmoji(e.emoji))
                if (!items.length) return null
                return (
                  <div key={c.name} className="mb-2">
                    <div className="mb-1 text-xs text-hoi-muted">{c.name}</div>
                    <div className="grid grid-cols-8 gap-1">{items.map((e) => cell(e.emoji))}</div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        <div className="w-52 shrink-0">
          <div className="label">Color de fondo</div>
          <div className="mb-4 grid grid-cols-3 gap-1">
            {(Object.keys(ICON_COLORS) as IconColor[]).map((k) => (
              <button
                key={k}
                onClick={() => setRecipe({ ...recipe, color: k })}
                className={`rounded px-1 py-1 text-[11px] ${recipe.color === k ? 'ring-2 ring-hoi-accent' : ''}`}
                style={{ background: ICON_COLORS[k].fill, color: '#fff' }}
              >
                {ICON_COLORS[k].label}
              </button>
            ))}
          </div>
          <div className="label">
            Vista previa ({w}×{h} y 2×)
          </div>
          <div className="flex items-end gap-3 rounded bg-[#101013] p-3">
            <img src={png} width={w} height={h} alt="" />
            <img
              src={png}
              width={w * 2}
              height={h * 2}
              alt=""
              style={{ imageRendering: 'pixelated', maxWidth: 110 }}
            />
          </div>
          <p className="mt-2 text-[11px] text-hoi-muted">
            El mod lleva la imagen ya dibujada: en el juego no hacen falta emojis.
          </p>
        </div>
      </div>
    </Modal>
  )
}
