// Archivo → Propiedades del proyecto: la plantilla se ve aquí (no se cambia desde el mapa).
// Opción avanzada: "Reiniciar el mapa con otra plantilla" (confirma, borra lo pintado y se
// puede deshacer).
import { useEffect, useState } from 'react'
import { store, useApp } from '../store/appStore'
import { TEMPLATES, templateInfo, templateOf } from '../templates'
import { paintedCount, resetMapWithTemplate } from '../map/resetMap'
import type { MapModRef, TemplateId } from '../types'
import Modal from './Modal'
import { modDestination, syncEnabled, type ModDestination } from '../export/modSync'

interface InstalledMod extends MapModRef {
  source: string
}

export default function ProjectPropsDialog(): JSX.Element | null {
  const project = useApp((s) => s.project)
  const filePath = useApp((s) => s.filePath)
  const gamePath = useApp((s) => s.gamePath)
  const [reset, setReset] = useState(false)
  const [tpl, setTpl] = useState<TemplateId>('blank')
  const [mods, setMods] = useState<InstalledMod[] | null>(null)
  const [mod, setMod] = useState<MapModRef | null>(null)
  useEffect(() => {
    if (!reset || tpl !== 'mod' || !gamePath) return
    void window.electronAPI?.listMods(gamePath).then(setMods)
  }, [reset, tpl, gamePath])
  const [dest, setDest] = useState<ModDestination | null | undefined>(undefined)
  useEffect(() => {
    if (project) void modDestination(project).then(setDest)
  }, [project?.modName, project?.modSync?.dest]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!project) return null
  const setSync = (patch: Partial<NonNullable<typeof project.modSync>>): void =>
    store.updateProject((p) => ({
      ...p,
      modSync: { enabled: p.modSync?.enabled ?? true, dest: p.modSync?.dest ?? null, ...patch }
    }))
  const close = (): void => store.set({ propsDialog: false })
  const t = templateInfo(templateOf(project))
  const n = paintedCount(project)
  const mapTemplates = TEMPLATES.filter((x) => x.category === 'mapa')

  return (
    <Modal
      title="Propiedades del proyecto"
      width={560}
      onClose={close}
      footer={
        <button className="btn" onClick={close}>
          Cerrar
        </button>
      }
    >
      <dl className="grid grid-cols-[130px_1fr] gap-y-1 text-sm">
        <dt className="text-hoi-muted">Nombre</dt>
        <dd>{project.modName}</dd>
        <dt className="text-hoi-muted">Plantilla</dt>
        <dd>
          {t.name}
          {project.mapSettings.mod && ` (${project.mapSettings.mod.name})`}
        </dd>
        <dt className="text-hoi-muted">Archivo</dt>
        <dd className="break-all">{filePath ?? 'Sin guardar todavía'}</dd>
        <dt className="text-hoi-muted">Estados pintados</dt>
        <dd>{n}</dd>
      </dl>
      <div className="mt-4 border-t border-hoi-border pt-3">
        <div className="text-xs font-semibold uppercase text-hoi-muted">Destino del mod</div>
        {dest === undefined ? (
          <p className="mt-1 text-xs text-hoi-muted">Buscando la carpeta de mods…</p>
        ) : dest ? (
          <dl className="mt-1 grid grid-cols-[70px_1fr] gap-y-1 text-xs">
            <dt className="text-hoi-muted">Carpeta</dt>
            <dd className="break-all font-mono">{dest.folder}</dd>
            <dt className="text-hoi-muted">Archivo</dt>
            <dd className="break-all font-mono">{dest.file}</dd>
          </dl>
        ) : (
          <p className="mt-1 text-xs text-yellow-300">
            No se encontró la carpeta de mods de HOI4 (Documentos/Paradox Interactive/Hearts of Iron
            IV). Elige una carpeta o abre el juego una vez para que la cree.
          </p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            className="btn text-xs"
            onClick={async () => {
              const d = await window.electronAPI?.selectFolder()
              if (d) setSync({ dest: d })
            }}
          >
            Cambiar carpeta de mods…
          </button>
          {project.modSync?.dest && (
            <button className="btn text-xs" onClick={() => setSync({ dest: null })}>
              Usar la automática
            </button>
          )}
        </div>
        <label className="mt-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={syncEnabled(project, dest ?? null)}
            disabled={!dest}
            onChange={(e) => setSync({ enabled: e.target.checked })}
          />
          Actualizar el mod del juego al guardar
        </label>
      </div>
      <p className="mt-3 text-xs text-hoi-muted">
        La plantilla se elige al crear el proyecto y queda fija. Para usar otra plantilla sin tocar
        este proyecto, usa Mapa → "Nuevo proyecto con otra plantilla…".
      </p>
      <div className="mt-4 border-t border-hoi-border pt-3">
        <div className="text-xs font-semibold uppercase text-hoi-muted">Avanzado</div>
        {!reset ? (
          <button className="btn mt-2 text-xs" onClick={() => setReset(true)}>
            Reiniciar el mapa con otra plantilla…
          </button>
        ) : (
          <div className="mt-2 flex flex-col gap-1 text-sm">
            {mapTemplates.map((x) => (
              <label key={x.id} className="flex items-center gap-2">
                <input type="radio" checked={tpl === x.id} onChange={() => setTpl(x.id)} />
                {x.name}
              </label>
            ))}
            {tpl === 'mod' && (
              <div className="max-h-28 overflow-y-auto rounded border border-hoi-border">
                {(mods ?? []).map((m) => (
                  <button
                    key={m.path}
                    onClick={() =>
                      setMod({ path: m.path, name: m.name, replacePaths: m.replacePaths })
                    }
                    className={`block w-full px-2 py-1 text-left text-xs hover:bg-hoi-card ${mod?.path === m.path ? 'bg-hoi-accent/20' : ''}`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            )}
            <button
              className="btn-primary mt-1 self-start text-xs disabled:opacity-40"
              disabled={tpl === 'mod' && !mod}
              onClick={async () => {
                close()
                await resetMapWithTemplate(tpl, tpl === 'mod' ? mod : null)
              }}
            >
              Reiniciar el mapa
            </button>
          </div>
        )}
      </div>
    </Modal>
  )
}
