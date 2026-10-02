// Ventana principal tipo Siemens NX: cinta arriba, pestañas de documentos, navegador del
// proyecto a la izquierda, área de trabajo (vacía hasta abrir un proyecto) y barra de estado.
import { useEffect } from 'react'
import { store, useApp } from './store/appStore'
import Ribbon from './ui/Ribbon'
import DocTabs from './ui/DocTabs'
import HomePage from './ui/HomePage'
import StatusBar from './ui/StatusBar'
import Editor from './ui/Editor'
import NewProjectDialog from './ui/NewProjectDialog'
import ProjectPropsDialog from './ui/ProjectPropsDialog'
import SettingsDialog from './ui/SettingsDialog'
import AskDialog from './ui/AskDialog'
import ExportDialog from './ui/ExportDialog'
import IdeaPicker from './ui/IdeaPicker'
import IdeaCopyDialog from './ui/IdeaCopyDialog'
import InstalledReviewDialog from './ui/InstalledReviewDialog'
import CountryPicker from './ui/CountryPicker'
import PromptDialog from './ui/PromptDialog'
import ToastHost from './ui/ToastHost'
import { loadGameSettings } from './ui/SettingsDialog'
import { registerCommands, runCommand } from './ui/commands'
import {
  dirOf,
  closeTabAsk,
  confirmCloseAll,
  openContent,
  openWithDialog,
  saveActive
} from './ui/fileOps'
import { setIconRenderer, setPlaceholderRenderers } from './icons/renderer'
import {
  drawFlagPlaceholder,
  drawPlainFlag,
  drawPortraitPlaceholder
} from './countries/placeholders'
import { renderEmojiToPng } from './icons/canvasRender'

// Los íconos con emoji se dibujan con canvas (solo en la interfaz)
setIconRenderer(renderEmojiToPng)
// Bandera y retrato de relleno de los países
setPlaceholderRenderers({
  flag: drawFlagPlaceholder,
  portrait: drawPortraitPlaceholder,
  plain: drawPlainFlag
})

let restored = false

export default function App(): JSX.Element {
  const hasProject = useApp((s) => !!s.project)
  const activeTab = useApp((s) => s.activeTabId)
  const newDialog = useApp((s) => s.newProjectDialog)
  const propsDialog = useApp((s) => s.propsDialog)
  const settingsDialog = useApp((s) => s.settingsDialog)
  useApp((s) => s.tabs)
  useApp((s) => s.filePath)

  useEffect(() => {
    void (async () => {
      await loadGameSettings()
      // Volver a abrir las pestañas que había al cerrar (opcional en Ajustes; sí por defecto)
      const api = window.electronAPI
      if (!api || restored) return
      restored = true
      const s = await api.getSettings()
      if (s.restoreTabs === false) return
      for (const path of s.openTabs ?? []) {
        const r = await api.openProjectPath(path)
        if (r) openContent(r.path, r.content)
      }
    })()
    // Salir de un campo de texto cierra su paso de deshacer
    const onFocusOut = (): void => store.endGroup()
    window.addEventListener('focusout', onFocusOut)
    const off = registerCommands({
      fileSave: () => void saveActive(),
      fileSaveAs: () => void saveActive(true),
      fileOpen: () => void openWithDialog(),
      openProjectFolder: () => {
        const fp = store.get().filePath
        if (fp) void window.electronAPI?.openFolder(dirOf(fp))
        else store.toast('Este proyecto todavía no se ha guardado.')
      },
      // Abre la carpeta donde se exportó el mod la última vez (la app no escribe en el juego)
      reviewInstalled: () => {
        const p = store.get().project
        if (p) store.set({ reviewDialog: { modName: p.modName, folder: null, moves: [] } })
      },
      openModFolder: () => {
        void window.electronAPI?.getExportInfo().then((i) => {
          void window.electronAPI?.openFolder(i.lastDir ?? i.defaultDir)
        })
      }
    })
    // Cerrar la ventana: una sola pregunta con los proyectos sin guardar
    const offClose = window.electronAPI?.onCloseRequest(() => {
      void window.electronAPI?.ackCloseRequest()
      void confirmCloseAll().then((ok) => {
        if (ok) void window.electronAPI?.confirmClose()
      })
    })
    return () => {
      window.removeEventListener('focusout', onFocusOut)
      off()
      offClose?.()
    }
  }, [])

  // Recordar las pestañas abiertas (las que tienen archivo)
  useEffect(() => {
    if (!restored) return
    const paths = store
      .listTabs()
      .map((t) => t.filePath)
      .filter((p): p is string => !!p)
    void window.electronAPI?.setSettings({ openTabs: paths })
  })

  // Recientes de ideas y estados (guardados en los ajustes)
  useEffect(() => {
    void window.electronAPI
      ?.getSettings()
      .then((st) =>
        store.set({ recentIdeas: st.recentIdeas ?? [], recentStates: st.recentStates ?? [] })
      )
  }, [])

  // Atajos de archivo y de pestañas
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (!(e.ctrlKey || e.metaKey)) return
      const k = e.key.toLowerCase()
      if (k === 'n') {
        e.preventDefault()
        store.set({ newProjectDialog: { name: '' } })
      } else if (k === 'o') {
        e.preventDefault()
        void openWithDialog()
      } else if (k === 's') {
        e.preventDefault()
        void saveActive(e.shiftKey)
      } else if (k === 'e') {
        e.preventDefault()
        runCommand('exportMod')
      } else if (k === 'w') {
        e.preventDefault()
        const id = store.get().activeTabId
        if (id) void closeTabAsk(id)
      } else if (e.key === 'Tab') {
        e.preventDefault()
        store.cycleTab(e.shiftKey ? -1 : 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex h-screen w-screen flex-col bg-hoi-bg">
      <Ribbon />
      <DocTabs />
      {/* Cada pestaña es un Editor propio: nada de su estado local pasa a otra pestaña */}
      <div className="flex min-h-0 flex-1 flex-col">
        {hasProject ? <Editor key={activeTab} /> : <HomePage />}
      </div>
      <StatusBar />
      {newDialog && <NewProjectDialog initialName={newDialog.name} />}
      {propsDialog && <ProjectPropsDialog />}
      <ExportDialog />
      <IdeaPicker />
      <IdeaCopyDialog />
      <InstalledReviewDialog />
      {settingsDialog && <SettingsDialog onClose={() => store.set({ settingsDialog: false })} />}
      <AskDialog />
      <CountryPicker />
      <PromptDialog />
      <ToastHost />
    </div>
  )
}
