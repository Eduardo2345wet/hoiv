// "Elegir del juego": ventana con las ideas del juego en pestañas, buscador y lista virtualizada
// (solo se dibujan las filas visibles), con vista previa y botones para usar o copiar la idea.
import { useEffect, useMemo, useRef, useState } from 'react'
import type { GameIdea, IdeaTab } from '../../../shared/ideasParse'
import { fold, loadGameIdeas, modifierSummary } from '../catalog/gameIdeas'
import { store, useApp } from '../store/appStore'
import Modal from './Modal'

export const IDEA_TABS: [IdeaTab, string][] = [
  ['espiritus', 'Espíritus nacionales'],
  ['leyes', 'Leyes'],
  ['asesores', 'Asesores y diseñadores'],
  ['otros', 'Otros']
]
const ROW_H = 44
const OVERSCAN = 6

export default function IdeaPicker(): JSX.Element | null {
  const req = useApp((s) => s.ideaPicker)
  const gamePath = useApp((s) => s.gamePath)
  const [ideas, setIdeas] = useState<GameIdea[] | null>(null)
  const [tab, setTab] = useState<IdeaTab>('espiritus')
  const [query, setQuery] = useState('')
  const [sel, setSel] = useState(0)
  const [scroll, setScroll] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!req) return
    setQuery('')
    setSel(0)
    setTab('espiritus')
    void loadGameIdeas(gamePath).then(setIdeas)
  }, [req, gamePath])
  const list = useMemo(() => {
    const q = fold(query.trim())
    return (ideas ?? []).filter(
      (i) => i.tab === tab && (!q || fold(i.id).includes(q) || fold(i.name).includes(q))
    )
  }, [ideas, tab, query])
  if (!req) return null
  const cur = list[Math.min(sel, list.length - 1)]
  const close = (): void => store.set({ ideaPicker: null })
  const use = (i: GameIdea): void => {
    close()
    req.onUse(i.id)
  }
  const copy = (i: GameIdea): void => {
    close()
    req.onCopy(i)
  }
  const move = (d: number): void => {
    const n = Math.max(0, Math.min(list.length - 1, sel + d))
    setSel(n)
    const el = listRef.current
    if (el) {
      if (n * ROW_H < el.scrollTop) el.scrollTop = n * ROW_H
      else if ((n + 1) * ROW_H > el.scrollTop + el.clientHeight)
        el.scrollTop = (n + 1) * ROW_H - el.clientHeight
    }
  }
  const viewH = 360
  const first = Math.max(0, Math.floor(scroll / ROW_H) - OVERSCAN)
  const last = Math.min(list.length, Math.ceil((scroll + viewH) / ROW_H) + OVERSCAN)

  return (
    <Modal
      title={req.mode === 'copy' ? 'Crear a partir de uno del juego' : 'Elegir del juego'}
      width={860}
      onClose={close}
      footer={
        <>
          <button className="btn" onClick={close}>
            Cancelar
          </button>
          <button
            className="btn"
            disabled={!cur}
            onClick={() => cur && copy(cur)}
            title="Copia nombre, modificadores e ícono a un espíritu nuevo de tu mod"
          >
            Crear uno nuevo a partir de este
          </button>
          <button
            className="btn-primary disabled:opacity-40"
            disabled={!cur}
            onClick={() => cur && use(cur)}
          >
            Usar este
          </button>
        </>
      }
    >
      <div
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') (e.preventDefault(), move(1))
          else if (e.key === 'ArrowUp') (e.preventDefault(), move(-1))
          else if (e.key === 'Enter' && cur)
            (e.preventDefault(), req.mode === 'copy' ? copy(cur) : use(cur))
        }}
      >
        <div className="mb-2 flex border-b border-hoi-border">
          {IDEA_TABS.map(([id, label]) => (
            <button
              key={id}
              data-idea-tab={id}
              onClick={() => {
                setTab(id)
                setSel(0)
                if (listRef.current) listRef.current.scrollTop = 0
              }}
              className={`px-3 py-1.5 text-sm ${tab === id ? 'border-b-2 border-hoi-accent text-hoi-accent' : 'text-hoi-muted hover:text-hoi-text'}`}
            >
              {label} ({(ideas ?? []).filter((i) => i.tab === id).length})
            </button>
          ))}
        </div>
        <input
          autoFocus
          className="input mb-2"
          placeholder="Buscar por nombre o ID (sin acentos)…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setSel(0)
          }}
        />
        {!gamePath ? (
          <p className="text-sm text-yellow-300">Configura la carpeta de HOI4 en Ajustes.</p>
        ) : ideas === null ? (
          <p className="text-sm text-hoi-muted">Leyendo las ideas del juego (una sola vez)…</p>
        ) : (
          <div className="flex gap-3">
            <div
              ref={listRef}
              data-idea-list
              className="overflow-y-auto rounded border border-hoi-border"
              style={{ height: viewH, width: 440 }}
              onScroll={(e) => setScroll(e.currentTarget.scrollTop)}
            >
              <div style={{ height: list.length * ROW_H, position: 'relative' }}>
                {list.slice(first, last).map((i, k) => {
                  const n = first + k
                  return (
                    <div
                      key={`${i.id}-${n}`}
                      data-idea-row
                      onClick={() => setSel(n)}
                      onDoubleClick={() => (req.mode === 'copy' ? copy(i) : use(i))}
                      className={`absolute left-0 right-0 cursor-pointer overflow-hidden px-2 py-1 ${n === sel ? 'bg-hoi-accent/25' : 'hover:bg-hoi-card'}`}
                      style={{ top: n * ROW_H, height: ROW_H }}
                    >
                      <div className="truncate text-sm">
                        {i.name || i.id}{' '}
                        <span className="font-mono text-[11px] text-hoi-muted">{i.id}</span>
                      </div>
                      <div className="truncate text-[11px] text-hoi-muted">
                        {i.category} · {modifierSummary(i) || 'sin modificadores simples'}
                      </div>
                    </div>
                  )
                })}
              </div>
              {!list.length && <p className="p-3 text-sm text-hoi-muted">Nada coincide.</p>}
            </div>
            <div className="min-w-0 flex-1 text-sm" data-idea-preview>
              {cur ? (
                <>
                  <div className="font-semibold">{cur.name || cur.id}</div>
                  <div className="font-mono text-xs text-hoi-muted">
                    {cur.id} · {cur.category} · {cur.file}
                  </div>
                  {cur.desc && <p className="mt-2 text-xs">{cur.desc}</p>}
                  <div className="mt-2 text-xs font-semibold text-hoi-muted">Modificadores</div>
                  <ul className="text-xs">
                    {cur.modifiers.map(([k, v]) => (
                      <li key={k} className="font-mono">
                        {k} = {v}
                      </li>
                    ))}
                  </ul>
                  {cur.extraModifierText && (
                    <pre className="mt-1 max-h-28 overflow-auto rounded bg-hoi-card p-1 text-[11px]">
                      {cur.extraModifierText}
                    </pre>
                  )}
                  {cur.extraText && (
                    <pre className="mt-1 max-h-28 overflow-auto rounded bg-hoi-card p-1 text-[11px]">
                      {cur.extraText}
                    </pre>
                  )}
                </>
              ) : (
                <p className="text-hoi-muted">Selecciona una idea.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
