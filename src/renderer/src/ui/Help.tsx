// Ayuda "?": un ícono pequeño junto a un concepto. Al pasar el mouse (o al hacer clic) aparece un
// globo al lado con qué hace, un ejemplo y cómo se ve en el juego. Se cierra al quitar el mouse o con Esc.
import { useEffect, useRef, useState } from 'react'
import { HelpCircle } from 'lucide-react'
import { HELP } from './helpTexts'

const W = 300

export default function Help({ id }: { id: string }): JSX.Element | null {
  const entry = HELP[id]
  const btn = useRef<HTMLButtonElement>(null)
  const [hover, setHover] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null)
  const open = hover || pinned
  useEffect(() => {
    if (!open || !btn.current) return
    const r = btn.current.getBoundingClientRect()
    const right = r.right + 10 + W < window.innerWidth
    setPos({
      left: right ? r.right + 10 : Math.max(8, r.left - 10 - W),
      top: Math.min(Math.max(8, r.top - 8), Math.max(8, window.innerHeight - 220))
    })
  }, [open])
  useEffect(() => {
    if (!open) return
    const esc = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setHover(false)
        setPinned(false)
      }
    }
    const away = (e: PointerEvent): void => {
      if (!(e.target as Element).closest?.('[data-help-root]')) setPinned(false)
    }
    window.addEventListener('keydown', esc, true)
    window.addEventListener('pointerdown', away)
    return () => {
      window.removeEventListener('keydown', esc, true)
      window.removeEventListener('pointerdown', away)
    }
  }, [open])
  if (!entry) return null
  return (
    <span data-help-root className="inline-flex align-middle">
      <button
        ref={btn}
        type="button"
        data-help={id}
        aria-label={`Ayuda: ${entry.title}`}
        className="ml-1 text-hoi-muted hover:text-hoi-text"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={(e) => {
          e.stopPropagation()
          setPinned((p) => !p)
        }}
      >
        <HelpCircle size={13} />
      </button>
      {open && pos && (
        <div
          role="tooltip"
          data-help-bubble={id}
          onMouseEnter={() => setHover(true)}
          onMouseLeave={() => setHover(false)}
          className="fixed z-[200] rounded-lg border border-hoi-border bg-hoi-panel p-3 text-xs normal-case shadow-xl"
          style={{ left: pos.left, top: pos.top, width: W }}
        >
          <div className="mb-1 text-sm font-medium text-hoi-text">{entry.title}</div>
          <p className="text-gray-300">{entry.what}</p>
          {entry.example && (
            <p className="mt-2 text-hoi-muted">
              <span className="text-gray-300">Ejemplo: </span>
              {entry.example}
            </p>
          )}
          {entry.ingame && (
            <p className="mt-2 text-hoi-muted">
              <span className="text-gray-300">En el juego: </span>
              {entry.ingame}
            </p>
          )}
        </div>
      )}
    </span>
  )
}
