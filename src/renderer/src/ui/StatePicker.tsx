// "Elegir estado": mini mapa con los colores de MI mapa. No duplica nada: lee provinceIndex y la
// paleta del mapa ya cargado y dibuja solo la parte visible en un canvas 2D pequeño (sin otro
// contexto WebGL ni texturas), así que gasta unos pocos MB.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { store, useApp } from '../store/appStore'
import { PROVINCE_TYPE } from '../../../shared/map/types'
import { buildPalette } from '../map/colors'
import { effectiveCores, effectiveOwner } from '../map/mapOps'
import { treeCountry } from '../countries/countryOps'
import { fold } from '../catalog/gameIdeas'
import { flagForTag } from './FlagThumb'
import Modal from './Modal'

const W = 860
const H = 380
const SEA: [number, number, number] = [68, 107, 163]

export default function StatePicker(): JSX.Element | null {
  const req = useApp((s) => s.statePicker)
  const prov = req?.mode === 'province'
  const map = useApp((s) => s.map)
  const loading = useApp((s) => s.mapLoading)
  const project = useApp((s) => s.project)
  const game = useApp(() => store.catalogGame())
  const recents = useApp((s) => s.recentStates)
  const activeTree = useApp((s) => s.activeTreeId)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [view, setView] = useState({ x: 0, y: 0, z: 1 })
  const [hover, setHover] = useState<number | null>(null)
  const [mouse, setMouse] = useState({ x: 0, y: 0 })
  const [sel, setSel] = useState<number | null>(null)
  const [query, setQuery] = useState('')
  const [onlyTree, setOnlyTree] = useState(false)
  const drag = useRef<{ sx: number; sy: number; vx: number; vy: number; moved: boolean } | null>(
    null
  )

  const posById = useMemo(() => new Map((map?.states ?? []).map((s, i) => [s.id, i])), [map])
  const palette = useMemo(
    () =>
      map && req
        ? buildPalette(map, project, game, {
            mode: 'politico',
            activeTag: null,
            selectedId: null,
            gameColors: false,
            blankUnpainted: project?.mapSettings?.base === 'blank',
            highlightPending: false
          })
        : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, project, req]
  )
  const treeTag = project ? treeCountry(project, activeTree)?.tag : undefined
  const restrict = req?.onlyOwner ?? (onlyTree ? (treeTag ?? null) : null)
  const allowed = useCallback(
    (id: number): boolean => {
      if (!map) return false
      // Provincia: solo de tierra (y, si se pide, de un estado del país)
      const st = prov
        ? map.provinceType[id] === PROVINCE_TYPE.land
          ? map.provinceToState[id]
          : 0
        : id
      if (prov && !st) return false
      if (!restrict || !project) return true
      const s = map.states[posById.get(st) ?? -1]
      return !!s && effectiveOwner(s, project) === restrict
    },
    [restrict, map, project, posById, prov]
  )

  // Al abrir: estado actual seleccionado y centrado; si no, el mapa entero
  useEffect(() => {
    if (!req || !map) return
    setQuery('')
    setOnlyTree(false)
    const curState = req.current ? (prov ? map.provinceToState[req.current] : req.current) : 0
    setSel(req.current && (prov ? curState > 0 : posById.has(req.current)) ? req.current : null)
    const c = curState ? map.stateCenters[curState] : null
    if (c) setView({ x: c[0], y: c[1], z: Math.min(W / map.width, H / map.height) * 6 })
    else
      setView({
        x: map.width / 2,
        y: map.height / 2,
        z: Math.min(W / map.width, H / map.height)
      })
  }, [req, map, posById, prov])

  const stateAt = useCallback(
    (px: number, py: number): number => {
      if (!map) return 0
      const mx = Math.floor(view.x + (px - W / 2) / view.z)
      const my = Math.floor(view.y + (py - H / 2) / view.z)
      if (mx < 0 || my < 0 || mx >= map.width || my >= map.height) return 0
      const pid = map.provinceIndex[my * map.width + mx]
      return prov ? pid : map.provinceToState[pid]
    },
    [map, view, prov]
  )

  // Dibujo: solo los píxeles visibles, muestreando provinceIndex (sin copiar nada)
  useEffect(() => {
    const cv = canvasRef.current
    if (!cv || !map || !palette || !req) return
    const ctx = cv.getContext('2d')!
    const img = ctx.createImageData(W, H)
    const px32 = new Uint32Array(img.data.buffer)
    const { provinceIndex, provinceToState, width, height } = map
    const cols = new Int32Array(W)
    for (let x = 0; x < W; x++) cols[x] = Math.floor(view.x + (x - W / 2) / view.z)
    const pack = (r: number, g: number, b: number): number => (255 << 24) | (b << 16) | (g << 8) | r
    const seaC = pack(...SEA)
    const rowState = new Int32Array(W)
    let prevRow = new Int32Array(W)
    for (let y = 0; y < H; y++) {
      const my = Math.floor(view.y + (y - H / 2) / view.z)
      for (let x = 0; x < W; x++) {
        const mx = cols[x]
        rowState[x] =
          mx < 0 || my < 0 || mx >= width || my >= height
            ? -1
            : prov
              ? provinceIndex[my * width + mx]
              : provinceToState[provinceIndex[my * width + mx]]
      }
      for (let x = 0; x < W; x++) {
        const st = rowState[x]
        let c: number
        const stId = st > 0 && prov ? provinceToState[st] : st
        if (stId <= 0) c = st < 0 ? pack(24, 24, 28) : seaC
        else {
          const p = (posById.get(stId) ?? 0) * 4
          let r = palette.rgba[p]
          let g = palette.rgba[p + 1]
          let b = palette.rgba[p + 2]
          if (!allowed(st)) ((r = (r + 120) >> 1), (g = (g + 120) >> 1), (b = (b + 120) >> 1))
          if (st === hover)
            ((r = Math.min(255, r + 45)), (g = Math.min(255, g + 45)), (b = Math.min(255, b + 45)))
          // Bordes de estado (vecino de la derecha o de arriba distinto) y contorno azul del elegido
          const edge = (x + 1 < W && rowState[x + 1] !== st) || (y > 0 && prevRow[x] !== st)
          if (st === sel && edge) ((r = 40), (g = 120), (b = 255))
          else if (edge) ((r = r * 0.55), (g = g * 0.55), (b = b * 0.55))
          c = pack(r | 0, g | 0, b | 0)
        }
        px32[y * W + x] = c
      }
      prevRow = Int32Array.from(rowState)
    }
    ctx.putImageData(img, 0, 0)
  }, [map, palette, view, hover, sel, allowed, req, posById, prov])

  const results = useMemo(() => {
    const q = fold(query.trim())
    if (!q || !map) return []
    return map.states
      .filter((s) => String(s.id) === q || fold(s.name).includes(q) || fold(s.nameKey).includes(q))
      .slice(0, 8)
  }, [query, map])
  if (!req) return null
  const close = (id: number | null): void => {
    store.set({ statePicker: null })
    req.resolve(id)
  }
  const stateOf = (
    id: number | null
  ): (typeof map extends null ? never : NonNullable<typeof map>['states'][number]) | undefined =>
    id && map ? map.states[posById.get(id) ?? -1] : undefined
  const label = (id: number): string => {
    if (prov) {
      const st = map ? stateOf(map.provinceToState[id]) : undefined
      return map && map.provinceType[id] === PROVINCE_TYPE.land
        ? `Provincia ${id}${st ? ` · ${st.name} #${st.id}` : ''}${map.provinceCoastal[id] ? ' (costera)' : ''}`
        : `La provincia ${id} no es de tierra`
    }
    const s = stateOf(id)
    return s && project
      ? `${s.name} (${effectiveOwner(s, project) || '—'}) · ${id}`
      : `Estado ${id} (no existe)`
  }
  const center = (id: number): void => {
    const c = map?.stateCenters[prov ? map.provinceToState[id] : id]
    if (c) setView((v) => ({ x: c[0], y: c[1], z: Math.max(v.z, 2) }))
  }
  const pick = (id: number): void => {
    setSel(id)
    center(id)
  }
  const hs = stateOf(prov && hover && map ? map.provinceToState[hover] : hover)

  return (
    <Modal
      title={prov ? 'Elegir provincia' : 'Elegir estado'}
      width={900}
      onClose={() => close(null)}
      footer={
        <>
          <span className="mr-auto truncate text-sm" data-state-selected>
            {sel ? label(sel) : prov ? 'Ninguna provincia elegida' : 'Ningún estado elegido'}
          </span>
          <button
            className="btn"
            onClick={() =>
              store.openPrompt({
                message: prov ? 'Número de la provincia:' : 'Número del estado:',
                defaultValue: sel ? String(sel) : '',
                validate: (t) =>
                  /^[1-9]\d*$/.test(t)
                    ? null
                    : 'El ID de estado es un número entero mayor o igual a 1',
                callback: (t) => t && close(Number(t))
              })
            }
          >
            Escribir número…
          </button>
          <button className="btn" onClick={() => close(null)}>
            Cancelar
          </button>
          <button
            className="btn-primary disabled:opacity-40"
            disabled={!sel || !allowed(sel)}
            onClick={() => sel && close(sel)}
          >
            {prov ? 'Usar esta provincia' : 'Usar este estado'}
          </button>
        </>
      }
    >
      {!map ? (
        <p className="py-10 text-center text-sm text-hoi-muted">
          Cargando el mapa… {loading ? `${Math.round(loading.pct)} % · ${loading.message}` : ''}
        </p>
      ) : (
        <div
          onKeyDown={(e) => {
            if (e.key === 'Enter' && sel && allowed(sel)) (e.preventDefault(), close(sel))
          }}
        >
          <div className="mb-2 flex flex-wrap items-center gap-2">
            {prov && (
              <span className="text-xs text-hoi-muted">
                Haz clic en una provincia de tierra (se ven sus bordes).
              </span>
            )}
            {!prov && (
              <input
                autoFocus
                className="input w-64"
                placeholder="Buscar por nombre o ID…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && results[0])
                    (e.preventDefault(), e.stopPropagation(), pick(results[0].id))
                }}
              />
            )}
            {!prov && treeTag && !req.onlyOwner && (
              <label className="flex items-center gap-1 text-xs">
                <input
                  type="checkbox"
                  checked={onlyTree}
                  onChange={(e) => setOnlyTree(e.target.checked)}
                />
                Solo estados de {treeTag}
              </label>
            )}
            {req.onlyOwner && (
              <span className="text-xs text-yellow-300">Solo estados de {req.onlyOwner}</span>
            )}
            {!prov && recents.length > 0 && (
              <span className="flex flex-wrap items-center gap-1 text-xs">
                Recientes:
                {recents.map((id) => (
                  <button
                    key={id}
                    className="btn px-1.5 py-0.5 text-[11px]"
                    onClick={() => pick(id)}
                  >
                    {stateOf(id)?.name ?? 'Estado'} · {id}
                  </button>
                ))}
              </span>
            )}
          </div>
          {results.length > 0 && (
            <ul className="mb-2 max-h-24 overflow-y-auto rounded border border-hoi-border text-xs">
              {results.map((s) => (
                <li
                  key={s.id}
                  className="cursor-pointer px-2 py-0.5 hover:bg-hoi-card"
                  onClick={() => pick(s.id)}
                >
                  {s.name} · {s.id}
                </li>
              ))}
            </ul>
          )}
          <div className="relative" style={{ width: W, height: H }}>
            <canvas
              ref={canvasRef}
              data-state-map
              width={W}
              height={H}
              className="rounded border border-hoi-border"
              style={{ cursor: drag.current?.moved ? 'grabbing' : 'pointer' }}
              onWheel={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                const px = e.clientX - r.left
                const py = e.clientY - r.top
                setView((v) => {
                  const z = Math.min(40, Math.max(0.05, v.z * (e.deltaY < 0 ? 1.2 : 1 / 1.2)))
                  // El punto bajo el mouse se queda donde está
                  return {
                    z,
                    x: v.x + (px - W / 2) / v.z - (px - W / 2) / z,
                    y: v.y + (py - H / 2) / v.z - (py - H / 2) / z
                  }
                })
              }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId)
                drag.current = {
                  sx: e.clientX,
                  sy: e.clientY,
                  vx: view.x,
                  vy: view.y,
                  moved: false
                }
              }}
              onPointerMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                const px = e.clientX - r.left
                const py = e.clientY - r.top
                const d = drag.current
                if (d && (d.moved || Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 4)) {
                  d.moved = true
                  setView((v) => ({
                    ...v,
                    x: d.vx - (e.clientX - d.sx) / v.z,
                    y: d.vy - (e.clientY - d.sy) / v.z
                  }))
                  return
                }
                const st = stateAt(px, py)
                setHover(st > 0 ? st : null)
                setMouse({ x: px, y: py })
              }}
              onPointerUp={(e) => {
                const d = drag.current
                drag.current = null
                if (d?.moved) return
                const r = e.currentTarget.getBoundingClientRect()
                const st = stateAt(e.clientX - r.left, e.clientY - r.top)
                if (st > 0 && allowed(st)) setSel(st)
              }}
              onPointerLeave={() => setHover(null)}
              onDoubleClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                const st = stateAt(e.clientX - r.left, e.clientY - r.top)
                if (st > 0 && allowed(st)) close(st)
              }}
            />
            {hs && project && (
              <div
                data-state-tooltip
                className="pointer-events-none absolute z-10 rounded border border-hoi-border bg-hoi-panel/95 px-2 py-1 text-xs shadow"
                style={{
                  left: Math.min(mouse.x + 14, W - 200),
                  top: Math.min(mouse.y + 14, H - 70)
                }}
              >
                <div className="font-semibold">{hs.name}</div>
                <div className="font-mono text-hoi-muted">
                  #{hs.id}
                  {prov && hover ? ` · provincia ${hover}` : ''}
                </div>
                <div className="flex items-center gap-1">
                  {effectiveOwner(hs, project) && (
                    <img
                      src={flagForTag(
                        effectiveOwner(hs, project),
                        project.countries.find((c) => c.tag === effectiveOwner(hs, project))
                      )}
                      alt=""
                      width={20}
                      height={13}
                    />
                  )}
                  {effectiveOwner(hs, project) || 'sin dueño'}
                </div>
                <div className="text-hoi-muted">
                  cores: {effectiveCores(hs, project).join(', ') || '—'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  )
}
