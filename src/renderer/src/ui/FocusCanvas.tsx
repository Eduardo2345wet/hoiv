// Lienzo del árbol de focos: cuadrícula con zoom, desplazamiento,
// arrastre de focos (se ajustan a la cuadrícula) y conexión de líneas.
import { useEffect, useRef, useState } from 'react'
import type { Focus, Project } from '../types'
import { store, useApp } from '../store/appStore'
import IconThumb from './IconThumb'
import { dropInfo } from '../focus/layout'
import { routeEdge } from '../focus/routes'

// Tamaño de una casilla: x e y son columnas y filas ENTERAS. La proporción sale de focus_spacing
// de interface/nationalfocusview.gui (si hay carpeta del juego); si no, estas constantes.
// por verificar: el valor real de focus_spacing de HOI4 1.19.3
export const DEFAULT_SPACING = { x: 120, y: 140 }
const CELL_H = 140
const NODE_H = 96
const ANIM_MS = 200

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
  /** Suelta uno o varios focos en una casilla (un solo paso de deshacer) */
  onPlace: (
    uid: string,
    gx: number,
    gy: number,
    opts: { branch?: boolean; also?: string[] }
  ) => void
  onTogglePin: (uid: string) => void
  /** true durante ~200 ms tras ordenar: los focos se deslizan a su casilla */
  animate?: boolean
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

export default function FocusCanvas(props: Props): JSX.Element {
  const { focuses, selected, tool } = props
  const game = useApp(() => store.catalogGame())
  const sp = game?.focusGrid?.spacing ?? DEFAULT_SPACING
  const CELL_W = Math.max(90, Math.min(170, Math.round((CELL_H * sp.x) / sp.y)))
  const NODE_W = Math.min(104, CELL_W - 12)
  const cx = (x: number): number => x * CELL_W + CELL_W / 2
  const cy = (y: number): number => y * CELL_H + CELL_H / 2
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
  // Selección múltiple (Shift+clic o recuadro) y arrastre de focos con sombra de destino
  const [multi, setMulti] = useState<Set<string>>(new Set())
  const [dragging, setDragging] = useState<{
    uid: string
    moved: string[]
    dx: number
    dy: number
    gx: number
    gy: number
    valid: boolean
    swapWith: string | null
  } | null>(null)
  const [box, setBox] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null)
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
    | {
        kind: 'node'
        uid: string
        offX: number
        offY: number
        sx: number
        sy: number
        moved: boolean
        opts: { branch?: boolean; also?: string[] }
      }
    | { kind: 'box'; sx: number; sy: number }
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
    if (e.button === 0 && e.shiftKey) {
      // Shift + arrastrar el fondo: recuadro de selección
      const w = toWorld(e.clientX, e.clientY)
      drag.current = { kind: 'box', sx: w.x, sy: w.y }
      setBox({ x1: w.x, y1: w.y, x2: w.x, y2: w.y })
      return
    }
    if (e.button === 0) {
      setSelLine(null)
      setMulti(new Set())
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
    if (e.shiftKey) {
      // Shift+clic: suma o quita de la selección múltiple
      setMulti((m) => {
        const n = new Set(m.size ? m : selected ? [selected] : [])
        if (n.has(f.uid)) n.delete(f.uid)
        else n.add(f.uid)
        return n
      })
      props.onSelect(f.uid)
      return
    }
    const inMulti = multi.has(f.uid) && multi.size > 1
    if (!inMulti) {
      setMulti(new Set())
      props.onSelect(f.uid)
    }
    const w = toWorld(e.clientX, e.clientY)
    ;(e.currentTarget as Element).setPointerCapture(e.pointerId)
    drag.current = {
      kind: 'node',
      uid: f.uid,
      offX: w.x - cx(f.x),
      offY: w.y - cy(f.y),
      sx: e.clientX,
      sy: e.clientY,
      moved: false,
      // Alt = solo ese foco; con varios seleccionados se mueven esos; si no, su rama
      opts: inMulti ? { also: [...multi].filter((u) => u !== f.uid) } : { branch: !e.altKey }
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
    } else if (d.kind === 'box') {
      const w = toWorld(e.clientX, e.clientY)
      setBox({ x1: d.sx, y1: d.sy, x2: w.x, y2: w.y })
    } else {
      if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 4) return
      d.moved = true
      const w = toWorld(e.clientX, e.clientY)
      // Casilla destino (la sombra); el foco sigue al mouse mientras tanto
      const gx = Math.max(0, Math.round((w.x - d.offX - CELL_W / 2) / CELL_W))
      const gy = Math.max(0, Math.round((w.y - d.offY - CELL_H / 2) / CELL_H))
      const info = dropInfo(props.project, d.uid, gx, gy, d.opts)
      const f = focuses.find((x) => x.uid === d.uid)!
      setDragging({
        uid: d.uid,
        moved: info.moved,
        dx: w.x - d.offX - cx(f.x),
        dy: w.y - d.offY - cy(f.y),
        gx: info.cell.x,
        gy: info.cell.y,
        valid: info.valid,
        swapWith: info.swapWith
      })
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
  const occupied = new Set(focuses.map((f) => `${f.x},${f.y}`))
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
        if (d?.kind === 'node' && d.moved && dragging)
          props.onPlace(d.uid, dragging.gx, dragging.gy, d.opts)
        if (d?.kind === 'node') setDragging(null)
        if (d?.kind === 'box' && box) {
          const [x1, x2] = [Math.min(box.x1, box.x2), Math.max(box.x1, box.x2)]
          const [y1, y2] = [Math.min(box.y1, box.y2), Math.max(box.y1, box.y2)]
          const inside = focuses
            .filter(
              (f) =>
                cx(f.x) + NODE_W / 2 >= x1 &&
                cx(f.x) - NODE_W / 2 <= x2 &&
                cy(f.y) + NODE_H / 2 >= y1 &&
                cy(f.y) - NODE_H / 2 <= y2
            )
            .map((f) => f.uid)
          setMulti(new Set(inside))
          if (inside.length) props.onSelect(inside[0])
          setBox(null)
        }
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
              const pts = routeEdge(parent, child, occupied, {
                cellW: CELL_W,
                cellH: CELL_H,
                nodeH: NODE_H
              })
              const d = pts.map((q, i) => `${i ? 'L' : 'M'} ${q[0]} ${q[1]}`).join(' ')
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
          {exclusivePairs.map(([a, b]) => {
            // Línea roja horizontal con ✕ en medio (junto al borde de cada foco)
            const [l, r] = a.x <= b.x ? [a, b] : [b, a]
            const same = l.y === r.y
            const x1 = same ? cx(l.x) + NODE_W / 2 : cx(l.x)
            const x2 = same ? cx(r.x) - NODE_W / 2 : cx(r.x)
            const y1 = cy(l.y)
            const y2 = cy(r.y)
            const sel = selLine?.kind === 'excl' && selLine.a === a.uid && selLine.b === b.uid
            const color = sel ? '#f97316' : '#ef4444'
            return (
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
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={12} />
                <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={3} />
                <text
                  x={(x1 + x2) / 2}
                  y={(y1 + y2) / 2 + 6}
                  textAnchor="middle"
                  fontSize={18}
                  fontWeight="bold"
                  fill={color}
                  stroke="#141417"
                  strokeWidth={4}
                  paintOrder="stroke"
                >
                  ✕
                </text>
              </g>
            )
          })}
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

        {/* Sombra de la casilla destino al arrastrar (roja = fila no válida) */}
        {dragging && (
          <div
            data-shadow={dragging.valid ? 'ok' : 'bad'}
            className={`pointer-events-none absolute rounded-md border-2 border-dashed ${
              dragging.valid ? 'border-green-400 bg-green-400/10' : 'border-red-500 bg-red-500/20'
            }`}
            style={{
              left: cx(dragging.gx) - NODE_W / 2,
              top: cy(dragging.gy) - NODE_H / 2,
              width: NODE_W,
              height: NODE_H
            }}
          />
        )}
        {box && (
          <div
            className="pointer-events-none absolute border border-sky-400 bg-sky-400/10"
            style={{
              left: Math.min(box.x1, box.x2),
              top: Math.min(box.y1, box.y2),
              width: Math.abs(box.x2 - box.x1),
              height: Math.abs(box.y2 - box.y1)
            }}
          />
        )}

        {/* Cajas de los focos */}
        {focuses.map((f) => {
          const isSel = f.uid === selected
          const isLink = f.uid === linkFrom
          const excluded = !!pick?.exclude.includes(f.uid)
          const pickHover = !!pick && !excluded && hover === f.uid
          const isFrom = linkFrom === f.uid
          const isGhostTarget = ghost?.target === f.uid
          const inMulti = multi.has(f.uid)
          const border =
            inMulti && !pick
              ? 'border-sky-400'
              : isGhostTarget
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
                left: cx(f.x) - NODE_W / 2 + (dragging?.moved.includes(f.uid) ? dragging.dx : 0),
                top: cy(f.y) - NODE_H / 2 + (dragging?.moved.includes(f.uid) ? dragging.dy : 0),
                zIndex: dragging?.moved.includes(f.uid) ? 20 : undefined,
                transition:
                  props.animate && !dragging ? `left ${ANIM_MS}ms, top ${ANIM_MS}ms` : undefined,
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
              {(f.pinned || hover === f.uid) && !pick && (
                <button
                  data-pin={f.pinned ? 'on' : 'off'}
                  title={
                    f.pinned ? 'Fijado: Ordenar no lo mueve (clic para soltarlo)' : 'Fijar posición'
                  }
                  className={`absolute left-0.5 top-0.5 text-[11px] leading-none ${f.pinned ? '' : 'opacity-50'}`}
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    props.onTogglePin(f.uid)
                  }}
                >
                  📌
                </button>
              )}
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
