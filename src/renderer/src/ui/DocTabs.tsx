// Pestañas de documentos (un proyecto por pestaña), como "Bodyside.prt" en NX
import { X } from 'lucide-react'
import { store, useApp } from '../store/appStore'
import { closeTabAsk } from './fileOps'

export default function DocTabs(): JSX.Element | null {
  useApp((s) => s.tabs)
  useApp((s) => s.activeTabId)
  useApp((s) => s.dirty)
  useApp((s) => s.project?.modName)
  const tabs = store.listTabs()
  if (!tabs.length) return null
  return (
    <div className="flex shrink-0 items-end gap-0.5 overflow-x-auto border-b border-hoi-border bg-hoi-bg px-1 pt-1">
      {tabs.map((t) => (
        <div
          key={t.id}
          onClick={() => store.switchTab(t.id)}
          onAuxClick={(e) => e.button === 1 && void closeTabAsk(t.id)}
          title={t.filePath ?? 'Sin guardar'}
          className={`group flex max-w-[220px] cursor-pointer items-center gap-2 rounded-t border border-b-0 px-3 py-1 text-sm ${
            t.active
              ? 'border-hoi-border bg-hoi-panel text-hoi-text'
              : 'border-transparent text-hoi-muted hover:bg-hoi-panel/60'
          }`}
        >
          <span className="truncate">{t.name}</span>
          {t.dirty && <span className="text-hoi-muted">●</span>}
          <button
            title="Cerrar (Ctrl+W)"
            className="rounded p-0.5 opacity-60 hover:bg-hoi-card hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              void closeTabAsk(t.id)
            }}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  )
}
