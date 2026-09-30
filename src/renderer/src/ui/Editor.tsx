// Pantalla principal del editor de focos.
// Arriba: lienzo del árbol + panel del foco. Abajo: bloques (Blockly) + vista previa.

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Save, X } from 'lucide-react'
import { buildFocusBlocks, buildFocusTreeFile } from '../export/focusTree'
import { buildLocalisation } from '../export/localisation'
import {
  addFocus,
  removeFocus,
  toggleMutuallyExclusive,
  togglePrerequisite,
  updateFocus,
  type BlocklyState,
  type Project
} from '../model/project'
import BlocklyEditor from './BlocklyEditor'
import ExportDialog from './ExportDialog'
import FocusCanvas from './FocusCanvas'
import FocusPanel from './FocusPanel'
import PreviewPanel from './PreviewPanel'

interface Props {
  project: Project
  dirty: boolean
  filePath: string | null
  onUpdate: (fn: (p: Project) => Project) => void
  onSave: (saveAs: boolean) => void
  onClose: () => void
}

export default function Editor({ project, dirty, filePath, onUpdate, onSave, onClose }: Props): JSX.Element {
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [showExport, setShowExport] = useState(false)
  const selected = project.foci.find((f) => f.uid === selectedUid) ?? null

  // Script generado (se recalcula en vivo con cada cambio).
  const focusBlocks = useMemo(() => buildFocusBlocks(project), [project])
  const fileScript = useMemo(() => buildFocusTreeFile(project, focusBlocks), [project, focusBlocks])
  const localisation = useMemo(() => buildLocalisation(project), [project])

  // Ctrl+S para guardar.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault()
        onSave(e.shiftKey)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onSave])

  const handleAdd = (x: number, y: number): void => {
    const result = addFocus(project, x, y)
    onUpdate(() => result.project)
    setSelectedUid(result.focus.uid)
  }

  const handleDelete = (uid: string): void => {
    const focus = project.foci.find((f) => f.uid === uid)
    if (!focus || !window.confirm(`¿Borrar el foco "${focus.name || focus.id}"?`)) return
    onUpdate((p) => removeFocus(p, uid))
    setSelectedUid(null)
  }

  const handleBlocksChange = useCallback(
    (uid: string, state: BlocklyState) => onUpdate((p) => updateFocus(p, uid, { blocks: state })),
    [onUpdate]
  )

  const fileName = filePath ? filePath.split(/[\\/]/).pop() : 'proyecto nuevo'

  return (
    <div className="flex h-screen w-screen flex-col bg-hoi-bg text-hoi-text">
      {/* Barra superior */}
      <header className="flex items-center gap-3 border-b border-hoi-border bg-hoi-panel px-4 py-2">
        <span className="font-extrabold text-hoi-accent">HOI4 Mod Studio</span>
        <span className="text-sm">
          {project.modName} <span className="font-mono text-hoi-muted">[{project.tag}]</span>
        </span>
        <span className="text-xs text-hoi-muted">
          {fileName}
          {dirty && ' • cambios sin guardar'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => onSave(false)}
            title="Guardar (Ctrl+S)"
            className="flex items-center gap-1 rounded bg-hoi-card px-3 py-1.5 text-sm hover:bg-hoi-border"
          >
            <Save size={16} /> Guardar
          </button>
          <button
            onClick={() => onSave(true)}
            title="Guardar como (Ctrl+Shift+S)"
            className="rounded bg-hoi-card px-3 py-1.5 text-sm hover:bg-hoi-border"
          >
            Guardar como…
          </button>
          <button
            onClick={() => setShowExport(true)}
            className="flex items-center gap-1 rounded bg-hoi-accent px-3 py-1.5 text-sm font-semibold text-white hover:bg-hoi-accentHover"
          >
            <Download size={16} /> Exportar mod
          </button>
          <button
            onClick={onClose}
            title="Cerrar proyecto"
            className="rounded p-1.5 text-hoi-muted hover:bg-hoi-card hover:text-hoi-text"
          >
            <X size={18} />
          </button>
        </div>
      </header>

      {/* Parte de arriba: lienzo + panel */}
      <div className="flex min-h-0 flex-[11]">
        <div className="min-w-0 flex-1">
          <FocusCanvas
            project={project}
            selectedUid={selectedUid}
            onSelect={setSelectedUid}
            onMove={(uid, x, y) => onUpdate((p) => updateFocus(p, uid, { x, y }))}
            onAdd={handleAdd}
            onDelete={handleDelete}
            onTogglePrerequisite={(a, b) => onUpdate((p) => togglePrerequisite(p, a, b))}
            onToggleExclusive={(a, b) => onUpdate((p) => toggleMutuallyExclusive(p, a, b))}
          />
        </div>
        <aside className="w-80 shrink-0 border-l border-hoi-border bg-hoi-panel">
          <FocusPanel
            project={project}
            focus={selected}
            onChange={(uid, changes) => onUpdate((p) => updateFocus(p, uid, changes))}
            onDelete={handleDelete}
            onTogglePrerequisite={(a, b) => onUpdate((p) => togglePrerequisite(p, a, b))}
            onToggleExclusive={(a, b) => onUpdate((p) => toggleMutuallyExclusive(p, a, b))}
          />
        </aside>
      </div>

      {/* Parte de abajo: bloques + vista previa */}
      <div className="flex min-h-0 flex-[9] border-t border-hoi-border">
        <div className="relative min-w-0 flex-1">
          {selected ? (
            <>
              <div className="pointer-events-none absolute right-3 top-2 z-10 rounded bg-hoi-panel/90 px-2 py-1 text-xs text-hoi-muted">
                Bloques de: <b className="text-hoi-text">{selected.name || selected.id}</b>
              </div>
              <BlocklyEditor focus={selected} onChange={handleBlocksChange} />
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-hoi-muted">
              Selecciona un foco para editar sus requisitos y recompensas con bloques.
            </div>
          )}
        </div>
        <aside className="w-[420px] shrink-0 border-l border-hoi-border">
          <PreviewPanel
            focusScript={selected ? (focusBlocks.get(selected.uid) ?? null) : null}
            fileScript={fileScript}
            localisation={localisation}
          />
        </aside>
      </div>

      {showExport && (
        <ExportDialog
          project={project}
          focusBlocks={focusBlocks}
          fileScript={fileScript}
          localisation={localisation}
          onSelectFocus={setSelectedUid}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  )
}
