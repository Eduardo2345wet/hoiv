// Selector "País: [bandera + nombre]" del editor de focos.
// Cada árbol pertenece a un país; elegir un país sin árbol ofrece crearle uno.
import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Project } from '../types'
import { store } from '../store/appStore'
import { createTreeForCountry, treeCountry } from '../countries/countryOps'
import FlagThumb from './FlagThumb'

export default function TreeSelector({
  project,
  activeTreeId
}: {
  project: Project
  activeTreeId: string | null
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const current = treeCountry(project, activeTreeId)
  const orphanTrees = project.focusTrees.filter((t) => !treeCountry(project, t.id))

  const chooseCountry = (uid: string): void => {
    setOpen(false)
    const c = project.countries.find((x) => x.uid === uid)!
    if (c.focusTreeId) {
      store.set({ activeTreeId: c.focusTreeId, selectedUid: null })
      return
    }
    if (!confirm(`${c.names.name} no tiene árbol de focos. ¿Crear uno vacío?`)) return
    let treeId = ''
    store.updateProject((p) => {
      const r = createTreeForCountry(p, uid)
      treeId = r.treeId
      return r.project
    })
    store.set({ activeTreeId: treeId, selectedUid: null })
  }

  return (
    <div className="relative">
      <button className="btn" onClick={() => setOpen(!open)} title="País dueño del árbol de focos">
        <span className="text-hoi-muted">País:</span>
        {current ? (
          <>
            <FlagThumb country={current} height={16} />
            {current.names.name || current.tag}{' '}
            <span className="font-mono text-xs text-hoi-muted">{current.tag}</span>
          </>
        ) : (
          <span className="text-yellow-400">árbol sin país</span>
        )}
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-40 mt-1 max-h-80 w-72 overflow-y-auto rounded border border-hoi-border bg-hoi-panel p-1 shadow-xl">
          {project.countries
            .filter((c) => !c.technical)
            .map((c) => (
              <button
                key={c.uid}
                onClick={() => chooseCountry(c.uid)}
                className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-hoi-card ${
                  c.focusTreeId === activeTreeId ? 'bg-hoi-accent/20' : ''
                }`}
              >
                <FlagThumb country={c} height={16} />
                <span className="flex-1 truncate">{c.names.name || c.tag}</span>
                <span className="font-mono text-xs text-hoi-muted">{c.tag}</span>
                {!c.focusTreeId && <span className="text-[10px] text-hoi-muted">sin árbol</span>}
              </button>
            ))}
          {orphanTrees.map((t) => (
            <button
              key={t.id}
              onClick={() => {
                setOpen(false)
                store.set({ activeTreeId: t.id, selectedUid: null })
              }}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-yellow-400 hover:bg-hoi-card"
            >
              ⚠ {t.name} (sin país)
            </button>
          ))}
          {!project.countries.length && (
            <p className="p-2 text-xs text-hoi-muted">Crea un país en la pestaña Países.</p>
          )}
        </div>
      )}
    </div>
  )
}
