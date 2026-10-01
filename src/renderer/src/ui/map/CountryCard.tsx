// Tarjeta flotante del pincel activo (arriba a la izquierda del mapa)
import { useMemo } from 'react'
import { Plus, X } from 'lucide-react'
import { IDEOLOGY_LABELS, type Project } from '../../types'
import { store, useApp } from '../../store/appStore'
import { countryStates } from '../../map/mapOps'
import { countryLabel, NO_NATION, setBrush } from '../../map/brush'
import { toHex } from '../../countries/color'
import { countryDrawColor } from '../../map/colors'
import { flagForTag } from '../FlagThumb'

interface Props {
  project: Project
  gameColors: boolean
  onOpenWizard: (countryUid?: string, step?: number) => void
}

export default function CountryCard({ project, gameColors, onOpenWizard }: Props): JSX.Element {
  const map = useApp((s) => s.map)
  const activeTag = useApp((s) => s.activeTag)
  useApp((s) => s.gameFlags)
  const game = useApp(() => store.catalogGame())
  const country = project.countries.find((c) => c.tag === activeTag)
  const states = useMemo(
    () =>
      map && activeTag && activeTag !== NO_NATION ? countryStates(project, map, activeTag) : [],
    [map, project, activeTag]
  )

  if (!activeTag)
    return (
      <div className="w-64 rounded-lg border border-hoi-border bg-hoi-panel/95 p-3 shadow-xl">
        <div className="text-sm">Ningún país seleccionado</div>
        <p className="mb-2 text-xs text-hoi-muted">
          Elige un color en la Paleta (izquierda) o usa las teclas 1–9.
        </p>
        <button className="btn w-full justify-center text-xs" onClick={() => onOpenWizard()}>
          <Plus size={12} /> Crear país con el asistente
        </button>
      </div>
    )

  if (activeTag === NO_NATION)
    return (
      <div className="flex w-64 items-center gap-3 rounded-lg border border-amber-500/70 bg-hoi-panel/95 p-3 shadow-xl">
        <span className="h-10 w-10 rounded bg-white ring-1 ring-black/40" />
        <div className="flex-1 text-sm">
          {project.mapSettings.noNation.name || 'Sin nación'}
          <div className="text-xs text-hoi-muted">Devuelve estados a pendiente</div>
        </div>
        <button
          className="text-hoi-muted hover:text-white"
          title="Soltar el pincel"
          onClick={() => setBrush(null)}
        >
          <X size={16} />
        </button>
      </div>
    )

  const flag = flagForTag(activeTag, country)
  const capital = country?.capital ? map?.states.find((s) => s.id === country.capital) : undefined
  return (
    <div className="w-64 rounded-lg border border-amber-500/70 bg-hoi-panel/95 p-3 shadow-xl">
      <div className="flex gap-3">
        <div className="relative">
          <img src={flag} width={82} height={52} alt="" className="ring-1 ring-black" />
          <span
            className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full ring-2 ring-hoi-panel"
            style={{ background: toHex(countryDrawColor(activeTag, project, game, gameColors)) }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{countryLabel(activeTag, project, game)}</div>
          <div className="font-mono text-xs text-hoi-muted">{activeTag}</div>
          <div className="text-xs">
            {country ? IDEOLOGY_LABELS[country.politics.ruling] : 'país del juego'}
          </div>
        </div>
        <button
          className="self-start text-hoi-muted hover:text-white"
          title="Soltar el pincel"
          onClick={() => setBrush(null)}
        >
          <X size={16} />
        </button>
      </div>
      <div className="mt-2 flex items-center justify-between text-xs">
        <span>{states.length} estado(s)</span>
        {capital ? (
          <button
            className="text-hoi-accent underline"
            onClick={() => store.focusState(capital.id)}
            title="Centrar el mapa en la capital"
          >
            ★ {capital.name}
          </button>
        ) : country ? (
          <span className="text-yellow-400">sin capital</span>
        ) : null}
      </div>
      {country && !country.technical && (
        <button
          className="btn mt-2 w-full justify-center text-xs"
          onClick={() => onOpenWizard(country.uid)}
        >
          Editar país
        </button>
      )}
    </div>
  )
}
