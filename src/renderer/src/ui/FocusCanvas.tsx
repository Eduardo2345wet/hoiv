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

interface Props {
  project: Project
  focuses: Focus[]
  selected: string | null
  tool: Tool
  onSelect: (uid: string | null) => void
  onMove: (uid: string, x: number, y: number) => void
  onLink: (from: string, to: string) => void
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
      props.onSelect(null)
      setLinkFrom(null)
    }
  }

  const onNodeDown = (e: React.PointerEvent, f: Focus): void => {
    e.stopPropagation()
    boxRef.current?.focus()
    if (e.button !== 0) return
    if (pick) {
      store.finishPick(f.uid)
      return
    }
    if (tool !== 'select') {
      // Modo conexión: primer clic = origen, segundo clic = destino
      if (!linkFrom) setLinkFrom(f.uid)
      else {
        props.onLink(linkFrom, f.uid)
        setLinkFrom(null)
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

  const onPointerMove = (e: React.PointerEvent): void => {
    const d = drag.current
    if (!d) return
    if (d.kind === 'pan') {
      setPan({ x: d.px + e.clientX - d.sx, y: d.py + e.clientY - d.sy })
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

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selected) props.onDelete(selected)
    if (e.key === 'Escape') setLinkFrom(null)
  }

  const byUid = new Map(focuses.map((f) => [f.uid, f]))
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
      onPointerDown={onBackgroundDown}
      onPointerMove={onPointerMove}
      onPointerUp={() => {
        // Soltar un foco cierra el paso de deshacer del arrastre
        if (drag.current?.kind === 'node') store.endGroup()
        drag.current = null
      }}
      onDoubleClick={onDoubleClick}
      onKeyDown={onKeyDown}
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
                  className="cursor-pointer"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => props.onUnlinkPrereq(pu, child.uid)}
                >
                  <title>Prerrequisito (clic para borrar)</title>
                  <path d={d} stroke="transparent" strokeWidth={12} fill="none" />
                  <path d={d} stroke="#d4d4d8" strokeWidth={3} fill="none" />
                </g>
              )
            })
          )}
          {exclusivePairs.map(([a, b]) => (
            <g
              key={`x-${a.uid}-${b.uid}`}
              className="cursor-pointer"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={() => props.onUnlinkExclusive(a.uid, b.uid)}
            >
              <title>Mutuamente excluyente (clic para borrar)</title>
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
                stroke="#ef4444"
                strokeWidth={3}
                strokeDasharray="8 4"
              />
            </g>
          ))}
        </svg>

        {/* Cajas de los focos */}
        {focuses.map((f) => {
          const isSel = f.uid === selected
          const isLink = f.uid === linkFrom
          const excluded = !!pick?.exclude.includes(f.uid)
          const pickHover = !!pick && !excluded && hover === f.uid
          const border = pickHover
            ? 'border-amber-400 bg-amber-500/20'
            : isLink
              ? 'border-sky-400'
              : isSel && !pick
                ? 'border-hoi-accent'
                : 'border-hoi-border'
          return (
            <div
              key={f.uid}
              onPointerDown={(e) => onNodeDown(e, f)}
              onPointerEnter={() => setHover(f.uid)}
              onPointerLeave={() => setHover((h) => (h === f.uid ? null : h))}
              onDoubleClick={(e) => e.stopPropagation()}
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
            </div>
          )
        })}
      </div>

      {pick && (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded bg-amber-500 px-3 py-1 text-sm font-semibold text-black shadow">
          🎯 Haz clic en el foco que necesitas · Esc para cancelar
        </div>
      )}
      {!pick && tool !== 'select' && (
        <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded bg-black/70 px-3 py-1 text-xs">
          {linkFrom
            ? 'Ahora haz clic en el segundo foco (Esc para cancelar)'
            : tool === 'prereq'
              ? 'Haz clic en el foco PADRE (el que se completa primero)'
              : 'Haz clic en el primer foco excluyente'}
        </div>
      )}
      <div className="pointer-events-none absolute bottom-2 left-2 text-[11px] text-hoi-muted">
        Doble clic: nuevo foco · Arrastrar fondo: mover · Rueda: zoom ({Math.round(zoom * 100)}%) ·
        Supr: borrar · Clic en una línea: quitarla
      </div>
    </div>
  )
}
