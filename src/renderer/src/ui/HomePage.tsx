// Página de inicio (sin proyecto abierto): dos botones y la lista de recientes. Nada más.
import { useEffect, useState } from 'react'
import { FilePlus, FolderOpen } from 'lucide-react'
import { store } from '../store/appStore'
import { openRecent, openWithDialog, type RecentEntry } from './fileOps'
import { templateInfo } from '../templates'
import type { TemplateId } from '../types'

export default function HomePage(): JSX.Element {
  const [recent, setRecent] = useState<RecentEntry[] | null>(null)
  useEffect(() => {
    void (window.electronAPI?.getSettings() ?? Promise.resolve(null)).then((s) =>
      setRecent((s?.recent as RecentEntry[]) ?? [])
    )
  }, [])
  return (
    <div className="flex h-full flex-col items-center overflow-y-auto py-12">
      <div className="flex gap-6">
        <button
          className="flex w-56 flex-col items-center gap-3 rounded-lg border-2 border-hoi-accent bg-hoi-accent/10 px-6 py-8 text-lg font-semibold hover:bg-hoi-accent/20"
          onClick={() => store.set({ newProjectDialog: { name: '' } })}
        >
          <FilePlus size={40} className="text-hoi-accent" />
          Nuevo proyecto
        </button>
        <button
          className="flex w-56 flex-col items-center gap-3 rounded-lg border-2 border-hoi-border bg-hoi-panel px-6 py-8 text-lg font-semibold hover:border-hoi-muted"
          onClick={() => void openWithDialog()}
        >
          <FolderOpen size={40} className="text-hoi-muted" />
          Abrir proyecto
        </button>
      </div>
      <div className="mt-10 w-[640px] max-w-full">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-hoi-muted">
          Recientes
        </h2>
        {recent && recent.length === 0 && (
          <p className="text-sm text-hoi-muted">Todavía no hay proyectos recientes.</p>
        )}
        <div className="flex flex-col">
          {(recent ?? []).map((r) => (
            <button
              key={r.path}
              onClick={() => void openRecent(r.path)}
              className="flex flex-col gap-0.5 border-b border-hoi-border px-3 py-2 text-left hover:bg-hoi-panel"
              title={r.path}
            >
              <span className="flex items-baseline gap-3">
                <span className="font-medium">{r.name}</span>
                <span className="text-xs text-hoi-accent">
                  {templateInfo(r.template as TemplateId).name}
                </span>
                <span className="ml-auto text-xs text-hoi-muted">
                  {new Date(r.date).toLocaleDateString('es')}
                </span>
              </span>
              <span className="truncate text-xs text-hoi-muted">{r.path}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
