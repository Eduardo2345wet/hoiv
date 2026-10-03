// Selector de íconos del juego: cuadrícula virtualizada de miniaturas reales con buscador.
import { useEffect, useMemo, useState } from 'react'
import { useApp } from '../store/appStore'
import { loadSprites } from '../catalog/gameSprites'
import { fold } from '../catalog/gameIdeas'
import { prefixOf } from '../../../shared/gfxSprites'
import GameSprite from './GameSprite'
import Modal from './Modal'
import { FOCUS_ICONS } from './icons'

const CELL_W = 100
const CELL_H = 92
const VIEW_H = 400
const GRID_W = 700

export default function GameIconPicker({
  kind,
  current,
  onPick,
  onClose
}: {
  kind: 'idea' | 'goal' | 'event'
  /** Sprite elegido ahora (con prefijo) */
  current: string | null
  onPick: (sprite: string) => void
  onClose: () => void
}): JSX.Element {
  const gamePath = useApp((s) => s.gamePath)
  const prefix = prefixOf(kind)
  const [names, setNames] = useState<string[] | null>(null)
  const [query, setQuery] = useState('')
  const [scroll, setScroll] = useState(0)
  const [sel, setSel] = useState<string | null>(current)
  useEffect(() => {
    void loadSprites(gamePath, kind).then(setNames)
  }, [gamePath, kind])
  const label = (n: string): string => n.slice(prefix.length).replace(/_/g, ' ')
  const list = useMemo(() => {
    const q = fold(query.trim())
    const all =
      names && names.length
        ? names
        : kind === 'goal'
          ? FOCUS_ICONS.map(([g]) => g) // lista de reserva sin carpeta del juego
          : []
    return q ? all.filter((n) => fold(label(n)).includes(q)) : all
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [names, query, kind])
  const cols = Math.max(1, Math.floor(GRID_W / CELL_W))
  const rows = Math.ceil(list.length / cols)
  const first = Math.max(0, Math.floor(scroll / CELL_H) - 1)
  const last = Math.min(rows, Math.ceil((scroll + VIEW_H) / CELL_H) + 1)
  const visible = list.slice(first * cols, last * cols)
  return (
    <Modal
      title={
        kind === 'idea'
          ? 'Íconos de espíritus del juego'
          : kind === 'goal'
            ? 'Íconos de focos del juego'
            : 'Imágenes de eventos del juego'
      }
      width={GRID_W + 40}
      onClose={onClose}
      footer={
        <>
          <span className="mr-auto text-xs text-hoi-muted">
            No se copia ningún archivo: el juego usa su propio sprite.
          </span>
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-primary disabled:opacity-40"
            disabled={!sel}
            onClick={() => sel && onPick(sel)}
          >
            Usar este ícono
          </button>
        </>
      }
    >
      <input
        autoFocus
        className="input mb-2"
        placeholder="Buscar por nombre…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {!gamePath && (
        <p className="mb-2 text-xs text-hoi-muted">
          Configura la carpeta de HOI4 en Ajustes para ver las imágenes reales.
        </p>
      )}
      {names === null ? (
        <p className="text-sm text-hoi-muted">Leyendo los íconos del juego…</p>
      ) : (
        <div
          data-sprite-grid
          className="overflow-y-auto rounded border border-hoi-border"
          style={{ height: VIEW_H, width: GRID_W }}
          onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
        >
          <div style={{ height: rows * CELL_H, position: 'relative' }}>
            {visible.map((n, k) => {
              const idx = first * cols + k
              const x = (idx % cols) * CELL_W
              const y = Math.floor(idx / cols) * CELL_H
              return (
                <button
                  key={n}
                  data-sprite={n}
                  title={n}
                  onClick={() => setSel(n)}
                  onDoubleClick={() => onPick(n)}
                  className={`absolute flex flex-col items-center justify-center gap-1 rounded p-1 ${n === sel ? 'bg-hoi-accent/20 ring-1 ring-hoi-accent' : 'hover:bg-hoi-card'}`}
                  style={{ left: x, top: y, width: CELL_W, height: CELL_H }}
                >
                  <GameSprite name={n} height={56} />
                  <span className="w-full truncate text-center text-[11px] text-hoi-muted">
                    {label(n)}
                  </span>
                </button>
              )
            })}
          </div>
          {!list.length && <p className="p-3 text-sm text-hoi-muted">Nada coincide.</p>}
        </div>
      )}
    </Modal>
  )
}
