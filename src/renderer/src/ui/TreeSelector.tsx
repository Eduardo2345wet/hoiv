// Selector "País:" del editor de focos. Cada árbol pertenece a un país; abre el selector universal
// (Mis países → En el mapa → Todos los del juego), también para árboles "sin país".
import { ChevronDown } from 'lucide-react'
import type { Project } from '../types'
import { store } from '../store/appStore'
import { treeCountry } from '../countries/countryOps'
import { giveTreeToChosenCountry } from './countryFlow'
import FlagThumb from './FlagThumb'

export default function TreeSelector({
  project,
  activeTreeId
}: {
  project: Project
  activeTreeId: string | null
}): JSX.Element {
  const current = treeCountry(project, activeTreeId)
  const orphan = !!activeTreeId && !current
  return (
    <div className="flex items-center gap-1">
      <button
        className="btn"
        title="Elegir el país dueño de este árbol de focos"
        onClick={() => void giveTreeToChosenCountry(activeTreeId ?? undefined)}
      >
        <span className="text-hoi-muted">País:</span>
        {current ? (
          <>
            <FlagThumb country={current} height={16} />
            {current.names.name || current.tag}{' '}
            <span className="font-mono text-xs text-hoi-muted">{current.tag}</span>
          </>
        ) : (
          <span className="text-yellow-400">
            {orphan ? 'árbol sin país: elegir…' : 'elegir país…'}
          </span>
        )}
        <ChevronDown size={14} />
      </button>
      {project.focusTrees.length > 1 && (
        <select
          className="rounded border border-hoi-border bg-hoi-card px-1 py-1 text-xs"
          value={activeTreeId ?? ''}
          onChange={(e) => store.set({ activeTreeId: e.target.value, selectedUid: null })}
          title="Cambiar de árbol"
        >
          {project.focusTrees.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {treeCountry(project, t.id) ? '' : ' (sin país)'}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}
