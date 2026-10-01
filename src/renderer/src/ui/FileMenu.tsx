// Menú Archivo (como Archivo de NX)
import { store, useApp } from '../store/appStore'
import { openRecent, closeTabAsk } from './fileOps'
import { runCommand } from './commands'
import { useEffect, useState } from 'react'
import type { RecentEntry } from './fileOps'

export default function FileMenu({ onClose }: { onClose: () => void }): JSX.Element {
  const hasProject = useApp((s) => !!s.project)
  const activeTab = useApp((s) => s.activeTabId)
  const [recent, setRecent] = useState<RecentEntry[]>([])
  useEffect(() => {
    void window.electronAPI?.getSettings().then((s) => setRecent((s.recent as RecentEntry[]) ?? []))
  }, [])
  const item = (label: string, keys: string, action: () => void, disabled = false): JSX.Element => (
    <button
      disabled={disabled}
      className="flex w-full items-center justify-between gap-6 px-3 py-1.5 text-left text-sm hover:bg-hoi-card disabled:opacity-35 disabled:hover:bg-transparent"
      onClick={() => {
        onClose()
        action()
      }}
    >
      <span>{label}</span>
      <span className="text-xs text-hoi-muted">{keys}</span>
    </button>
  )
  return (
    <div className="absolute left-0 top-full z-40 w-72 rounded-b border border-hoi-border bg-hoi-panel py-1 shadow-2xl">
      {item('Nuevo proyecto…', 'Ctrl+N', () => store.set({ newProjectDialog: { name: '' } }))}
      {item('Abrir…', 'Ctrl+O', () => runCommand('fileOpen'))}
      <div className="px-3 pt-1 text-[11px] uppercase text-hoi-muted">Abrir reciente</div>
      {recent.length === 0 && <div className="px-3 py-1 text-xs text-hoi-muted">(vacío)</div>}
      {recent.slice(0, 6).map((r) => (
        <button
          key={r.path}
          title={r.path}
          className="block w-full truncate px-5 py-1 text-left text-xs hover:bg-hoi-card"
          onClick={() => {
            onClose()
            void openRecent(r.path)
          }}
        >
          {r.name}
        </button>
      ))}
      <div className="my-1 border-t border-hoi-border" />
      {item('Guardar', 'Ctrl+S', () => runCommand('fileSave'), !hasProject)}
      {item('Guardar como…', '', () => runCommand('fileSaveAs'), !hasProject)}
      {item('Exportar mod', '', () => runCommand('exportMod'), !hasProject)}
      <div className="my-1 border-t border-hoi-border" />
      {item('Propiedades del proyecto…', '', () => store.set({ propsDialog: true }), !hasProject)}
      {item(
        'Cerrar pestaña',
        'Ctrl+W',
        () => activeTab && void closeTabAsk(activeTab),
        !hasProject
      )}
      <div className="my-1 border-t border-hoi-border" />
      {item('Ajustes…', '', () => store.set({ settingsDialog: true }))}
      {item('Salir', '', () => window.close())}
    </div>
  )
}
