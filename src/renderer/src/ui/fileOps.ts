// Archivo: guardar, abrir, recientes y cerrar pestañas (usado por la cinta, los atajos y la
// página de inicio).
import type { Project } from '../types'
import { store } from '../store/appStore'
import { migrateProject } from '../migrate'
import { templateOf } from '../templates'
import { safeFolderName } from '../../../shared/names'

const RECENT_MAX = 12
export interface RecentEntry {
  path: string
  name: string
  template: string
  date: string
}

/** Anota un proyecto en "Recientes" (más reciente primero, sin repetidos) */
export async function rememberRecent(project: Project, path: string): Promise<void> {
  const api = typeof window === 'undefined' ? undefined : window.electronAPI
  if (!api) return
  const s = await api.getSettings()
  const entry: RecentEntry = {
    path,
    name: project.modName,
    template: templateOf(project),
    date: new Date().toISOString()
  }
  const recent = [entry, ...(s.recent ?? []).filter((r) => r.path !== path)].slice(0, RECENT_MAX)
  await api.setSettings({ recent })
}

/** Carpeta de un archivo (con "/" o "\\") */
export const dirOf = (file: string): string => file.replace(/[\\/][^\\/]*$/, '')

/**
 * Guarda la pestaña activa. Pregunta dónde guardar: la primera vez, siempre con "Guardar como" y
 * con Ctrl+S si "Preguntar siempre dónde guardar" está activo (por defecto sí); el diálogo ya
 * trae la ubicación actual (con Enter se queda igual). Devuelve si se guardó.
 */
export async function saveActive(saveAs = false): Promise<boolean> {
  const api = window.electronAPI
  const s = store.get()
  if (!s.project) return false
  if (!api) {
    store.toast('Guardar solo funciona en la app de escritorio.', { kind: 'error' })
    return false
  }
  const json = JSON.stringify(s.project, null, 2)
  const settings = await api.getSettings()
  const ask = saveAs || !s.filePath || settings.askWhereToSave !== false
  let target = s.filePath
  if (ask) {
    const base =
      s.filePath ??
      `${await api.getProjectsDir()}/${safeFolderName(s.project.modName)}/proyecto.json`
    const res = await api.saveProjectDialog(json, base)
    if (!res) return false
    target = res
    store.set({ filePath: res })
  } else await api.saveProjectToPath(target!, json)
  store.set({ dirty: false })
  const fp = store.get().filePath!
  void rememberRecent(s.project, fp)
  store.toast(`Proyecto guardado en ${fp}`, {
    action: { label: 'Abrir carpeta', run: () => void api.openFolder(dirOf(fp)) }
  })
  return true
}

/** Abre un proyecto leído de disco en una pestaña nueva (migra los viejos) */
export function openContent(path: string, content: string): boolean {
  try {
    const p = migrateProject(JSON.parse(content))
    store.openInNewTab(p, path, templateOf(p) === 'content' ? 'focos' : 'mapa')
    void rememberRecent(p, path)
    return true
  } catch {
    store.toast('Ese archivo no es un proyecto válido de HOI4 Mod Studio.', { kind: 'error' })
    return false
  }
}

export async function openWithDialog(): Promise<void> {
  const res = await window.electronAPI?.openProjectDialog()
  if (res) openContent(res.path, res.content)
}

export async function openRecent(path: string): Promise<void> {
  const res = await window.electronAPI?.openProjectPath(path)
  if (!res) return void store.toast(`No se encontró el proyecto: ${path}`, { kind: 'error' })
  openContent(res.path, res.content)
}

/** Cierra una pestaña; si tiene cambios pregunta si guardar. Devuelve si se cerró. */
export async function closeTabAsk(id: string): Promise<boolean> {
  const t = store.listTabs().find((x) => x.id === id)
  if (!t) return false
  if (t.dirty) {
    store.switchTab(id)
    const a = await store.askUser({
      title: 'Cambios sin guardar',
      message: `"${t.name}" tiene cambios sin guardar. ¿Quieres guardarlos antes de cerrar?`,
      buttons: [
        { label: 'Guardar', value: 'save', primary: true },
        { label: 'No guardar', value: 'discard' },
        { label: 'Cancelar', value: 'cancel' }
      ]
    })
    if (a === 'cancel' || a === '') return false
    if (a === 'save' && !(await saveActive())) return false
  }
  store.closeTab(id)
  return true
}

/** Al cerrar la app: UNA pregunta con la lista de proyectos sin guardar. */
export async function confirmCloseAll(): Promise<boolean> {
  const dirty = store.listTabs().filter((t) => t.dirty)
  if (!dirty.length) return true
  const a = await store.askUser({
    title: 'Cambios sin guardar',
    message: 'Estos proyectos tienen cambios sin guardar:',
    items: dirty.map((t) => t.name),
    buttons: [
      { label: 'Guardar todo y salir', value: 'save', primary: true },
      { label: 'Salir sin guardar', value: 'discard' },
      { label: 'Cancelar', value: 'cancel' }
    ]
  })
  if (a === 'cancel' || a === '') return false
  if (a === 'save') {
    for (const t of dirty) {
      store.switchTab(t.id)
      if (!(await saveActive())) return false
    }
  }
  return true
}
