// Paleta de países tipo Paint: clic en una muestra = ese país es el pincel.
// Secciones: Mis países (1–9), Sin nación (si aplica), Países del juego (plegable, con
// buscador, solo los que existen en la base, por número de estados) y Recientes.
import { useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight, MoreHorizontal, Plus } from 'lucide-react'
import type { Project } from '../../types'
import { store, useApp } from '../../store/appStore'
import { countryDrawColor } from '../../map/colors'
import { countryLabel, NO_NATION, setBrush } from '../../map/brush'
import { createQuickCountry } from '../../map/quickCountry'
import { addCountry, colorForTag, newCountry } from '../../countries/countryOps'
import { suggestTag } from '../../countries/tags'
import { fromHex, toHex } from '../../countries/color'
import { validateTag } from '../../export/validator'
import { getCatalogOptions } from '../../catalog/catalog'
import { flagForTag } from '../FlagThumb'
import { countrySections, matchChoice, type CountryChoice } from '../../countries/choices'

interface Props {
  project: Project
  gameColors: boolean
  onOpenWizard: (countryUid?: string, step?: number) => void
  /** Dentro del Navegador del proyecto: sin borde, ancho ni botón de plegar */
  embedded?: boolean
}

export default function PalettePanel({
  project,
  gameColors,
  onOpenWizard,
  embedded
}: Props): JSX.Element {
  const map = useApp((s) => s.map)
  const activeTag = useApp((s) => s.activeTag)
  const recent = useApp((s) => s.recentTags)
  useApp((s) => s.gameFlags) // las banderas reales llegan después
  const game = useApp(() => store.catalogGame())
  const [collapsed, setCollapsed] = useState(false)
  const [showGame, setShowGame] = useState(false)
  const [query, setQuery] = useState('')
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [quick, setQuick] = useState<{
    name: string
    color: string
    tag: string
    tagTouched: boolean
  } | null>(null)
  const [lastQuickUid, setLastQuickUid] = useState<string | null>(null)

  const mine = project.countries.filter((c) => !c.technical && !c.light)
  const noNation =
    project.mapSettings.unpainted === 'noNation' && project.mapSettings.base === 'blank'

  // Mismas secciones y conteos que el CountryPicker (conteos de ESTE mapa, vía effectiveOwner)
  const sec = useMemo(() => countrySections(project, map, game), [project, map, game])
  const f = (l: CountryChoice[]): CountryChoice[] => l.filter((c) => matchChoice(c, query))
  const mineF = f(sec.mine)
  const onMapF = f(sec.onMap)
  const allF = f(sec.game)

  const flagOf = (tag: string): string => {
    const c = project.countries.find((x) => x.tag === tag)
    return flagForTag(tag, c)
  }

  const swatch = (
    tag: string,
    extra?: { key?: string; count?: number | null; menu?: boolean }
  ): JSX.Element => {
    const color = toHex(countryDrawColor(tag, project, game, gameColors))
    const active = activeTag === tag
    return (
      <div key={tag} className="relative">
        <button
          onClick={() => setBrush(tag)}
          title={`Pintar con ${countryLabel(tag, project, game)} (${tag})${extra?.key ? ` · tecla ${extra.key}` : ''}`}
          className={`flex w-full items-center gap-2 rounded-md border-2 p-1 text-left ${
            active
              ? 'border-amber-400 bg-amber-400/10'
              : 'border-transparent hover:border-hoi-border'
          }`}
        >
          <span
            className="h-8 w-8 shrink-0 rounded ring-1 ring-black/40"
            style={{ background: color }}
          />
          <img
            src={flagOf(tag)}
            alt=""
            className="h-4 w-[25px] shrink-0 rounded-sm ring-1 ring-black/40"
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-xs">{countryLabel(tag, project, game)}</span>
            <span className="font-mono text-[10px] text-hoi-muted">
              {tag}
              {extra?.count !== undefined && ` · ${extra.count ?? '—'}`}
            </span>
          </span>
          {extra?.key && (
            <kbd className="rounded bg-hoi-bg px-1 text-[10px] text-hoi-muted">{extra.key}</kbd>
          )}
        </button>
        {extra?.menu && (
          <button
            className="absolute right-1 top-1 rounded p-0.5 text-hoi-muted hover:bg-hoi-card hover:text-white"
            title="Más opciones"
            onClick={() => setMenuFor(menuFor === tag ? null : tag)}
          >
            <MoreHorizontal size={14} />
          </button>
        )}
        {menuFor === tag && (
          <div className="absolute right-1 top-7 z-20 w-44 rounded border border-hoi-border bg-hoi-panel p-1 text-xs shadow-xl">
            <button
              className="w-full rounded px-2 py-1 text-left hover:bg-hoi-card"
              onClick={() => {
                // Recién aquí se agrega al proyecto como país "existente"
                setMenuFor(null)
                let uid = project.countries.find((c) => c.tag === tag)?.uid
                if (!uid) {
                  const c = newCountry({
                    mode: 'existente',
                    tag,
                    name: countryLabel(tag, project, game)
                  })
                  uid = c.uid
                  store.updateProject((p) => addCountry(p, c))
                }
                onOpenWizard(uid)
              }}
            >
              Editar este país…
            </button>
          </div>
        )}
      </div>
    )
  }

  // ---- País rápido ----
  const taken = (): string[] => [
    ...getCatalogOptions('country', project, game).map((o) => o.id),
    ...sec.onMap.map((c) => c.tag)
  ]
  const startQuick = (): void => {
    const tag = suggestTag('Nuevo', taken())
    setQuick({ name: '', color: toHex(colorForTag(tag)), tag, tagTouched: false })
  }
  const quickError = quick
    ? !quick.name.trim()
      ? 'Escribe un nombre'
      : (validateTag(quick.tag) ??
        (taken().includes(quick.tag) ? `El tag ${quick.tag} ya existe` : null))
    : null
  const createQuick = (): void => {
    if (!quick || quickError) return
    const c = createQuickCountry(quick.name.trim(), quick.tag, fromHex(quick.color))
    setLastQuickUid(c.uid)
    setQuick(null)
    store.toast(`País creado: ${c.names.name} (${c.tag}) · ya puedes pintar`, { undo: true })
  }

  if (collapsed && !embedded)
    return (
      <div className="flex w-8 flex-col items-center border-r border-hoi-border bg-hoi-panel py-2">
        <button title="Mostrar la paleta" onClick={() => setCollapsed(false)}>
          <ChevronRight size={16} />
        </button>
        <span className="mt-4 rotate-180 text-xs text-hoi-muted [writing-mode:vertical-rl]">
          Paleta
        </span>
      </div>
    )

  return (
    <div
      className={
        embedded
          ? 'flex min-h-0 flex-1 flex-col'
          : 'flex w-60 shrink-0 flex-col border-r border-hoi-border bg-hoi-panel'
      }
    >
      <div
        className={`flex items-center justify-between border-b border-hoi-border px-3 py-2 ${embedded ? 'hidden' : ''}`}
      >
        <span className="text-sm font-semibold text-hoi-accent">Paleta</span>
        <button title="Plegar la paleta" onClick={() => setCollapsed(true)}>
          <ChevronLeft size={16} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <input
          className="input mb-2 text-xs"
          placeholder="Buscar país (nombre o tag)…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {/* Mis países */}
        <div className="mb-1 text-[11px] uppercase tracking-wide text-hoi-muted">Mis países</div>
        <div className="flex flex-col gap-0.5">
          {mineF.map((c) =>
            swatch(c.tag, {
              count: c.states,
              key: sec.mine.indexOf(c) < 9 ? String(sec.mine.indexOf(c) + 1) : undefined
            })
          )}
          {!mine.length && (
            <p className="px-1 text-xs text-hoi-muted">Todavía no hay países en tu mod.</p>
          )}
        </div>

        {/* En el mapa: solo países con estados en ESTE mapa */}
        <div className="mb-1 mt-3 text-[11px] uppercase tracking-wide text-hoi-muted">
          En el mapa ({sec.onMap.length})
        </div>
        <div className="flex flex-col gap-0.5">
          {onMapF.map((c) => swatch(c.tag, { count: c.states, menu: true }))}
          {!sec.onMap.length && (
            <p className="px-1 text-xs text-hoi-muted">
              Todavía no hay países en tu mapa. Pinta estados o elige uno de la lista de abajo.
            </p>
          )}
        </div>

        {quick ? (
          <div
            className="mt-2 flex flex-col gap-1 rounded border border-hoi-border bg-hoi-bg p-2"
            onKeyDown={(e) => e.key === 'Enter' && createQuick()}
          >
            <input
              className="input text-xs"
              autoFocus
              placeholder="Nombre del país"
              value={quick.name}
              onChange={(e) => {
                const name = e.target.value
                const tag = quick.tagTouched || !name.trim() ? quick.tag : suggestTag(name, taken())
                setQuick({
                  ...quick,
                  name,
                  tag,
                  color: quick.tagTouched ? quick.color : toHex(colorForTag(tag))
                })
              }}
            />
            <div className="flex items-center gap-1">
              <input
                type="color"
                className="h-7 w-9 cursor-pointer rounded border border-hoi-border bg-transparent"
                value={quick.color}
                onChange={(e) => setQuick({ ...quick, color: e.target.value, tagTouched: true })}
              />
              <input
                className="input w-16 font-mono text-xs uppercase"
                maxLength={3}
                value={quick.tag}
                title="Tag (propuesto automáticamente)"
                onChange={(e) =>
                  setQuick({ ...quick, tag: e.target.value.toUpperCase(), tagTouched: true })
                }
              />
              <button
                className="btn-primary flex-1 justify-center px-2 py-1 text-xs disabled:opacity-40"
                disabled={!!quickError}
                onClick={createQuick}
              >
                Crear
              </button>
            </div>
            {quickError && quick.name && <p className="text-[10px] text-red-400">{quickError}</p>}
            <button className="text-[10px] text-hoi-muted underline" onClick={() => setQuick(null)}>
              cancelar
            </button>
          </div>
        ) : (
          <button className="btn mt-2 w-full justify-center text-xs" onClick={startQuick}>
            <Plus size={12} /> País rápido
          </button>
        )}
        {lastQuickUid && project.countries.some((c) => c.uid === lastQuickUid) && !quick && (
          <button
            className="mt-1 w-full text-center text-[11px] text-hoi-accent underline"
            onClick={() => onOpenWizard(lastQuickUid)}
          >
            Completar país… (bandera, líder, política)
          </button>
        )}

        {/* Sin nación (modo de relleno técnico) */}
        {noNation && (
          <>
            <div className="mb-1 mt-3 text-[11px] uppercase tracking-wide text-hoi-muted">
              Pendiente
            </div>
            <button
              onClick={() => setBrush(NO_NATION)}
              title="Devuelve estados a pendiente (igual que el clic derecho)"
              className={`flex w-full items-center gap-2 rounded-md border-2 p-1 text-left ${
                activeTag === NO_NATION
                  ? 'border-amber-400 bg-amber-400/10'
                  : 'border-transparent hover:border-hoi-border'
              }`}
            >
              <span className="h-8 w-8 shrink-0 rounded bg-white ring-1 ring-black/40" />
              <span className="text-xs">
                {project.mapSettings.noNation.name || 'Sin nación'}
                <span className="block text-[10px] text-hoi-muted">vuelve a pendiente</span>
              </span>
            </button>
          </>
        )}

        {/* Recientes */}
        {recent.length > 0 && (
          <>
            <div className="mb-1 mt-3 text-[11px] uppercase tracking-wide text-hoi-muted">
              Recientes
            </div>
            <div className="flex flex-wrap gap-1">
              {recent.map((t) => (
                <button
                  key={t}
                  onClick={() => setBrush(t)}
                  title={`${countryLabel(t, project, game)} (${t})`}
                  className={`h-7 w-7 rounded ring-1 ring-black/40 ${activeTag === t ? 'outline outline-2 outline-amber-400' : ''}`}
                  style={{ background: toHex(countryDrawColor(t, project, game, gameColors)) }}
                />
              ))}
            </div>
          </>
        )}

        {/* Todos los países del juego (con buscador arriba) */}
        <button
          className="mb-1 mt-3 flex w-full items-center gap-1 text-[11px] uppercase tracking-wide text-hoi-muted"
          onClick={() => setShowGame(!showGame)}
        >
          {showGame || query ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Todos los países del juego ({sec.game.length})
        </button>
        {(showGame || query) && (
          <div className="flex flex-col gap-0.5">
            {allF
              .slice(0, 150)
              .map((c) => swatch(c.tag, { count: c.states > 0 ? c.states : null, menu: true }))}
            {allF.length > 150 && (
              <p className="px-1 text-[10px] text-hoi-muted">
                … y {allF.length - 150} más (usa el buscador)
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
