// Lienzo del árbol de focos: cuadrícula con zoom, desplazamiento,
// arrastre de focos (se ajustan a la cuadrícula) y conexión de líneas.
import { useEffect, useRef, useState } from 'react'
import type { Focus, Project } from '../types'
import { store, useApp } from '../store/appStore'
import IconThumb from './IconThumb'

// Tamaño de una casilla de la cuadrícula en píxeles (x=1 en el juego = 1 casilla)
export const CELL_W = 120
export const CELL_H = 140
const NODE_W = 104
const NODE_H = 96

export type Tool = 'select' | 'prereq' | 'exclusive'
export type LinkKind = 'prereq' | 'excl'

/** Línea seleccionada (se borra con Supr) */
type Line = { kind: LinkKind; a: string; b: string }

interface Props {
  project: Project
  focuses: Focus[]
  selected: string | null
  tool: Tool
  onSelect: (uid: string | null) => void
  onMove: (uid: string, x: number, y: number) => void
  /** Conecta (kind prereq: from = padre; excl: exclusión). Devuelve el motivo si no se pudo */
  onLink: (kind: LinkKind, from: string, to: string) => string | null
  /** Por qué NO se puede conectar (null si se puede): colorea el destino al arrastrar */
  canLink: (kind: LinkKind, from: string, to: string) => string | null
  onAddChild: (uid: string) => void
  onTool: (t: Tool) => void
  onUnlinkPrereq: (parent: string, child: string) => void
  onUnlinkExclusive: (a: string, b: string) => void
  onAddAt: (x: number, y: number) => void
  onDelete: (uid: string) => void
}

/** Centro (en píxeles del lienzo) de la casilla x,y */
const cx = (x: number): number => x * CELL_W + CELL_W / 2
const cy = (y: number): number => y * CELL_H + CELL_H / 2

export default function FocusCanvas(props: Props): JSX.Element {
  const { focuses, selected, tool } = props
  const [pan, setPan] = useState({ x: 40, y: 40 })
  const [zoom, setZoom] = useState(1)
  const [linkFrom, setLinkFrom] = useState<string | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [selLine, setSelLine] = useState<Line | null>(null)
  // Línea provisional al arrastrar desde un asa y foco destino (verde válido / rojo no)
  const [ghost, setGhost] = useState<{
    kind: LinkKind
    from: string
    x: number
    y: number
    target: string | null
    valid: boolean
  } | null>(null)
  const latest = useRef(props)
  latest.current = props
  const ghostTarget = useRef<string | null>(null)
  const linkRef = useRef<string | null>(null)
  const selLineRef = useRef<Line | null>(null)
  linkRef.current = linkFrom
  selLineRef.current = selLine
  // Modo selección genérico del store (ej. "completó el foco" → 🎯 Elegir en el árbol)
  const pick = useApp((s) => (s.pick?.kind === 'focus' ? s.pick : null))

  // Esc cancela el modo selección aunque el teclado esté en Blockly
  useEffect(() => {
    if (!pick) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') store.cancelPick()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pick])
  // Qué se está arrastrando ahora mismo
  const drag = useRef<
    | { kind: 'pan'; sx: number; sy: number; px: number; py: number }
    | { kind: 'node'; uid: string; offX: number; offY: number }
    | { kind: 'handle'; link: LinkKind; uid: string; sx: number; sy: number; moved: boolean }
    | null
  >(null)

  /** Convierte coordenadas del ratón a coordenadas del lienzo (sin zoom/desplazamiento) */
  const toWorld = (clientX: number, clientY: number): { x: number; y: number } => {
    const r = boxRef.current!.getBoundingClientRect()
    return {
      x: (clientX - r.left - pan.x) / zoom,
      y: (clientY - r.top - pan.y) / zoom
    }
  }

  const onWheel = (e: React.WheelEvent): void => {
    const r = boxRef.current!.getBoundingClientRect()
    const mx = e.clientX - r.left
    const my = e.clientY - r.top
    const next = Math.min(2.5, Math.max(0.25, zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1)))
    // Mantener el punto bajo el ratón en su sitio al hacer zoom
    setPan({
      x: mx - ((mx - pan.x) * next) / zoom,
      y: my - ((my - pan.y) * next) / zoom
    })
    setZoom(next)
  }

  const onBackgroundDown = (e: React.PointerEvent): void => {
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
    drag.current = {
      kind: 'pan',
      sx: e.clientX,
      sy: e.clientY,
      px: pan.x,
      py: pan.y
    }
    if (pick && e.button === 0) {
      // Clic en vacío: cancelar sin cambios
      store.cancelPick()
      drag.current = null
      return
    }
    if (e.button === 0) {
      setSelLine(null)
      // Con una conexión pendiente, el clic en el fondo solo la cancela (el foco sigue seleccionado)
      if (linkFrom) setLinkFrom(null)
      else props.onSelect(null)
    }
  }

  const onNodeDown = (e: React.PointerEvent, f: Focus): void => {
    e.stopPropagation()
    boxRef.current?.focus({ preventScroll: true })
    if (e.button !== 0) return
    if (pick) {
      store.finishPick(f.uid)
      return
    }
    setSelLine(null)
    if (tool !== 'select') {
      // Un clic en un foco SIEMPRE lo selecciona. Conexión: 1er clic = padre, 2º = hijo.
      const kind: LinkKind = tool === 'prereq' ? 'prereq' : 'excl'
      if (!linkFrom || linkFrom === f.uid) {
        props.onSelect(f.uid)
        setLinkFrom(linkFrom === f.uid ? null : f.uid) // el mismo foco cancela la conexión
      } else {
        const err = props.onLink(kind, linkFrom, f.uid)
        setLinkFrom(null)
        // Si se creó, queda seleccionado el hijo (o el segundo foco); si no, el que se pulsó
        props.onSelect(f.uid)
        void err
      }
      return
    }
    props.onSelect(f.uid)
    const w = toWorld(e.clientX, e.clientY)
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    drag.current = {
      kind: 'node',
      uid: f.uid,
      offX: w.x - cx(f.x),
      offY: w.y - cy(f.y)
    }
  }

  const startHandle = (e: React.PointerEvent, uid: string, link: LinkKind): void => {
    e.stopPropagation()
    if (e.button !== 0) return
    boxRef.current?.focus({ preventScroll: true })
    props.onSelect(uid)
    setSelLine(null)
    ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
    drag.current = { kind: 'handle', link, uid, sx: e.clientX, sy: e.clientY, moved: false }
  }

  const onPointerMove = (e: React.PointerEvent): void => {
    const d = drag.current
    if (!d) return
    if (d.kind === 'pan') {
      setPan({ x: d.px + e.clientX - d.sx, y: d.py + e.clientY - d.sy })
    } else if (d.kind === 'handle') {
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 5) return
      d.moved = true
      const w = toWorld(e.clientX, e.clientY)
      const target = focuses.find(
        (x) =>
          x.uid !== d.uid &&
          Math.abs(w.x - cx(x.x)) < NODE_W / 2 &&
          Math.abs(w.y - cy(x.y)) < NODE_H / 2
      )
      ghostTarget.current = target?.uid ?? null
      setGhost({
        kind: d.link,
        from: d.uid,
        x: w.x,
        y: w.y,
        target: target?.uid ?? null,
        valid: !!target && !props.canLink(d.link, d.uid, target.uid)
      })
    } else {
      const w = toWorld(e.clientX, e.clientY)
      // Ajuste a la cuadrícula
      const gx = Math.max(0, Math.round((w.x - d.offX - CELL_W / 2) / CELL_W))
      const gy = Math.max(0, Math.round((w.y - d.offY - CELL_H / 2) / CELL_H))
      const f = focuses.find((x) => x.uid === d.uid)
      if (f && (f.x !== gx || f.y !== gy)) props.onMove(d.uid, gx, gy)
    }
  }

  const onDoubleClick = (e: React.MouseEvent): void => {
    const w = toWorld(e.clientX, e.clientY)
    props.onAddAt(Math.max(0, Math.floor(w.x / CELL_W)), Math.max(0, Math.floor(w.y / CELL_H)))
  }

  // Atajos con cualquier herramienta, pero NUNCA mientras se escribe en un campo
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement | null
      if (
        t?.closest?.(
          'input, textarea, select, [contenteditable="true"], .injectionDiv, .blocklyWidgetDiv'
        )
      )
        return
      if (store.get().pick) return
      const pr = latest.current
      if (e.key === 'Escape') {
        if (linkRef.current) setLinkFrom(null)
        else if (selLineRef.current) setSelLine(null)
        else if (pr.tool !== 'select') pr.onTool('select')
        return
      }
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const l = selLineRef.current
        if (l) {
          if (l.kind === 'prereq') pr.onUnlinkPrereq(l.a, l.b)
          else pr.onUnlinkExclusive(l.a, l.b)
          setSelLine(null)
        } else if (pr.selected) pr.onDelete(pr.selected)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const byUid = new Map(focuses.map((f) => [f.uid, f]))
  // Mensaje de la conexión pendiente (también en la barra de estado)
  const hint =
    tool === 'select'
      ? ''
      : tool === 'prereq'
        ? linkFrom
          ? 'Ahora haz clic en el foco HIJO (Esc o clic en el vacío cancelan)'
          : 'Haz clic en el foco PADRE (el que se completa primero)'
        : linkFrom
          ? 'Ahora el foco excluyente (Esc o clic en el vacío cancelan)'
          : 'Elige el primer foco'
  useEffect(() => {
    store.set({ focusHint: hint })
    return () => store.set({ focusHint: '' })
  }, [hint])
  const exclusivePairs: [Focus, Focus][] = []
  for (const f of focuses)
    for (const o of f.mutuallyExclusive) {
      const other = byUid.get(o)
      if (other && f.uid < other.uid) exclusivePairs.push([f, other])
    }

  const width = (Math.max(10, ...focuses.map((f) => f.x)) + 3) * CELL_W
  const height = (Math.max(6, ...focuses.map((f) => f.y)) + 3) * CELL_H

  return (
    <div
      ref={boxRef}
      tabIndex={0}
      className="relative h-full w-full overflow-hidden outline-none"
      style={{
        cursor: pick || tool !== 'select' ? 'crosshair' : 'default',
        backgroundColor: '#141417',
        backgroundImage:
          'linear-gradient(#26262e 1px, transparent 1px), linear-gradient(90deg, #26262e 1px, transparent 1px)',
        backgroundSize: `${CELL_W * zoom}px ${CELL_H * zoom}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`
      }}
      onWheel={onWheel}
      // El navegador puede desplazar un contenedor overflow:hidden al enfocar o al hacer clic: se anula
      onScroll={(e) => {
        e.currentTarget.scrollTop = 0
        e.currentTarget.scrollLeft = 0
      }}
      onPointerDown={onBackgroundDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => {
        const d = drag.current
        // Soltar un foco cierra el paso de deshacer del arrastre
        if (d?.kind === 'node') store.endGroup()
        if (d?.kind === 'handle') {
          if (!d.moved) props.onAddChild(d.uid)
          else if (ghostTarget.current) {
            props.onLink(d.link, d.uid, ghostTarget.current)
            props.onSelect(ghostTarget.current)
          }
          ghostTarget.current = null
          setGhost(null)
        }
        drag.current = null
      }}
      onDoubleClick={onDoubleClick}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="absolute left-0 top-0"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }}
      >
        {/* Líneas (debajo de las cajas) */}
        <svg width={width} height={height} className="absolute left-0 top-0 overflow-visible">
          {focuses.flatMap((child) =>
            child.prerequisites.map((pu) => {
              const parent = byUid.get(pu)
              if (!parent) return null
              const x1 = cx(parent.x)
              const y1 = cy(parent.y) + NODE_H / 2
              const x2 = cx(child.x)
              const y2 = cy(child.y) - NODE_H / 2
              const my = (y1 + y2) / 2
              const d = `M ${x1} ${y1} V ${my} H ${x2} V ${y2}`
              return (
                <g
                  key={`p-${pu}-${child.uid}`}
                  data-line="prereq"
                  className="cursor-pointer"
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    boxRef.current?.focus({ preventScroll: true })
                    setSelLine({ kind: 'prereq', a: pu, b: child.uid })
                  }}
                >
                  <title>Prerrequisito (clic para seleccionarlo, Supr para borrarlo)</title>
                  <path d={d} stroke="transparent" strokeWidth={12} fill="none" />
                  <path
                    d={d}
                    stroke={
                      selLine?.kind === 'prereq' && selLine.a === pu && selLine.b === child.uid
                        ? '#f97316'
                        : '#d4d4d8'
                    }
                    strokeWidth={3}
                    fill="none"
                  />
                </g>
              )
            })
          )}
          {exclusivePairs.map(([a, b]) => (
            <g
              key={`x-${a.uid}-${b.uid}`}
              data-line="excl"
              className="cursor-pointer"
              onPointerDown={(e) => {
                e.stopPropagation()
                boxRef.current?.focus({ preventScroll: true })
                setSelLine({ kind: 'excl', a: a.uid, b: b.uid })
              }}
            >
              <title>Mutuamente excluyente (clic para seleccionarla, Supr para borrarla)</title>
              <line
                x1={cx(a.x)}
                y1={cy(a.y)}
                x2={cx(b.x)}
                y2={cy(b.y)}
                stroke="transparent"
                strokeWidth={12}
              />
              <line
                x1={cx(a.x)}
                y1={cy(a.y)}
                x2={cx(b.x)}
                y2={cy(b.y)}
                stroke={
                  selLine?.kind === 'excl' && selLine.a === a.uid && selLine.b === b.uid
                    ? '#f97316'
                    : '#ef4444'
                }
                strokeWidth={3}
                strokeDasharray="8 4"
              />
            </g>
          ))}
          {ghost && (
            <line
              x1={cx(byUid.get(ghost.from)!.x)}
              y1={
                ghost.kind === 'prereq'
                  ? cy(byUid.get(ghost.from)!.y) + NODE_H / 2
                  : cy(byUid.get(ghost.from)!.y)
              }
              x2={ghost.x}
              y2={ghost.y}
              stroke={ghost.kind === 'prereq' ? '#38bdf8' : '#ef4444'}
              strokeWidth={3}
              strokeDasharray="6 4"
              pointerEvents="none"
            />
          )}
        </svg>

        {/* Cajas de los focos */}
        {focuses.map((f) => {
          const isSel = f.uid === selected
          const isLink = f.uid === linkFrom
          const excluded = !!pick?.exclude.includes(f.uid)
          const pickHover = !!pick && !excluded && hover === f.uid
          const isFrom = linkFrom === f.uid
          const isGhostTarget = ghost?.target === f.uid
          const border = isGhostTarget
            ? ghost?.valid
              ? 'border-green-500 bg-green-500/20'
              : 'border-red-500 bg-red-500/20'
            : isFrom
              ? 'border-amber-400 bg-amber-500/20'
              : pickHover
                ? 'border-amber-400 bg-amber-500/20'
                : isLink
                  ? 'border-sky-400'
                  : isSel && !pick
                    ? 'border-hoi-accent'
                    : 'border-hoi-border'
          return (
            <div
              key={f.uid}
              data-focus-uid={f.uid}
              onPointerDown={(e) => onNodeDown(e, f)}
              onPointerEnter={() => setHover(f.uid)}
              onPointerLeave={() => setHover((h) => (h === f.uid ? null : h))}
              onDoubleClick={(e) => {
                e.stopPropagation()
                props.onSelect(f.uid)
                // Doble clic: cursor en el campo "Nombre" del panel
                setTimeout(() => {
                  const el = document.querySelector<HTMLInputElement>('[data-focus-name]')
                  el?.focus()
                  el?.select()
                }, 0)
              }}
              className={`absolute flex flex-col items-center justify-center rounded-md border-2 bg-hoi-card px-1 text-center shadow-lg ${border} ${
                excluded ? 'opacity-30' : ''
              }`}
              style={{
                left: cx(f.x) - NODE_W / 2,
                top: cy(f.y) - NODE_H / 2,
                width: NODE_W,
                height: NODE_H,
                cursor: pick
                  ? excluded
                    ? 'not-allowed'
                    : 'crosshair'
                  : tool === 'select'
                    ? 'grab'
                    : 'pointer'
              }}
            >
              <IconThumb icon={f.icon} project={props.project} height={46} />
              <div className="mt-0.5 line-clamp-2 text-[11px] font-medium leading-tight">
                {f.name || <span className="text-red-400">sin nombre</span>}
              </div>
              <div className="text-[10px] text-hoi-muted">{f.cost} sem.</div>
              {hover === f.uid && !pick && (
                <>
                  <button
                    data-handle="child"
                    title="Clic: añadir un hijo · Arrastra hasta otro foco: prerrequisito"
                    className="absolute -bottom-3 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border-2 border-sky-400 bg-hoi-panel text-[10px] leading-none text-sky-300"
                    style={{ cursor: 'pointer' }}
                    onPointerDown={(e) => startHandle(e, f.uid, 'prereq')}
                  >
                    ●
                  </button>
                  <button
                    data-handle="excl"
                    title="Arrastra hasta otro foco: exclusión mutua"
                    className="absolute -right-3 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full border-2 border-red-500 bg-hoi-panel text-[11px] font-bold leading-none text-red-400"
                    style={{ cursor: 'pointer' }}
                    onPointerDown={(e) => startHandle(e, f.uid, 'excl')}
                  >
                    ✕
                  </button>
                </>
              )}
            </div>
          )
        })}
      </div>

      {pick && (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded bg-amber-500 px-3 py-1 text-sm font-semibold text-black shadow">
          🎯 Haz clic en el foco que necesitas · Esc para cancelar
        </div>
      )}
      {!pick && hint && (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded bg-black/70 px-3 py-1 text-xs">
          {hint}
        </div>
      )}
      <div className="pointer-events-none absolute bottom-2 left-2 text-[11px] text-hoi-muted">
        Doble clic: nuevo foco · Arrastrar fondo: mover · Rueda: zoom ({Math.round(zoom * 100)}%) ·
        Supr: borrar · Clic en una línea: seleccionarla (Supr la borra)
      </div>
    </div>
  )
}
