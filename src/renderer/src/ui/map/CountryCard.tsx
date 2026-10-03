// Tarjeta flotante del pincel activo (arriba a la izquierda del mapa)
import { Plus, X, AlertTriangle, Star } from 'lucide-react'
import { IDEOLOGY_LABELS, type Project } from '../../types'
import { store, useApp } from '../../store/appStore'
import { getOwnerCounts } from '../../map/mapOps'
import { countryLabel, NO_NATION, setBrush } from '../../map/brush'
import { toHex } from '../../countries/color'
import { countryDrawColor } from '../../map/colors'
import { flagForTag } from '../FlagThumb'
import { chooseCountryTag } from '../countryFlow'
import {
  currentGameCapital,
  existedAtStart,
  leaveState,
  planCapitalMoves
} from '../../map/capitals'
import { exportOwner } from '../../map/noNation'
import { chooseState } from '../stateFlow'

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
  // Mismo conteo que el selector y la Paleta (incremental, según effectiveOwner)
  const stateCount =
    map && activeTag && activeTag !== NO_NATION
      ? (getOwnerCounts(map, project).get(activeTag) ?? 0)
      : 0

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
  // Capital: la de mi país o, para un país del juego, la de su archivo en history/countries
  const capNum =
    country?.mode === 'nuevo' ? country.capital : currentGameCapital(activeTag, project, game)
  const capital = capNum ? map?.states.find((s) => s.id === capNum) : undefined
  const capOwner = capital ? exportOwner(capital, project) : ''
  const foreign = !!capital && capOwner !== activeTag
  const move = foreign
    ? planCapitalMoves(project, map, game).find((m) => m.tag === activeTag)
    : undefined
  // País que existía al inicio y por mis cambios se quedó sin estados: devolverle uno
  const leaveOne = (): void => {
    void chooseState({ current: null }).then(
      (id) => id && leaveState(activeTag, id, store.get().map)
    )
  }
  const pickCapital = (): void => {
    // Solo entre los estados que le quedan al país
    void chooseState({ current: capNum ?? null, onlyOwner: activeTag }).then((id) => {
      if (!id) return
      store.updateProject((p) => ({
        ...p,
        mapSettings: {
          ...p.mapSettings,
          capitalChoices: { ...p.mapSettings.capitalChoices, [activeTag]: id }
        }
      }))
    })
  }
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
          <button
            className="block max-w-full truncate text-left font-semibold hover:text-hoi-accent"
            title="Cambiar de país"
            onClick={() => void chooseCountryTag('Pintar con…').then((t) => t && setBrush(t))}
          >
            {countryLabel(activeTag, project, game)}
          </button>
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
        <span>{stateCount} estado(s)</span>
        {capital ? (
          <button
            className={foreign ? 'text-yellow-400 underline' : 'text-hoi-text underline'}
            onClick={() => store.focusState(capital.id)}
            title="Centrar el mapa en la capital"
          >
            {foreign ? (
              <AlertTriangle size={12} className="mr-1 inline" />
            ) : (
              <Star size={12} className="mr-1 inline" />
            )}
            {capital.name} (#{capital.id})
          </button>
        ) : country || capNum === null ? (
          <span className="text-yellow-400">sin capital</span>
        ) : null}
      </div>
      {foreign && (
        <div className="mt-1 text-xs text-yellow-400">
          capital en territorio ajeno (ahora es de {capOwner || 'nadie'})
          {move?.to ? ` → se moverá al estado #${move.to}` : ''}
          {getOwnerCounts(map!, project).get(activeTag) ? (
            <button className="btn mt-1 w-full justify-center text-xs" onClick={pickCapital}>
              Elegir otra capital…
            </button>
          ) : existedAtStart(map, activeTag) ? (
            <button
              className="btn mt-1 w-full justify-center text-xs"
              title="Elige en el mapa un estado: vuelve a ser suyo y pasa a ser su capital"
              onClick={leaveOne}
            >
              Dejarle un estado
            </button>
          ) : null}
        </div>
      )}
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
