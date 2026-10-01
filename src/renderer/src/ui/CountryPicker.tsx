// Selector de país universal: Mis países → En el mapa → Todos los del juego (plegable) →
// "+ Crear país nuevo…". Buscador por nombre o tag y navegación con teclado.
import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { store, useApp } from '../store/appStore'
import { countrySections, matchChoice, type CountryChoice } from '../countries/choices'
import { flagForTag } from './FlagThumb'
import Modal from './Modal'

type Row = { kind: 'country'; c: CountryChoice } | { kind: 'create' }

export default function CountryPicker(): JSX.Element | null {
  const req = useApp((s) => s.countryPicker)
  const project = useApp((s) => s.project)
  const map = useApp((s) => s.map)
  const game = useApp(() => store.catalogGame())
  useApp((s) => s.gameFlags)
  const [q, setQ] = useState('')
  const [allOpen, setAllOpen] = useState(false)
  const [cur, setCur] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (req) {
      setQ('')
      setCur(0)
    }
  }, [req])
  const sec = useMemo(() => countrySections(project, map, game), [project, map, game])
  const searching = q.trim() !== ''
  const showAll = allOpen || searching
  const rows: Row[] = useMemo(() => {
    const f = (l: CountryChoice[]): Row[] =>
      l.filter((c) => matchChoice(c, q)).map((c) => ({ kind: 'country', c }))
    return [...f(sec.mine), ...f(sec.onMap), ...(showAll ? f(sec.game) : []), { kind: 'create' }]
  }, [sec, q, showAll])
  useEffect(() => setCur(0), [q])
  useEffect(() => {
    listRef.current?.querySelector('[data-cur="1"]')?.scrollIntoView({ block: 'nearest' })
  }, [cur])
  if (!req) return null

  const choose = (r: Row): void => {
    if (r.kind === 'create') return store.answerCountryPick({ create: 'quick' })
    store.answerCountryPick({ tag: r.c.tag })
  }
  const header = (label: string, n: number, action?: JSX.Element): JSX.Element => (
    <div className="flex items-center justify-between px-2 pt-2 text-[11px] uppercase tracking-wide text-hoi-muted">
      <span>
        {label} ({n})
      </span>
      {action}
    </div>
  )
  const item = (r: Row, i: number): JSX.Element =>
    r.kind === 'create' ? (
      <div key="create" className="mt-2 flex gap-1 border-t border-hoi-border pt-2">
        {(['quick', 'wizard'] as const).map((m) => (
          <button
            key={m}
            data-cur={cur === i ? '1' : undefined}
            className={`btn flex-1 justify-center text-xs ${cur === i && m === 'quick' ? 'ring-2 ring-hoi-accent' : ''}`}
            onClick={() => store.answerCountryPick({ create: m })}
          >
            {m === 'quick' ? '+ Crear país nuevo… (rápido)' : 'con el asistente'}
          </button>
        ))}
      </div>
    ) : (
      <button
        key={r.c.tag}
        data-cur={cur === i ? '1' : undefined}
        onMouseMove={() => setCur(i)}
        onClick={() => choose(r)}
        className={`flex w-full items-center gap-2 rounded px-2 py-1 text-left text-sm ${cur === i ? 'bg-hoi-accent/20' : 'hover:bg-hoi-card'}`}
      >
        <img
          src={flagForTag(
            r.c.tag,
            project?.countries.find((x) => x.tag === r.c.tag)
          )}
          alt=""
          className="h-4 w-[25px] shrink-0 rounded-sm object-cover ring-1 ring-black/50"
        />
        <span className="flex-1 truncate">{r.c.name}</span>
        <span className="font-mono text-xs text-hoi-muted">{r.c.tag}</span>
        <span className="w-20 text-right text-xs text-hoi-muted">
          {r.c.states > 0 || r.c.mine ? (
            `${r.c.states} ${r.c.states === 1 ? 'estado' : 'estados'}`
          ) : (
            <span title="No tiene estados en tu mapa">—</span>
          )}
        </span>
      </button>
    )
  let idx = 0
  const block = (
    label: string,
    list: CountryChoice[],
    action?: JSX.Element,
    alwaysShow = false
  ): JSX.Element | null => {
    const l = list.filter((c) => matchChoice(c, q))
    if (!l.length && !action && !(alwaysShow && !searching)) return null
    return (
      <div key={label}>
        {header(label, l.length, action)}
        {l.map((c) => item({ kind: 'country', c }, idx++))}
        {!l.length && alwaysShow && (
          <p className="px-2 py-1 text-xs text-hoi-muted">
            Todavía no hay países en tu mapa. Pinta estados o elige uno de la lista de abajo.
          </p>
        )}
      </div>
    )
  }
  const mineBlock = block('Mis países', sec.mine)
  const mapBlock = block('En el mapa', sec.onMap, undefined, true)
  const allBlock = showAll ? block('Todos los países del juego', sec.game, undefined) : <div />
  return (
    <Modal title={req.title} width={520} onClose={() => store.answerCountryPick(null)}>
      <div
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setCur((c) => Math.min(rows.length - 1, c + 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setCur((c) => Math.max(0, c - 1))
          } else if (e.key === 'Enter' && rows[cur]) {
            e.preventDefault()
            choose(rows[cur])
          }
        }}
      >
        <input
          className="input mb-2"
          autoFocus
          placeholder="Buscar por nombre o tag (Rusia, SOV…)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div ref={listRef} className="max-h-[380px] overflow-y-auto">
          {mineBlock}
          {mapBlock}
          <button
            className="mt-1 flex w-full items-center gap-1 px-2 pt-2 text-left text-[11px] uppercase tracking-wide text-hoi-muted hover:text-hoi-text"
            onClick={() => setAllOpen(!allOpen)}
          >
            {showAll ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
            Todos los países del juego ({sec.game.length})
          </button>
          {showAll &&
            sec.game
              .filter((c) => matchChoice(c, q))
              .map((c) => item({ kind: 'country', c }, idx++))}
          {allBlock && null}
          {item({ kind: 'create' }, idx++)}
          {!rows.some((r) => r.kind === 'country') && (
            <p className="p-2 text-xs text-hoi-muted">Ningún país coincide con "{q}".</p>
          )}
        </div>
      </div>
    </Modal>
  )
}
