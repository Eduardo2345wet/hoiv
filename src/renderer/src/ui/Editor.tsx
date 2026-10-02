// Pantalla principal: barra superior, pestañas (focos, espíritus, biblioteca),
// lienzo, panel del foco, bloques y vista previa
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FocusScripts, Project } from '../types'
import { store, useApp } from '../store/appStore'
import FocusCanvas from './FocusCanvas'
import FocusPanel from './FocusPanel'
import BlocklyEditor from './BlocklyEditor'
import PreviewPanel from './PreviewPanel'
import ValidationDialog from './ValidationDialog'
import IdeasTab from './IdeasTab'
import CountriesTab from './CountriesTab'
import TreeSelector from './TreeSelector'
import MapTab from './map/MapTab'
import CountryWizard from './wizard/CountryWizard'
import LibraryTab from './LibraryTab'
import Navigator from './Navigator'
import Overlay from './Overlay'
import { Z } from './layers'
import { registerCommands } from './commands'
import SectionScreen from './SectionScreen'
import './EventsScreen'
import './SuperEventsScreen'
import './DecisionsScreen'
import { sectionById } from '../sections/ui'
import { autoLayout, dropFocus, repairTree } from '../focus/layout'
import { validateProject, type Issue } from '../export/validator'
import { exportMod } from '../export/exportMod'
import { moveReport } from '../map/capitals'
import { ignoreIssue, isIgnored, unignoreIssue } from '../export/ignore'
import { planStateExport, type StateExportPlan } from '../export/statesExport'
import { giveTreeToChosenCountry } from './countryFlow'
import { colorForTag } from '../countries/countryOps'
import { suggestTag } from '../countries/tags'
import { createQuickCountry } from '../map/quickCountry'
import {
  connectExclusive,
  connectPrerequisite,
  createFocus,
  createFocusBelow,
  exclusiveError,
  prerequisiteError,
  createIdea,
  deleteFocus,
  renameFocusAuto,
  renameIdeaAuto,
  toggleExclusive,
  togglePrerequisite,
  updateFocus
} from './projectOps'

type Tab = 'focos' | 'mapa' | 'paises' | 'ideas' | 'iconos'

export default function Editor(): JSX.Element {
  const project = useApp((s) => s.project) as Project
  const selected = useApp((s) => s.selectedUid)
  const game = useApp(() => store.catalogGame())
  // La vista la decide la pestaña de la cinta (Inicio y Exportar conservan la vista de antes)
  const ribbon = useApp((s) => s.ui.ribbon)
  const lastView = useRef<Tab>('focos')
  const sectionDef = sectionById(ribbon)
  const tab: Tab = (['mapa', 'focos', 'paises', 'ideas', 'iconos'] as string[]).includes(ribbon)
    ? (ribbon as Tab)
    : lastView.current
  lastView.current = tab
  const setTab = (t: Tab): void => store.setUi({ ribbon: t })
  // El mapa se monta la primera vez que se abre y luego se mantiene (no se recarga)
  const [mapMounted, setMapMounted] = useState(false)
  useEffect(() => {
    if (tab === 'mapa') setMapMounted(true)
  }, [tab])
  // "🗺 Elegir en el mapa…": abrir la pestaña Mapa y volver a donde estaba al terminar
  const statePick = useApp((s) => s.pick?.kind === 'state')
  const prevTab = useRef<Tab | null>(null)
  useEffect(() => {
    if (statePick && tab !== 'mapa') {
      prevTab.current = tab
      setTab('mapa')
    } else if (!statePick && prevTab.current) {
      setTab(prevTab.current)
      prevTab.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statePick])
  const liveIssues = useMemo(
    () =>
      tab === 'mapa'
        ? validateProject(project, game, { map: store.get().map, gamePath: store.get().gamePath })
        : [],
    [tab, project, game]
  )
  const lastValidatorMessage =
    (liveIssues.find((i) => i.severity === 'error') ?? liveIssues[0])?.message ??
    'Validador: sin problemas'
  const tool = useApp((s) => s.ui.focusTool)
  const setTool = (t: 'select' | 'prereq' | 'exclusive'): void => store.setUi({ focusTool: t })
  const [issues, setIssues] = useState<Issue[] | null>(null)

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

  // ---- Atajos de edición: Ctrl+Z deshacer, Ctrl+Y / Ctrl+Shift+Z rehacer ----
  // (Ctrl+N/O/S/W y Ctrl+Tab los maneja la ventana principal)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
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
  }, [])

  // ---- Exportar ----
  // Estados del mapa ya parchados (se preparan al validar y se usan al exportar)
  const statePlan = useRef<StateExportPlan>({ files: [], errors: [] })
  const [exportProgress, setExportProgress] = useState<{
    done: number
    total: number
    message: string
  } | null>(null)
  const doExport = async (): Promise<void> => {
    setIssues(null)
    const res = await exportMod(project, statePlan.current.files)
    if (res.ok) {
      // Ventana final: informe de capitales movidas + Revisar mod instalado (solo lectura)
      const moved = (statePlan.current.moves ?? []).filter((m) => m.to !== null).map(moveReport)
      store.set({
        reviewDialog: { modName: project.modName, folder: res.folder ?? null, moves: moved }
      })
    } else if (res.message !== 'Exportación cancelada.')
      store.toast('❌ ' + res.message, { kind: 'error' })
  }
  const startExport = async (validateOnly = false): Promise<void> => {
    const { map, gamePath } = store.get()
    // Parche de los estados modificados (solo mapa real); sus errores van al validador
    try {
      statePlan.current = await planStateExport(
        project,
        map,
        gamePath,
        (p) => setExportProgress({ ...p, message: 'Preparando los archivos de estado…' }),
        store.catalogGame()
      )
    } finally {
      setExportProgress(null)
    }
    // Índice de archivos del juego: la exportación nunca pisa uno con el mismo nombre
    const gameFiles = gamePath
      ? new Set(await window.electronAPI?.listGameFiles?.(gamePath).catch(() => [] as string[]))
      : undefined
    const found = validateProject(
      project,
      game,
      {
        map,
        gamePath,
        patchErrors: statePlan.current.errors,
        capitalErrors: statePlan.current.capitalErrors,
        gameTags: game?.countries.map(([t]) => t)
      },
      { gameFiles }
    )
    // Los avisos ignorados no detienen la exportación
    const pending = found.filter((i) => !isIgnored(store.get().project!, i))
    if (pending.length) setIssues(found)
    else if (validateOnly) store.toast('Validador: sin problemas')
    else void doExport()
  }

  // ---- Acciones del árbol ----
  /**
   * Antes del PRIMER foco hace falta un árbol, y todo árbol es de un país: se pregunta de cuál
   * (o se avisa si todavía no hay países). Devuelve el id del árbol a usar o null.
   */
  const ensureTree = async (): Promise<string | null | undefined> => {
    if (activeTree) return activeTree
    const p = store.get().project!
    if (p.focusTrees.length) return p.focusTrees[0].id
    return await giveTreeToChosenCountry()
  }
  const addFocusAt = async (x: number, y: number): Promise<void> => {
    const tree = await ensureTree()
    if (tree === null) return
    let uid = ''
    change((p) => {
      const r = createFocus(p, x, y, undefined, tree ?? undefined)
      uid = r.focus.uid
      return r.project
    })
    setSelected(uid)
    setTool('select')
  }
  const addFocus = async (): Promise<void> => {
    const tree = await ensureTree()
    if (tree === null) return
    let uid = ''
    change((p) => {
      const r = createFocusBelow(p, selected, undefined, tree ?? undefined)
      uid = r.focus.uid
      return r.focus.treeId ? repairTree(r.project, r.focus.treeId) : r.project
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
  // Orden automático al crear y conectar (activado por defecto): dentro del mismo paso de deshacer
  const [animating, setAnimating] = useState(false)
  const arrange = (p: Project, treeId: string | undefined): Project => {
    if (!treeId || p.treeSettings?.autoArrange === false) return p
    setAnimating(true)
    setTimeout(() => setAnimating(false), 300)
    return autoLayout(p, treeId)
  }
  const arrangeNow = (): void => {
    const t = activeTree ?? store.get().project?.focusTrees[0]?.id
    if (!t) return
    setAnimating(true)
    setTimeout(() => setAnimating(false), 300)
    change((p) => autoLayout(p, t))
  }
  /** Conecta con un solo paso de deshacer; si no se puede, un aviso explica por qué */
  const onLink = (kind: 'prereq' | 'excl', from: string, to: string): string | null => {
    const cur = store.get().project!
    const r =
      kind === 'prereq' ? connectPrerequisite(cur, from, to) : connectExclusive(cur, from, to)
    if (typeof r === 'string') {
      store.toast(r, { kind: 'error' })
      return r
    }
    change(() => arrange(r, store.get().project!.focuses.find((f) => f.uid === from)?.treeId))
    return null
  }
  const canLink = (kind: 'prereq' | 'excl', from: string, to: string): string | null =>
    kind === 'prereq'
      ? prerequisiteError(store.get().project!, from, to)
      : exclusiveError(store.get().project!, from, to)
  const addChildOf = (uid: string): void => {
    let created = ''
    change((p) => {
      const r = createFocusBelow(p, uid)
      created = r.focus.uid
      const linked = connectPrerequisite(r.project, uid, created)
      return arrange(typeof linked === 'string' ? r.project : linked, r.focus.treeId)
    })
    setSelected(created)
  }
  const onBlocksChange = useCallback(
    (uid: string, blocks: unknown, scripts: FocusScripts) =>
      store.updateBlocks(uid, { blocks, scripts }),
    []
  )

  // ---- Comandos de la cinta ----
  const latest = useRef({ startExport, addFocus, arrangeNow })
  latest.current = { startExport, addFocus, arrangeNow }
  useEffect(
    () =>
      registerCommands({
        exportMod: () => void latest.current.startExport(),
        validate: () => void latest.current.startExport(true),
        focusAdd: () => void latest.current.addFocus(),
        focusArrange: () => latest.current.arrangeNow(),
        countryNew: () => setWizard({}),
        countryQuick: () =>
          store.openPrompt({
            message: 'Nombre del país nuevo',
            defaultValue: '',
            validate: (t) => (t.trim() ? null : 'Escribe un nombre'),
            callback: (name) => {
              if (!name) return
              const taken = [
                ...store.get().project!.countries.map((c) => c.tag),
                ...(store.catalogGame()?.countries.map(([t]) => t) ?? [])
              ]
              const tag = suggestTag(name, taken)
              createQuickCountry(name.trim(), tag, colorForTag(tag))
            }
          }),
        ideaNew: () => {
          change((p) => createIdea(p).project)
          setTab('ideas')
        }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  )
  // Pedidos de abrir el asistente desde el Navegador
  const wizardReq = useApp((s) => s.wizardRequest)
  useEffect(() => {
    if (wizardReq) setWizard({ uid: wizardReq.uid, step: wizardReq.step })
  }, [wizardReq])

  return (
    <div className="relative flex min-h-0 flex-1 bg-hoi-bg" style={{ zIndex: Z.panels }}>
      <Navigator project={project} />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {sectionDef && (
          <div className="absolute inset-0 z-20 bg-hoi-bg">
            <SectionScreen def={sectionDef} project={project} />
          </div>
        )}
        {mapMounted && (
          <div className={tab === 'mapa' ? 'min-h-0 flex-1' : 'hidden'}>
            <MapTab
              project={project}
              onOpenWizard={(uid, step) => setWizard({ uid, step })}
              onGoTab={setTab}
              lastValidatorMessage={lastValidatorMessage}
            />
          </div>
        )}
        {tab === 'paises' && (
          <div className="min-h-0 flex-1">
            <CountriesTab
              project={project}
              onOpenWizard={(uid, step) => setWizard({ uid, step })}
            />
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
          <div className="flex shrink-0 items-center gap-2 border-b border-hoi-border bg-hoi-panel px-3 py-1">
            <TreeSelector project={project} activeTreeId={activeTree} />
            {(() => {
              const c = project.countries.find((x) => x.focusTreeId === activeTree)
              return c?.mode === 'existente' && game?.focusTreeTags?.[c.tag] !== undefined ? (
                <span className="text-xs text-sky-300">
                  ℹ Este árbol reemplazará el árbol original de {c.names.name || c.tag}.
                </span>
              ) : null
            })()}
          </div>
          {/* Parte de arriba: árbol + panel del foco */}
          <div className="flex min-h-0 flex-[55]">
            <div className="min-w-0 flex-1">
              <FocusCanvas
                project={project}
                focuses={treeFocuses}
                selected={selected}
                tool={tool}
                onSelect={setSelected}
                onPlace={(uid, gx, gy, opts) => change((p) => dropFocus(p, uid, gx, gy, opts))}
                onTogglePin={(uid) =>
                  change((p) =>
                    updateFocus(p, uid, { pinned: !p.focuses.find((f) => f.uid === uid)?.pinned })
                  )
                }
                animate={animating}
                onLink={onLink}
                canLink={canLink}
                onAddChild={addChildOf}
                onTool={setTool}
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
      </div>

      {wizard && (
        <CountryWizard
          project={project}
          countryUid={wizard.uid}
          initialStep={wizard.step}
          onClose={() => setWizard(null)}
        />
      )}
      {exportProgress && (
        <Overlay>
          <div className="w-96 rounded-lg border border-hoi-border bg-hoi-panel p-4 shadow-2xl">
            <div className="mb-2 text-sm">{exportProgress.message}</div>
            <div className="h-3 overflow-hidden rounded bg-hoi-card">
              <div
                className="h-full bg-hoi-accent transition-all"
                style={{
                  width: `${(exportProgress.done / Math.max(1, exportProgress.total)) * 100}%`
                }}
              />
            </div>
            <div className="mt-1 text-xs text-hoi-muted">
              {exportProgress.done} de {exportProgress.total} archivos
            </div>
          </div>
        </Overlay>
      )}
      {issues && (
        <ValidationDialog
          issues={issues}
          ignoredKeys={project.ignoredIssues}
          onIgnore={(i, ign) => change((p) => (ign ? ignoreIssue(p, i) : unignoreIssue(p, i)))}
          onClose={() => setIssues(null)}
          onExportAnyway={() => void doExport()}
          onFix={(i) => {
            const gameFocus = new Set(game?.focusIds ?? [])
            const gameIdeas = new Set((game?.ideas ?? []).map(([id]) => id))
            if (i.fix === 'rename-focus' && i.focusUid)
              change((p) => renameFocusAuto(p, i.focusUid!, gameFocus))
            if (i.fix === 'rename-idea' && i.ideaUid)
              change((p) => renameIdeaAuto(p, i.ideaUid!, gameIdeas))
            setIssues((cur) => (cur ? cur.filter((x) => x !== i) : cur))
            store.toast('ID renombrado (con sus referencias).')
          }}
          onGoPending={() => {
            setTab('mapa')
            store.set({ pendingView: true })
          }}
          onGoState={(id) => {
            setTab('mapa')
            store.focusState(id)
          }}
          onGoCountry={(uid, step) => {
            setTab('paises')
            setWizard({ uid, step })
          }}
          onSelectFocus={(uid) => {
            // Mostrar el árbol del foco con el problema
            const tree = project.focuses.find((f) => f.uid === uid)?.treeId
            if (tree) store.set({ activeTreeId: tree })
            setSelected(uid)
            setTab('focos')
          }}
        />
      )}
    </div>
  )
}
