// Lienzo del árbol de focos: cuadrícula, cajitas arrastrables y conexiones.
//   - Arrastrar un foco: lo mueve (se ajusta a la cuadrícula).
//   - Arrastrar el fondo o botón central del ratón: desplaza la vista.
//   - Rueda del ratón: zoom.
//   - Doble clic en el fondo: añade un foco en esa casilla.

import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import clsx from 'clsx'
import { Ban, Link2, Maximize, MousePointer2, Plus } from 'lucide-react'
import type { Focus, Project } from '../model/project'

// Tamaño de una casilla de la cuadrícula y de cada cajita (en píxeles del lienzo).
export const CELL_W = 130
export const CELL_H = 150
const BOX_W = 116
const BOX_H = 84
const PAD_X = (CELL_W - BOX_W) / 2
const PAD_Y = (CELL_H - BOX_H) / 2
const GRID_COLS = 80
const GRID_ROWS = 50

type Mode = 'select' | 'prerequisite' | 'exclusive'

interface View {
  tx: number
  ty: number
  scale: number
}

interface Props {
  project: Project
  selectedUid: string | null
  onSelect: (uid: string | null) => void
  onMove: (uid: string, x: number, y: number) => void
  onAdd: (x: number, y: number) => void
  onDelete: (uid: string) => void
  onTogglePrerequisite: (parentUid: string, childUid: string) => void
  onToggleExclusive: (aUid: string, bUid: string) => void
}

const boxLeft = (f: Focus): number => f.x * CELL_W + PAD_X
const boxTop = (f: Focus): number => f.y * CELL_H + PAD_Y

const HINTS: Record<Mode, string> = {
  select: 'Arrastra los focos para moverlos. Doble clic en el fondo para añadir uno. Supr para borrar.',
  prerequisite:
    'Haz clic primero en el foco que se debe completar ANTES, y luego en el foco que lo necesita. Repite para quitar la línea.',
  exclusive: 'Haz clic en dos focos para hacerlos mutuamente excluyentes (línea roja). Repite para quitarla.'
}

export default function FocusCanvas(props: Props): JSX.Element {
  const { project, selectedUid } = props
  const svgRef = useRef<SVGSVGElement>(null)
  const [view, setView] = useState<View>({ tx: 40, ty: 40, scale: 1 })
  const [mode, setMode] = useState<Mode>('select')
  const [linkSource, setLinkSource] = useState<string | null>(null)

  // Estado del arrastre actual (foco o vista).
  const dragRef = useRef<
    | { kind: 'focus'; uid: string; grabX: number; grabY: number }
    | { kind: 'pan'; startX: number; startY: number; tx: number; ty: number; moved: boolean }
    | null
  >(null)

  const byUid = useMemo(() => new Map(project.foci.map((f) => [f.uid, f])), [project.foci])

  /** Convierte coordenadas de pantalla a coordenadas del lienzo. */
  const toWorld = (clientX: number, clientY: number): { x: number; y: number } => {
    const rect = svgRef.current!.getBoundingClientRect()
    return { x: (clientX - rect.left - view.tx) / view.scale, y: (clientY - rect.top - view.ty) / view.scale }
  }

  // Zoom con la rueda (listener nativo para poder usar preventDefault).
  useEffect(() => {
    const svg = svgRef.current
    if (!svg) return
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault()
      const rect = svg.getBoundingClientRect()
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      setView((v) => {
        const scale = Math.min(2, Math.max(0.25, v.scale * Math.exp(-e.deltaY * 0.0015)))
        const k = scale / v.scale
        return { scale, tx: mx - (mx - v.tx) * k, ty: my - (my - v.ty) * k }
      })
    }
    svg.addEventListener('wheel', onWheel, { passive: false })
    return () => svg.removeEventListener('wheel', onWheel)
  }, [])

  const changeMode = (m: Mode): void => {
    setMode(m)
    setLinkSource(null)
  }

  const onBackgroundPointerDown = (e: ReactPointerEvent): void => {
    if (e.button !== 0 && e.button !== 1) return
    svgRef.current?.setPointerCapture(e.pointerId)
    dragRef.current = { kind: 'pan', startX: e.clientX, startY: e.clientY, tx: view.tx, ty: view.ty, moved: false }
  }

  const onFocusPointerDown = (e: ReactPointerEvent, focus: Focus): void => {
    if (e.button === 1) return onBackgroundPointerDown(e)
    if (e.button !== 0) return
    e.stopPropagation()
    svgRef.current?.parentElement?.focus()

    if (mode === 'select') {
      props.onSelect(focus.uid)
      const p = toWorld(e.clientX, e.clientY)
      svgRef.current?.setPointerCapture(e.pointerId)
      dragRef.current = { kind: 'focus', uid: focus.uid, grabX: p.x - boxLeft(focus), grabY: p.y - boxTop(focus) }
      return
    }

    // Modos de conexión: primer clic = origen, segundo clic = destino.
    if (!linkSource) {
      setLinkSource(focus.uid)
    } else if (linkSource !== focus.uid) {
      if (mode === 'prerequisite') props.onTogglePrerequisite(linkSource, focus.uid)
      else props.onToggleExclusive(linkSource, focus.uid)
      setLinkSource(null)
    } else {
      setLinkSource(null)
    }
  }

  const onPointerMove = (e: ReactPointerEvent): void => {
    const drag = dragRef.current
    if (!drag) return
    if (drag.kind === 'pan') {
      const dx = e.clientX - drag.startX
      const dy = e.clientY - drag.startY
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true
      setView((v) => ({ ...v, tx: drag.tx + dx, ty: drag.ty + dy }))
      return
    }
    // Ajustar a la cuadrícula mientras se arrastra.
    const p = toWorld(e.clientX, e.clientY)
    const x = Math.max(0, Math.round((p.x - drag.grabX - PAD_X) / CELL_W))
    const y = Math.max(0, Math.round((p.y - drag.grabY - PAD_Y) / CELL_H))
    const focus = byUid.get(drag.uid)
    if (focus && (focus.x !== x || focus.y !== y)) props.onMove(drag.uid, x, y)
  }

  const onPointerUp = (): void => {
    const drag = dragRef.current
    dragRef.current = null
    // Un clic en el fondo (sin arrastrar) quita la selección.
    if (drag?.kind === 'pan' && !drag.moved) {
      props.onSelect(null)
      setLinkSource(null)
    }
  }

  const onDoubleClick = (e: React.MouseEvent): void => {
    const p = toWorld(e.clientX, e.clientY)
    props.onAdd(Math.max(0, Math.floor(p.x / CELL_W)), Math.max(0, Math.floor(p.y / CELL_H)))
  }

  const onKeyDown = (e: React.KeyboardEvent): void => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedUid && mode === 'select') {
      props.onDelete(selectedUid)
    } else if (e.key === 'Escape') {
      setLinkSource(null)
      setMode('select')
    }
  }

  /** Añade un foco en el centro de lo que se ve ahora. */
  const addAtCenter = (): void => {
    const rect = svgRef.current!.getBoundingClientRect()
    const p = toWorld(rect.left + rect.width / 2, rect.top + rect.height / 3)
    props.onAdd(Math.max(0, Math.floor(p.x / CELL_W)), Math.max(0, Math.floor(p.y / CELL_H)))
  }

  const resetView = (): void => setView({ tx: 40, ty: 40, scale: 1 })

  // ---------- Conexiones ----------
  const prerequisiteLines: JSX.Element[] = []
  const exclusiveLines: JSX.Element[] = []
  for (const child of project.foci) {
    for (const parentUid of child.prerequisites) {
      const parent = byUid.get(parentUid)
      if (!parent) continue
      const x1 = boxLeft(parent) + BOX_W / 2
      const y1 = boxTop(parent) + BOX_H
      const x2 = boxLeft(child) + BOX_W / 2
      const y2 = boxTop(child)
      const midY = y1 + (y2 - y1) / 2
      prerequisiteLines.push(
        <path
          key={`p-${parentUid}-${child.uid}`}
          d={`M ${x1} ${y1} V ${midY} H ${x2} V ${y2}`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={3}
          // Línea discontinua = basta con completar uno de los prerrequisitos (igual que en el juego).
          strokeDasharray={child.prerequisiteMode === 'any' ? '8 6' : undefined}
          markerEnd="url(#arrow)"
        />
      )
    }
    for (const otherUid of child.mutuallyExclusive) {
      const other = byUid.get(otherUid)
      if (!other || child.uid > otherUid) continue
      const x1 = boxLeft(child) + BOX_W / 2
      const y1 = boxTop(child) + BOX_H / 2
      const x2 = boxLeft(other) + BOX_W / 2
      const y2 = boxTop(other) + BOX_H / 2
      exclusiveLines.push(
        <g key={`m-${child.uid}-${otherUid}`}>
          <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ef4444" strokeWidth={4} />
          <circle cx={(x1 + x2) / 2} cy={(y1 + y2) / 2} r={9} fill="#ef4444" />
          <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 + 4} textAnchor="middle" fontSize={12} fill="white">
            ✕
          </text>
        </g>
      )
    }
  }

  const modeButton = (m: Mode, label: string, icon: JSX.Element): JSX.Element => (
    <button
      onClick={() => changeMode(m)}
      className={clsx(
        'flex items-center gap-1 rounded px-2 py-1 text-xs',
        mode === m ? 'bg-hoi-accent text-white' : 'bg-hoi-card text-hoi-text hover:bg-hoi-border'
      )}
    >
      {icon}
      {label}
    </button>
  )

  return (
    <div className="relative h-full w-full outline-none" tabIndex={0} onKeyDown={onKeyDown}>
      {/* Barra de herramientas del lienzo */}
      <div className="absolute left-2 top-2 z-10 flex flex-wrap items-center gap-1 rounded-md border border-hoi-border bg-hoi-panel/95 p-1 shadow-lg">
        <button
          onClick={addAtCenter}
          className="flex items-center gap-1 rounded bg-hoi-accent px-2 py-1 text-xs font-semibold text-white hover:bg-hoi-accentHover"
        >
          <Plus size={14} /> Añadir foco
        </button>
        <span className="mx-1 h-5 w-px bg-hoi-border" />
        {modeButton('select', 'Mover', <MousePointer2 size={14} />)}
        {modeButton('prerequisite', 'Prerrequisito', <Link2 size={14} />)}
        {modeButton('exclusive', 'Excluyente', <Ban size={14} />)}
        <span className="mx-1 h-5 w-px bg-hoi-border" />
        <button
          onClick={resetView}
          title="Restablecer vista"
          className="flex items-center gap-1 rounded bg-hoi-card px-2 py-1 text-xs hover:bg-hoi-border"
        >
          <Maximize size={14} /> {Math.round(view.scale * 100)}%
        </button>
      </div>
      <div className="pointer-events-none absolute bottom-2 left-2 z-10 max-w-xl rounded bg-hoi-panel/90 px-2 py-1 text-xs text-hoi-muted">
        {linkSource ? 'Ahora haz clic en el segundo foco (Esc para cancelar).' : HINTS[mode]}
      </div>

      <svg
        ref={svgRef}
        className={clsx('h-full w-full', mode === 'select' ? 'cursor-grab' : 'cursor-crosshair')}
        onPointerDown={onBackgroundPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onDoubleClick={onDoubleClick}
      >
        <defs>
          <pattern id="grid" width={CELL_W} height={CELL_H} patternUnits="userSpaceOnUse">
            <rect width={CELL_W} height={CELL_H} fill="#16161a" stroke="#26262e" strokeWidth={1} />
          </pattern>
          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="#e5e7eb" />
          </marker>
        </defs>
        <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
          <rect x={0} y={0} width={CELL_W * GRID_COLS} height={CELL_H * GRID_ROWS} fill="url(#grid)" />
          {/* Números de columna (x) */}
          {Array.from({ length: GRID_COLS }, (_, i) => (
            <text key={`cx${i}`} x={i * CELL_W + CELL_W / 2} y={-6} textAnchor="middle" fontSize={11} fill="#6b7280">
              {i}
            </text>
          ))}
          {/* Números de fila (y) */}
          {Array.from({ length: GRID_ROWS }, (_, i) => (
            <text key={`cy${i}`} x={-8} y={i * CELL_H + CELL_H / 2} textAnchor="end" fontSize={11} fill="#6b7280">
              {i}
            </text>
          ))}
          {prerequisiteLines}
          {exclusiveLines}
          {project.foci.map((focus) => {
            const selected = focus.uid === selectedUid
            const isSource = focus.uid === linkSource
            return (
              <g
                key={focus.uid}
                transform={`translate(${boxLeft(focus)} ${boxTop(focus)})`}
                onPointerDown={(e) => onFocusPointerDown(e, focus)}
                onDoubleClick={(e) => e.stopPropagation()}
                className={mode === 'select' ? 'cursor-move' : 'cursor-pointer'}
              >
                <rect
                  width={BOX_W}
                  height={BOX_H}
                  rx={8}
                  fill="#2a2a32"
                  stroke={isSource ? '#facc15' : selected ? '#f97316' : '#3f3f4e'}
                  strokeWidth={isSource || selected ? 3 : 1.5}
                />
                <foreignObject width={BOX_W} height={BOX_H}>
                  <div className="flex h-full flex-col items-center justify-center px-1 text-center">
                    <div className="mb-1 flex h-6 w-6 items-center justify-center rounded-full bg-hoi-accent/80 text-[10px] font-bold text-white">
                      {focus.cost}
                    </div>
                    <div className="line-clamp-2 text-[11px] font-semibold leading-tight text-hoi-text">
                      {focus.name || '(sin nombre)'}
                    </div>
                    <div className="w-full truncate text-[9px] text-hoi-muted">{focus.id}</div>
                  </div>
                </foreignObject>
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
