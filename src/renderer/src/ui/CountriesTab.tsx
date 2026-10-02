// Pestaña "Países": tarjetas con bandera, nombre, tag e ideología
import { Copy, Lock, Pencil, Plus, Trash2 } from 'lucide-react'
import { IDEOLOGY_LABELS, type Project } from '../types'
import { store, useApp } from '../store/appStore'
import { countryReferences, deleteCountry, duplicateCountry } from '../countries/countryOps'
import { suggestTag } from '../countries/tags'
import { getCatalogOptions } from '../catalog/catalog'
import FlagThumb from './FlagThumb'
import { useState } from 'react'
import { ScenariosDialog, StartPanel } from './StartPanel'

interface Props {
  project: Project
  /** Abre el asistente: sin uid = crear; con uid = editar (en la pestaña/paso indicado) */
  onOpenWizard: (countryUid?: string, step?: number) => void
}

export default function CountriesTab({ project, onOpenWizard }: Props): JSX.Element {
  const game = useApp(() => store.catalogGame())
  const [startTag, setStartTag] = useState<string | null>(null)
  const [scenarios, setScenarios] = useState(false)

  const duplicate = (uid: string): void => {
    const src = project.countries.find((c) => c.uid === uid)!
    const taken = getCatalogOptions('country', project, game).map((o) => o.id)
    store.updateProject((p) => duplicateCountry(p, uid, suggestTag(src.names.name, taken)).project)
  }

  const remove = (uid: string): void => {
    const c = project.countries.find((x) => x.uid === uid)!
    const warnings: string[] = []
    if (c.focusTreeId)
      warnings.push('tiene un árbol de focos (el árbol se conserva, pero quedará sin país)')
    const refs = countryReferences(project, c.tag)
    if (refs.length) warnings.push(`se usa en los focos: ${refs.join(', ')}`)
    const msg =
      `¿Borrar el país "${c.names.name || c.tag}"?` +
      (warnings.length ? `\n\nOjo: ${warnings.join('; ')}.` : '')
    if (confirm(msg)) store.updateProject((p) => deleteCountry(p, uid))
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="mb-4 flex items-center gap-3">
        <button className="btn-primary" onClick={() => onOpenWizard()}>
          <Plus size={16} /> Crear país
        </button>
        <button className="btn" onClick={() => setScenarios(true)}>
          Escenarios de inicio…
        </button>
        <span className="text-sm text-hoi-muted">
          {project.countries.filter((c) => !c.technical && !c.light).length} país(es) en el mod
        </span>
      </div>
      {/* País técnico "Sin nación": aparte, con candado (lo mantiene la app) */}
      {project.countries
        .filter((c) => c.technical)
        .map((c) => (
          <div
            key={c.uid}
            className="mb-4 flex items-center gap-3 rounded border border-dashed border-hoi-border bg-hoi-bg p-3"
          >
            <FlagThumb country={c} height={32} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 font-semibold">
                <Lock size={14} /> {c.names.name}
                <span className="rounded bg-hoi-card px-1.5 py-0.5 text-[10px] uppercase text-hoi-muted">
                  Técnico
                </span>
              </div>
              <div className="text-xs text-hoi-muted">
                <span className="font-mono">{c.tag}</span> · dueño de los estados pendientes (modo
                Sin nación). No se puede editar ni borrar aquí: cambia su nombre o tag en Mapa → ⚙
                Sin nación.
              </div>
            </div>
          </div>
        ))}
      <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {project.countries
          .filter((c) => !c.technical && !c.light)
          .map((c) => {
            const tree = project.focusTrees.find((t) => t.id === c.focusTreeId)
            return (
              <div
                key={c.uid}
                className="flex flex-col gap-2 rounded border border-hoi-border bg-hoi-panel p-3"
              >
                <div className="flex items-center gap-3">
                  <FlagThumb country={c} height={40} />
                  <div className="min-w-0">
                    <div className="truncate font-semibold">
                      {c.names.name || <span className="text-red-400">sin nombre</span>}
                    </div>
                    <div className="text-xs text-hoi-muted">
                      <span className="font-mono">{c.tag}</span> ·{' '}
                      {IDEOLOGY_LABELS[c.politics.ruling]} ·{' '}
                      {c.mode === 'nuevo' ? 'país nuevo' : 'existente'}
                    </div>
                  </div>
                </div>
                <div className="text-[11px] text-hoi-muted">
                  Árbol:{' '}
                  {tree ? tree.name : <span className="text-yellow-400">sin árbol de focos</span>}
                </div>
                <div className="mt-auto flex gap-1">
                  <button
                    className="btn flex-1 justify-center px-2 py-1 text-xs"
                    onClick={() => onOpenWizard(c.uid)}
                  >
                    <Pencil size={12} /> Editar
                  </button>
                  <button
                    className="btn px-2 py-1 text-xs"
                    title="Valores iniciales, espíritus, tecnologías y diplomacia"
                    onClick={() => setStartTag(c.tag)}
                  >
                    Situación inicial
                  </button>
                  <button
                    className="btn px-2 py-1 text-xs"
                    title="Duplicar"
                    onClick={() => duplicate(c.uid)}
                  >
                    <Copy size={12} />
                  </button>
                  <button
                    className="btn px-2 py-1 text-xs text-red-400"
                    title="Borrar"
                    onClick={() => remove(c.uid)}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            )
          })}
      </div>
      {startTag && (
        <StartPanel project={project} tag={startTag} onClose={() => setStartTag(null)} />
      )}
      {scenarios && <ScenariosDialog project={project} onClose={() => setScenarios(false)} />}
    </div>
  )
}
