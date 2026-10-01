// Al guardar: actualiza el mod en la carpeta de mods de HOI4 sin copiar ni borrar nada a mano.
// Guarda el proyecto → valida → si NO hay errores sincroniza (solo cambios, borra lo que ya no se
// genera). Con errores, el proyecto SÍ se guarda pero el mod no cambia.
import type { Project } from '../types'
import { store } from '../store/appStore'
import { safeFolderName } from '../../../shared/names'
import { buildModPayload } from './exportMod'
import { planStateExport } from './statesExport'
import { validateProject } from './validator'
import { runCommand } from '../ui/commands'
import { withTechnicalCapital } from '../map/noNation'

export interface ModDestination {
  /** Carpeta de mods (…/Hearts of Iron IV/mod) */
  root: string
  /** <root>/<slug> */
  folder: string
  /** <root>/<slug>.mod */
  file: string
  /** true = la detectada automáticamente; false = la que eligió el usuario */
  auto: boolean
}

const join = (a: string, b: string): string => `${a.replace(/[\\/]+$/, '')}/${b}`

/** Destino del mod de un proyecto (null si no hay carpeta de mods) */
export async function modDestination(project: Project): Promise<ModDestination | null> {
  const api = window.electronAPI
  if (!api) return null
  const custom = project.modSync?.dest ?? null
  const root = custom ?? (await api.getModDestination()).modsRoot
  if (!root) return null
  const slug = safeFolderName(project.modName)
  return { root, folder: join(root, slug), file: join(root, `${slug}.mod`), auto: !custom }
}

/** ¿Hay que sincronizar al guardar? (por defecto sí cuando se detecta el juego) */
export const syncEnabled = (p: Project, dest: ModDestination | null): boolean =>
  !!dest && (p.modSync?.enabled ?? true)

const warnedUnknown = new Set<string>()

/** Corre después de guardar. No lanza: todo se avisa con toasts. */
export async function syncAfterSave(project: Project): Promise<void> {
  const api = window.electronAPI
  if (!api) return
  const dest = await modDestination(project)
  if (!syncEnabled(project, dest)) return
  const { map, gamePath } = store.get()
  const game = store.catalogGame()
  try {
    // 1) Validar (los avisos no bloquean; los errores sí)
    const p = withTechnicalCapital(project, map)
    const plan = await planStateExport(p, map, gamePath, () => {})
    const errors = validateProject(p, game, {
      map,
      gamePath,
      patchErrors: plan.errors,
      gameTags: game?.countries.map(([t]) => t)
    }).filter((i) => i.severity === 'error')
    if (errors.length) {
      store.toast(
        `No se actualizó el mod: ${errors.length} error${errors.length === 1 ? '' : 'es'}`,
        {
          kind: 'error',
          action: { label: 'Ver', run: () => runCommand('validate') }
        }
      )
      return
    }
    // 2) Armar y sincronizar
    const built = await buildModPayload(project, dest!.root, plan.files)
    if (!built.ok)
      return void store.toast(`No se actualizó el mod: ${built.message}`, { kind: 'error' })
    let res = await api.syncMod(built.payload)
    if (res.status === 'needs-confirm') {
      const a = await store.askUser({
        title: 'Carpeta del mod ya existente',
        message: `La carpeta ${dest!.folder} ya existe, tiene archivos y no la creó esta app. ¿Quieres usarla para este mod? (No se borrará nada que no genere la app.)`,
        buttons: [
          { label: 'Usar esta carpeta', value: 'ok', primary: true },
          { label: 'No actualizar', value: 'no' }
        ]
      })
      if (a !== 'ok') return void store.toast('No se actualizó el mod (carpeta sin usar).')
      res = await api.syncMod(built.payload, true)
    }
    if (res.status !== 'ok')
      return void store.toast(res.error ?? 'No se pudo actualizar el mod.', { kind: 'error' })
    const running = await api.isHoi4Running()
    store.toast(
      `Mod actualizado en el juego: ${res.modFolder}` +
        (running ? '\nHOI4 está abierto: los cambios se verán al volver a cargar el juego.' : ''),
      { action: { label: 'Abrir carpeta', run: () => void api.openFolder(res.modFolder!) } }
    )
    if (res.unknown.length && !warnedUnknown.has(dest!.folder)) {
      warnedUnknown.add(dest!.folder)
      store.toast(
        `La carpeta del mod tiene ${res.unknown.length} archivo(s) que no son de la app (se dejan como están).`
      )
    }
    if (res.firstTime)
      await store.askUser({
        title: 'Activa el mod en el launcher',
        message:
          'Activa este mod UNA vez en el launcher de HOI4 (Playsets). Después, cada vez que guardes se actualizará solo.',
        buttons: [{ label: 'Entendido', value: 'ok', primary: true }]
      })
  } catch (e) {
    store.toast(`No se actualizó el mod: ${e instanceof Error ? e.message : String(e)}`, {
      kind: 'error'
    })
  }
}
