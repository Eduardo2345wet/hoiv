// Pantalla principal: barra superior, lienzo, panel del foco, bloques y vista previa
import { useCallback, useEffect, useState } from 'react'
import { ArrowLeft, Download, GitBranch, MousePointer2, Plus, Save, Slash } from 'lucide-react'
import type { Focus, FocusScripts, Project } from '../types'
import FocusCanvas, { type Tool } from './FocusCanvas'
import FocusPanel from './FocusPanel'
import BlocklyEditor from './BlocklyEditor'
import PreviewPanel from './PreviewPanel'
import ValidationDialog from './ValidationDialog'
import { validateProject, type Issue } from '../export/validator'
import { exportMod } from '../export/exportMod'
import {
  createFocus,
  deleteFocus,
  toggleExclusive,
  togglePrerequisite,
  updateFocus
} from './projectOps'

interface Props {
  project: Project
  filePath: string | null
  onProjectChange: (p: Project | ((prev: Project) => Project)) => void
  onFilePathChange: (path: string) => void
  onClose: () => void
}

export default function Editor(props: Props): JSX.Element {
  const { project, filePath, onProjectChange: setProject } = props
  const [selected, setSelected] = useState<string | null>(project.focuses[0]?.uid ?? null)
  const [tool, setTool] = useState<Tool>('select')
  const [issues, setIssues] = useState<Issue[] | null>(null)
  const [status, setStatus] = useState('')
  const [dirty, setDirty] = useState(false)

  const selectedFocus = project.focuses.find((f) => f.uid === selected) ?? null

  const change = useCallback(
    (fn: (p: Project) => Project) => {
      setProject(fn)
      setDirty(true)
    },
    [setProject]
  )

  const flash = (msg: string): void => {
    setStatus(msg)
    setTimeout(() => setStatus(''), 4000)
  }

  // ---- Guardar proyecto.json ----
  const save = useCallback(async () => {
    const api = window.electronAPI
    if (!api) return
    const json = JSON.stringify(project, null, 2)
    if (filePath) {
      await api.saveProjectToPath(filePath, json)
    } else {
      const path = await api.saveProjectDialog(json, 'proyecto.json')
      if (!path) return
      props.onFilePathChange(path)
    }
    setDirty(false)
    flash('✔ Proyecto guardado')
  }, [project, filePath, props])

  // Ctrl+S para guardar
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault()
        void save()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [save])

  // ---- Exportar ----
  const doExport = async (): Promise<void> => {
    setIssues(null)
    const res = await exportMod(project)
    if (res.ok) alert('✔ ' + res.message)
    else if (res.message !== 'Exportación cancelada.') alert('❌ ' + res.message)
  }
  const startExport = (): void => {
    const found = validateProject(project)
    if (found.length) setIssues(found)
    else void doExport()
  }

  // ---- Acciones del árbol ----
  const addFocusAt = (x: number, y: number): void => {
    const f = createFocus(project.tag, project.focuses, x, y)
    change((p) => ({ ...p, focuses: [...p.focuses, f] }))
    setSelected(f.uid)
    setTool('select')
  }
  const addFocus = (): void => {
    // Busca la primera casilla libre en la fila de abajo del foco seleccionado
    const y = selectedFocus ? selectedFocus.y + 1 : 0
    let x = selectedFocus ? selectedFocus.x : 0
    while (project.focuses.some((f) => f.x === x && f.y === y)) x++
    addFocusAt(x, y)
  }
  const removeFocus = (uid: string): void => {
    const f = project.focuses.find((x) => x.uid === uid)
    if (!f || !confirm(`¿Borrar el foco "${f.name || f.id}"?`)) return
    change((p) => deleteFocus(p, uid))
    setSelected(null)
  }
  const onLink = (from: string, to: string): void => {
    if (tool === 'prereq') change((p) => togglePrerequisite(p, from, to))
    else change((p) => toggleExclusive(p, from, to))
  }
  const patchSelected = (patch: Partial<Focus>): void => {
    if (selected) change((p) => updateFocus(p, selected, patch))
  }
  const onBlocksChange = useCallback(
    (uid: string, blocks: unknown, scripts: FocusScripts) => change((p) => updateFocus(p, uid, { blocks, scripts })),
    [change]
  )

  const toolBtn = (t: Tool, label: string, icon: JSX.Element, title: string): JSX.Element => (
    <button title={title} className={tool === t ? 'btn-primary' : 'btn'} onClick={() => setTool(t)}>
      {icon} {label}
    </button>
  )

  return (
    <div className="flex h-screen w-screen flex-col bg-hoi-bg">
      {/* Barra superior */}
      <header className="flex items-center gap-2 border-b border-hoi-border bg-hoi-panel px-3 py-2">
        <button
          className="btn"
          title="Volver al inicio"
          onClick={() => (!dirty || confirm('Hay cambios sin guardar. ¿Salir igualmente?')) && props.onClose()}
        >
          <ArrowLeft size={16} />
        </button>
        <div className="mr-4">
          <div className="font-semibold text-hoi-accent">
            {project.modName}
            {dirty && ' •'}
          </div>
          <div className="text-[11px] text-hoi-muted">País: {project.tag}</div>
        </div>
        <button className="btn" onClick={addFocus}>
          <Plus size={16} /> Añadir foco
        </button>
        <div className="mx-2 h-6 w-px bg-hoi-border" />
        {toolBtn('select', 'Mover', <MousePointer2 size={16} />, 'Seleccionar y arrastrar focos')}
        {toolBtn('prereq', 'Prerrequisito', <GitBranch size={16} />, 'Conectar: padre → hijo (línea normal)')}
        {toolBtn('exclusive', 'Excluyente', <Slash size={16} />, 'Conectar focos mutuamente excluyentes (línea roja)')}
        <div className="flex-1" />
        <span className="text-sm text-emerald-400">{status}</span>
        <button className="btn" onClick={() => void save()} title="Ctrl+S">
          <Save size={16} /> Guardar
        </button>
        <button className="btn-primary" onClick={startExport}>
          <Download size={16} /> Exportar mod
        </button>
      </header>

      {/* Parte de arriba: árbol + panel del foco */}
      <div className="flex min-h-0 flex-[55]">
        <div className="min-w-0 flex-1">
          <FocusCanvas
            focuses={project.focuses}
            selected={selected}
            tool={tool}
            onSelect={setSelected}
            onMove={(uid, x, y) => change((p) => updateFocus(p, uid, { x, y }))}
            onLink={onLink}
            onUnlinkPrereq={(a, b) => change((p) => togglePrerequisite(p, a, b))}
            onUnlinkExclusive={(a, b) => change((p) => toggleExclusive(p, a, b))}
            onAddAt={addFocusAt}
            onDelete={removeFocus}
          />
        </div>
        <aside className="w-80 overflow-y-auto border-l border-hoi-border bg-hoi-panel">
          <FocusPanel
            focus={selectedFocus}
            onChange={patchSelected}
            onDelete={() => selected && removeFocus(selected)}
          />
        </aside>
      </div>

      {/* Parte de abajo: bloques + vista previa */}
      <div className="flex min-h-0 flex-[45] border-t border-hoi-border">
        <div className="min-w-0 flex-1">
          <BlocklyEditor focus={selectedFocus} onChange={onBlocksChange} />
        </div>
        <aside className="w-[420px] border-l border-hoi-border bg-[#101013]">
          <PreviewPanel project={project} />
        </aside>
      </div>

      {issues && (
        <ValidationDialog
          issues={issues}
          onClose={() => setIssues(null)}
          onExportAnyway={() => void doExport()}
          onSelectFocus={setSelected}
        />
      )}
    </div>
  )
}
