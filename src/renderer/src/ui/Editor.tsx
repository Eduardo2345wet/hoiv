// Pantalla principal: barra superior, pestañas (focos, espíritus, biblioteca),
// lienzo, panel del foco, bloques y vista previa
import { useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  Download,
  GitBranch,
  MousePointer2,
  Plus,
  Redo2,
  Save,
  Settings,
  Slash,
  Undo2
} from 'lucide-react'
import type { FocusScripts, Project } from '../types'
import { store, useApp } from '../store/appStore'
import FocusCanvas, { type Tool } from './FocusCanvas'
import FocusPanel from './FocusPanel'
import BlocklyEditor from './BlocklyEditor'
import PreviewPanel from './PreviewPanel'
import ValidationDialog from './ValidationDialog'
import IdeasTab from './IdeasTab'
import CountriesTab from './CountriesTab'
import TreeSelector from './TreeSelector'
import CountryWizard from './wizard/CountryWizard'
import LibraryTab from './LibraryTab'
import SettingsDialog from './SettingsDialog'
import { validateProject, type Issue } from '../export/validator'
import { exportMod } from '../export/exportMod'
import {
  createFocus,
  createFocusBelow,
  deleteFocus,
  toggleExclusive,
  togglePrerequisite,
  updateFocus
} from './projectOps'

type Tab = 'focos' | 'paises' | 'ideas' | 'iconos'

export default function Editor(): JSX.Element {
  const project = useApp((s) => s.project) as Project
  const filePath = useApp((s) => s.filePath)
  const dirty = useApp((s) => s.dirty)
  const selected = useApp((s) => s.selectedUid)
  const game = useApp((s) => s.game)
  const canUndo = useApp((s) => s.past.length > 0)
  const canRedo = useApp((s) => s.future.length > 0)
  const [tab, setTab] = useState<Tab>('focos')
  const [tool, setTool] = useState<Tool>('select')
  const [issues, setIssues] = useState<Issue[] | null>(null)
  const [status, setStatus] = useState('')
  const [showSettings, setShowSettings] = useState(false)

  const storedTree = useApp((s) => s.activeTreeId)
  const activeTree =
    storedTree && project.focusTrees.some((t) => t.id === storedTree)
      ? storedTree
      : (project.focusTrees[0]?.id ?? null)
  const treeFocuses = project.focuses.filter((f) => f.treeId === activeTree)
  const [wizard, setWizard] = useState<{ uid?: string; step?: number } | null>(null)
  const selectedFocus = project.focuses.find((f) => f.uid === selected) ?? null
  const setSelected = (uid: string | null): void => store.set({ selectedUid: uid })
  const change = store.updateProject

  const flash = (msg: string): void => {
    setStatus(msg)
    setTimeout(() => setStatus(''), 4000)
  }

  // ---- Guardar proyecto.json ----
  const save = useCallback(async () => {
    const api = window.electronAPI
    const s = store.get()
    if (!api || !s.project) return
    const json = JSON.stringify(s.project, null, 2)
    if (s.filePath) {
      await api.saveProjectToPath(s.filePath, json)
    } else {
      const path = await api.saveProjectDialog(json, 'proyecto.json')
      if (!path) return
      store.set({ filePath: path })
    }
    store.set({ dirty: false })
    flash('✔ Proyecto guardado')
  }, [])

  // Atajos: Ctrl+S guardar, Ctrl+Z deshacer, Ctrl+Y / Ctrl+Shift+Z rehacer
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      if (k === 's') {
        e.preventDefault()
        void save()
        return
      }
      if (k !== 'z' && k !== 'y') return
      // Dentro del editor de bloques manda el deshacer de Blockly (no se mezclan)
      const target = e.target as HTMLElement | null
      if (
        e.defaultPrevented ||
        target?.closest?.('.injectionDiv, .blocklyWidgetDiv, .blocklyDropDownDiv')
      )
        return
      e.preventDefault()
      if (k === 'y' || (k === 'z' && e.shiftKey)) store.redo()
      else store.undo()
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
    const found = validateProject(project, game)
    if (found.length) setIssues(found)
    else void doExport()
  }

  // ---- Acciones del árbol ----
  const addFocusAt = (x: number, y: number): void => {
    let uid = ''
    change((p) => {
      const r = createFocus(p, x, y, undefined, activeTree ?? undefined)
      uid = r.focus.uid
      return r.project
    })
    setSelected(uid)
    setTool('select')
  }
  const addFocus = (): void => {
    let uid = ''
    change((p) => {
      const r = createFocusBelow(p, selected, undefined, activeTree ?? undefined)
      uid = r.focus.uid
      return r.project
    })
    setSelected(uid)
    setTab('focos')
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
  const onBlocksChange = useCallback(
    (uid: string, blocks: unknown, scripts: FocusScripts) =>
      store.updateBlocks(uid, { blocks, scripts }),
    []
  )

  const toolBtn = (t: Tool, label: string, icon: JSX.Element, title: string): JSX.Element => (
    <button title={title} className={tool === t ? 'btn-primary' : 'btn'} onClick={() => setTool(t)}>
      {icon} {label}
    </button>
  )
  const tabBtn = (t: Tab, label: string): JSX.Element => (
    <button
      onClick={() => setTab(t)}
      className={`px-3 py-2 text-sm ${tab === t ? 'border-b-2 border-hoi-accent text-hoi-accent' : 'text-hoi-muted hover:text-hoi-text'}`}
    >
      {label}
    </button>
  )

  return (
    <div className="flex h-screen w-screen flex-col bg-hoi-bg">
      {/* Barra superior */}
      <header className="flex items-center gap-2 border-b border-hoi-border bg-hoi-panel px-3 py-2">
        <button
          className="btn"
          title="Volver al inicio"
          onClick={() =>
            (!dirty || confirm('Hay cambios sin guardar. ¿Salir igualmente?')) &&
            store.openProject(null, null)
          }
        >
          <ArrowLeft size={16} />
        </button>
        <div className="mr-2">
          <div className="font-semibold text-hoi-accent">
            {project.modName}
            {dirty && ' •'}
          </div>
          <div className="text-[11px] text-hoi-muted">
            {filePath ? 'Proyecto guardado' : 'Sin guardar todavía'}
          </div>
        </div>
        {tab === 'focos' && (
          <>
            <TreeSelector project={project} activeTreeId={activeTree} />
            <button className="btn" onClick={addFocus}>
              <Plus size={16} /> Añadir foco
            </button>
            <div className="mx-1 h-6 w-px bg-hoi-border" />
            {toolBtn(
              'select',
              'Mover',
              <MousePointer2 size={16} />,
              'Seleccionar y arrastrar focos'
            )}
            {toolBtn(
              'prereq',
              'Prerrequisito',
              <GitBranch size={16} />,
              'Conectar: padre → hijo (línea normal)'
            )}
            {toolBtn(
              'exclusive',
              'Excluyente',
              <Slash size={16} />,
              'Conectar focos mutuamente excluyentes (línea roja)'
            )}
          </>
        )}
        <div className="mx-1 h-6 w-px bg-hoi-border" />
        <button
          className="btn disabled:opacity-40"
          title="Deshacer (Ctrl+Z)"
          disabled={!canUndo}
          onClick={() => store.undo()}
        >
          <Undo2 size={16} />
        </button>
        <button
          className="btn disabled:opacity-40"
          title="Rehacer (Ctrl+Y)"
          disabled={!canRedo}
          onClick={() => store.redo()}
        >
          <Redo2 size={16} />
        </button>
        <div className="flex-1" />
        <span className="text-sm text-emerald-400">{status}</span>
        <button className="btn" title="Ajustes" onClick={() => setShowSettings(true)}>
          <Settings size={16} />
        </button>
        <button className="btn" onClick={() => void save()} title="Ctrl+S">
          <Save size={16} /> Guardar
        </button>
        <button className="btn-primary" onClick={startExport}>
          <Download size={16} /> Exportar mod
        </button>
      </header>

      {/* Pestañas */}
      <nav className="flex shrink-0 border-b border-hoi-border bg-hoi-panel px-2">
        {tabBtn('focos', 'Árbol de focos')}
        {tabBtn('paises', `Países (${project.countries.length})`)}
        {tabBtn('ideas', `Espíritus nacionales (${project.ideas.length})`)}
        {tabBtn('iconos', `Biblioteca de íconos (${project.icons.length})`)}
      </nav>

      {tab === 'paises' && (
        <div className="min-h-0 flex-1">
          <CountriesTab project={project} onOpenWizard={(uid, step) => setWizard({ uid, step })} />
        </div>
      )}
      {tab === 'ideas' && (
        <div className="min-h-0 flex-1">
          <IdeasTab project={project} />
        </div>
      )}
      {tab === 'iconos' && (
        <div className="min-h-0 flex-1">
          <LibraryTab project={project} />
        </div>
      )}

      {/* El árbol se mantiene montado (Blockly no se reinicia al cambiar de pestaña) */}
      <div className={tab === 'focos' ? 'flex min-h-0 flex-1 flex-col' : 'hidden'}>
        {/* Parte de arriba: árbol + panel del foco */}
        <div className="flex min-h-0 flex-[55]">
          <div className="min-w-0 flex-1">
            <FocusCanvas
              project={project}
              focuses={treeFocuses}
              selected={selected}
              tool={tool}
              onSelect={setSelected}
              onMove={(uid, x, y) =>
                change((p) => updateFocus(p, uid, { x, y }), { group: `drag:${uid}` })
              }
              onLink={onLink}
              onUnlinkPrereq={(a, b) => change((p) => togglePrerequisite(p, a, b))}
              onUnlinkExclusive={(a, b) => change((p) => toggleExclusive(p, a, b))}
              onAddAt={addFocusAt}
              onDelete={removeFocus}
            />
          </div>
          <aside className="flex min-h-0 w-80 flex-col border-l border-hoi-border bg-hoi-panel">
            <FocusPanel
              project={project}
              focus={selectedFocus}
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
            <PreviewPanel project={project} treeId={activeTree} />
          </aside>
        </div>
      </div>

      {wizard && (
        <CountryWizard
          project={project}
          countryUid={wizard.uid}
          initialStep={wizard.step}
          onClose={() => setWizard(null)}
        />
      )}
      {issues && (
        <ValidationDialog
          issues={issues}
          onClose={() => setIssues(null)}
          onExportAnyway={() => void doExport()}
          onSelectFocus={(uid) => {
            setSelected(uid)
            setTab('focos')
          }}
        />
      )}
      {showSettings && <SettingsDialog onClose={() => setShowSettings(false)} />}
    </div>
  )
}
