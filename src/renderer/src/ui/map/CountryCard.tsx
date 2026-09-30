// Tarjeta flotante del país activo (arriba a la izquierda del mapa)
import { useMemo, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { IDEOLOGY_LABELS, type Project } from '../../types'
import { store, useApp } from '../../store/appStore'
import { getCatalogOptions } from '../../catalog/catalog'
import { countryStates } from '../../map/mapOps'
import { activateTag } from '../../map/tools'
import { renderFlagPlaceholder } from '../../icons/renderer'
import { colorForTag } from '../../countries/countryOps'
import { flagSrc } from '../FlagThumb'

interface Props {
  project: Project
  onOpenWizard: (countryUid?: string, step?: number) => void
}

export default function CountryCard({ project, onOpenWizard }: Props): JSX.Element {
  const map = useApp((s) => s.map)
  const activeTag = useApp((s) => s.activeTag)
  const game = useApp(() => store.catalogGame())
  const [choosing, setChoosing] = useState(false)
  const [query, setQuery] = useState('')
  const country = project.countries.find((c) => c.tag === activeTag)
  const states = useMemo(
    () => (map && activeTag ? countryStates(project, map, activeTag) : []),
    [map, project, activeTag]
  )

  const options = getCatalogOptions('country', project, game)
    .filter((o) => `${o.id} ${o.etiqueta}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 50)

  if (!activeTag)
    return (
      <div className="w-72 rounded-lg border border-hoi-border bg-hoi-panel/95 p-3 shadow-xl">
        <div className="mb-2 text-sm text-hoi-muted">Ningún país seleccionado</div>
        <div className="flex gap-2">
          <button
            className="btn-primary flex-1 justify-center text-xs"
            onClick={() => setChoosing(!choosing)}
          >
            Elegir país
          </button>
          <button className="btn flex-1 justify-center text-xs" onClick={() => onOpenWizard()}>
            <Plus size={12} /> Crear país
          </button>
        </div>
        {choosing && (
          <div className="mt-2">
            <input
              className="input mb-1 text-xs"
              autoFocus
              placeholder="Buscar país…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="max-h-56 overflow-y-auto rounded border border-hoi-border">
              {options.map((o) => (
                <button
                  key={o.id}
                  className="flex w-full items-center gap-2 px-2 py-1 text-left text-xs hover:bg-hoi-card"
                  onClick={() => {
                    if (activateTag(o.id, o.etiqueta)) setChoosing(false)
                  }}
                >
                  <span className="w-9 font-mono text-hoi-muted">{o.id}</span>
                  <span className="flex-1 truncate">{o.etiqueta}</span>
                  {o.origen === 'mod' && <span className="text-[10px] text-hoi-accent">mod</span>}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    )

  const flag = country ? flagSrc(country) : renderFlagPlaceholder(activeTag, colorForTag(activeTag))
  const capital = country?.capital ? map?.states.find((s) => s.id === country.capital) : undefined
  return (
    <div className="w-72 rounded-lg border border-amber-500/70 bg-hoi-panel/95 p-3 shadow-xl">
      <div className="flex gap-3">
        <img src={flag} width={82} height={52} alt="" className="ring-1 ring-black" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{country?.names.name ?? activeTag}</div>
          <div className="font-mono text-xs text-hoi-muted">{activeTag}</div>
          {country && <div className="text-xs">{IDEOLOGY_LABELS[country.politics.ruling]}</div>}
        </div>
        <button
          className="self-start text-hoi-muted hover:text-white"
          title="Deseleccionar"
          onClick={() => store.set({ activeTag: null })}
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
        ) : (
          <span className="text-yellow-400">sin capital</span>
        )}
      </div>
      {country && (
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
