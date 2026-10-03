// Vista del árbol de una carpeta de investigación, como en la pantalla del juego: tarjetas con su
// ícono y nombre, líneas entre las conectadas y los años a un lado. Mi tecnología (borde naranja) se
// arrastra a otra casilla libre y se conecta arrastrando desde el punto de otra tecnología hasta
// ella. Las tecnologías y líneas del juego no se mueven ni se borran.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Crosshair, FlaskConical, Maximize2, Minimize2 } from 'lucide-react'
import type { Project } from '../types'
import type { Technology } from '../sections/types'
import { store, useApp } from '../store/appStore'
import {
  TREE_CELL,
  cellFree,
  connectTechs,
  disconnectTechs,
  folderName,
  treeOf,
  updateTech
} from '../sections/technologies'
import { describeGameModifier } from '../catalog/modifiers'
import GameSprite from './GameSprite'

const { w: CW, h: CH } = TREE_CELL
const PAD = 56

interface Drag {
  id: string
  cell: { x: number; y: number }
  free: boolean
}

export default function TechTree({
  project,
  tech,
  full,
  onToggleFull
}: {
  project: Project
  tech: Technology
  full: boolean
  onToggleFull: () => void
}): JSX.Element {
  const game = useApp(() => store.catalogGame())
  const { nodes, edges } = useMemo(
    () => treeOf(project, game, tech.folder, tech.uid),
    [project, game, tech.folder, tech.uid]
  )
  const box = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [drag, setDrag] = useState<Drag | null>(null)
  const [link, setLink] = useState<{ from: string; x: number; y: number } | null>(null)
  const [edgeSel, setEdgeSel] = useState<string | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const panning = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  const center = (): void => {
    const el = box.current
    if (!el) return
    setPan({
      x: el.clientWidth / 2 - (tech.x * CW + CW / 2) * zoom,
      y: el.clientHeight / 2 - (tech.y * CH + CH / 2) * zoom
    })
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(center, [tech.uid, tech.folder, full])

  const world = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const r = box.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left - pan.x) / zoom, y: (e.clientY - r.top - pan.y) / zoom }
  }
  const cellOf = (w: { x: number; y: number }): { x: number; y: number } => ({
    x: Math.round((w.x - CW / 2) / CW),
    y: Math.round((w.y - CH / 2) / CH)
  })
  const nodeAt = (e: PointerEvent | React.PointerEvent): string | null =>
    (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>(
      '[data-tech-node]'
    )?.dataset.techNode ?? null

  const pos = (n: { id: string; x: number; y: number }): { x: number; y: number } =>
    drag && drag.id === n.id ? drag.cell : n
  const byId = new Map(nodes.map((n) => [n.id, n]))
  const years = new Map<number, number>()
  for (const n of nodes)
    if (n.year !== undefined) years.set(n.year, Math.min(years.get(n.year) ?? 1e9, n.y))

  const onDown = (e: React.PointerEvent): void => {
    const t = e.target as HTMLElement
    const handle = t.closest<HTMLElement>('[data-tech-handle]')
    const nodeEl = t.closest<HTMLElement>('[data-tech-node]')
    setEdgeSel(null)
    box.current?.focus()
    if (handle) {
      const w = world(e)
      setLink({ from: handle.dataset.techHandle!, ...w })
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      return
    }
    if (nodeEl && nodeEl.dataset.techNode === tech.id) {
      setDrag({ id: tech.id, cell: { x: tech.x, y: tech.y }, free: true })
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
      return
    }
    if (!nodeEl && !t.closest('[data-tech-edge]')) {
      panning.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y }
      ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    }
  }
  const onMove = (e: React.PointerEvent): void => {
    if (panning.current) {
      const p = panning.current
      setPan({ x: p.px + e.clientX - p.x, y: p.py + e.clientY - p.y })
    } else if (drag) {
      const c = cellOf(world(e))
      setDrag({ id: drag.id, cell: c, free: cellFree(nodes, c.x, c.y, drag.id) })
    } else if (link) setLink({ ...link, ...world(e) })
  }
  const onUp = (e: React.PointerEvent): void => {
    if (panning.current) panning.current = null
    if (drag) {
      if (drag.free && (drag.cell.x !== tech.x || drag.cell.y !== tech.y))
        store.updateProject((p) => updateTech(p, tech.uid, { x: drag.cell.x, y: drag.cell.y }), {
          group: `tech:${tech.uid}:pos`
        })
      setDrag(null)
    }
    if (link) {
      const to = nodeAt(e)
      if (to && to !== link.from) {
        const r = connectTechs(project, link.from, to, game)
        if ('error' in r) store.toast(r.error)
        else store.updateProject(() => r.project)
      }
      setLink(null)
    }
  }
  const onWheel = (e: React.WheelEvent): void => {
    const z = Math.min(2.5, Math.max(0.3, zoom * (e.deltaY < 0 ? 1.1 : 0.9)))
    const r = box.current!.getBoundingClientRect()
    const mx = e.clientX - r.left
    const my = e.clientY - r.top
    setPan({ x: mx - ((mx - pan.x) / zoom) * z, y: my - ((my - pan.y) / zoom) * z })
    setZoom(z)
  }
  const onKey = (e: React.KeyboardEvent): void => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && edgeSel) {
      const [from, to] = edgeSel.split('>')
      store.updateProject((p) => disconnectTechs(p, from, to))
      setEdgeSel(null)
    }
  }

  const tip = hover ? byId.get(hover) : null
  const info = (id: string): { name: string; gfx?: string } => {
    const mine = (project.technologies ?? []).find((t) => t.id === id)
    if (mine) return { name: mine.name || 'Tecnología sin nombre' }
    const i = game?.techInfo?.[id]
    return { name: i?.name ?? id.replace(/_/g, ' '), gfx: i?.gfx }
  }
  const gameTech = tip && !tip.mine ? game?.technologies?.find((t) => t.id === tip.id) : null
  const maxX = Math.max(8, ...nodes.map((n) => n.x + 2))
  const maxY = Math.max(6, ...nodes.map((n) => n.y + 2))

  return (
    <div
      data-tech-tree
      className={`flex flex-col rounded border border-hoi-border bg-[#14181f] ${full ? 'h-full' : 'h-[420px]'}`}
    >
      <div className="flex items-center justify-between border-b border-hoi-border px-2 py-1 text-xs">
        <span className="truncate text-hoi-muted">
          {folderName(tech.folder, game) || 'Sin carpeta'}
        </span>
        <span className="flex gap-1">
          <button className="btn px-2 py-0.5" data-tree-center onClick={center}>
            <Crosshair size={12} /> Centrar en mi tecnología
          </button>
          <button className="btn px-2 py-0.5" data-tree-full onClick={onToggleFull}>
            {full ? <Minimize2 size={12} /> : <Maximize2 size={12} />}{' '}
            {full ? 'Reducir' : 'Ver en grande'}
          </button>
        </span>
      </div>
      <div
        ref={box}
        tabIndex={0}
        data-tree-view
        className="relative min-h-0 flex-1 cursor-grab overflow-hidden outline-none"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onWheel={onWheel}
        onKeyDown={onKey}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: '0 0',
            width: maxX * CW + PAD,
            height: maxY * CH + PAD
          }}
          className="absolute left-0 top-0"
        >
          {[...years.entries()].map(([y, row]) => (
            <div
              key={y}
              className="absolute -left-12 w-10 text-right text-[11px] text-hoi-muted"
              style={{ top: row * CH + CH / 2 - 8 }}
            >
              {y}
            </div>
          ))}
          <svg className="absolute left-0 top-0" width={maxX * CW + PAD} height={maxY * CH + PAD}>
            {edges.map((ed) => {
              const a = byId.get(ed.from)!
              const b = byId.get(ed.to)!
              const pa = pos(a)
              const pb = pos(b)
              const x1 = pa.x * CW + CW / 2
              const y1 = pa.y * CH + CH - 6
              const x2 = pb.x * CW + CW / 2
              const y2 = pb.y * CH + 6
              const mid = (y1 + y2) / 2
              const d = `M${x1} ${y1} V${mid} H${x2} V${y2}`
              const key = `${ed.from}>${ed.to}`
              return (
                <g key={key}>
                  <path
                    d={d}
                    fill="none"
                    stroke={edgeSel === key ? '#e8913a' : ed.mine ? '#c9a15b' : '#5a6578'}
                    strokeWidth={edgeSel === key ? 3 : 2}
                  />
                  {ed.mine && (
                    <path
                      d={d}
                      data-tech-edge={key}
                      data-edge-mine
                      fill="none"
                      stroke="transparent"
                      strokeWidth={12}
                      className="cursor-pointer"
                      style={{ pointerEvents: 'stroke' }}
                      onPointerDown={(e) => {
                        e.stopPropagation()
                        setEdgeSel(key)
                        box.current?.focus()
                      }}
                    />
                  )}
                </g>
              )
            })}
            {link && byId.get(link.from) && (
              <line
                x1={pos(byId.get(link.from)!).x * CW + CW / 2}
                y1={pos(byId.get(link.from)!).y * CH + CH - 6}
                x2={link.x}
                y2={link.y}
                stroke="#e8913a"
                strokeDasharray="4 3"
                strokeWidth={2}
              />
            )}
          </svg>
          {drag && (
            <div
              data-tech-shadow
              data-free={drag.free}
              className={`absolute rounded border-2 ${drag.free ? 'border-green-400 bg-green-400/10' : 'border-red-400 bg-red-400/10'}`}
              style={{
                left: drag.cell.x * CW + 4,
                top: drag.cell.y * CH + 4,
                width: CW - 8,
                height: CH - 8
              }}
            />
          )}
          {nodes.map((n) => {
            const p = pos(n)
            const i = info(n.id)
            return (
              <div
                key={n.id}
                data-tech-node={n.id}
                data-mine={n.mine}
                data-x={p.x}
                data-y={p.y}
                onMouseEnter={() => setHover(n.id)}
                onMouseLeave={() => setHover((h) => (h === n.id ? null : h))}
                className={`absolute flex flex-col items-center justify-center overflow-hidden rounded-sm border-2 bg-[#232b36] px-1 text-center ${
                  n.selected
                    ? 'z-10 cursor-move border-hoi-accent shadow-[0_0_8px_#e8913a88]'
                    : n.mine
                      ? 'border-[#c9a15b]/60'
                      : 'border-[#3f4858]'
                }`}
                style={{ left: p.x * CW + 4, top: p.y * CH + 4, width: CW - 8, height: CH - 8 }}
              >
                {i.gfx ? (
                  <GameSprite name={i.gfx} height={26} />
                ) : (
                  <FlaskConical size={18} className="text-hoi-muted" />
                )}
                <span className="line-clamp-2 w-full break-words text-[10px] leading-tight text-hoi-text">
                  {i.name}
                </span>
                <span
                  data-tech-handle={n.id}
                  title="Arrastra hasta otra tecnología para conectarla"
                  className="absolute bottom-0 left-1/2 h-2 w-2 -translate-x-1/2 cursor-crosshair rounded-full bg-hoi-accent/70"
                />
              </div>
            )
          })}
        </div>
        {tip && !drag && !link && (
          <div
            data-tech-tooltip
            className="pointer-events-none absolute bottom-2 left-2 z-20 w-56 rounded border border-[#5a6578] bg-[#1c222b] p-2 text-[11px] shadow-xl"
          >
            <div className="text-xs font-semibold text-hoi-text">{info(tip.id).name}</div>
            <div className="text-hoi-muted">
              {tip.year ? `Año ${tip.year}` : ''}
              {(gameTech?.cost ?? (tip.mine ? tech.cost : undefined)) !== undefined
                ? ` · costo ${gameTech?.cost ?? (tip.id === tech.id ? tech.cost : (project.technologies.find((t) => t.id === tip.id)?.cost ?? ''))}`
                : ''}
            </div>
            {gameTech?.effects?.map(([k, v]) => (
              <div key={k} className="text-hoi-text">
                {describeGameModifier(k, Number(v)) ?? `Otro efecto`}
              </div>
            ))}
            {tip.mine && <div className="text-hoi-accent">Tecnología tuya</div>}
          </div>
        )}
      </div>
    </div>
  )
}
