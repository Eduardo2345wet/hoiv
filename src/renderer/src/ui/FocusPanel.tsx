// Panel lateral con los datos del foco seleccionado
import { Trash2 } from 'lucide-react'
import type { Focus, Project } from '../types'
import { ID_REGEX } from '../export/validator'
import { store } from '../store/appStore'
import { renameFocusId, setFocusName, updateFocus } from './projectOps'
import IconField from './IconField'
import Help from './Help'

interface Props {
  project: Project
  focus: Focus | null
  onDelete: () => void
}

/** Nombres de los focos enlazados, o "Ninguno" */
function NameChips({ project, uids }: { project: Project; uids: string[] }): JSX.Element {
  const names = uids
    .map((u) => project.focuses.find((f) => f.uid === u))
    .filter((f): f is Focus => !!f)
  if (!names.length) return <p className="text-xs text-hoi-muted">Ninguno</p>
  return (
    <div className="flex flex-wrap gap-1">
      {names.map((f) => (
        <span key={f.uid} className="rounded bg-hoi-card px-2 py-0.5 text-xs">
          {f.name || 'Foco sin nombre'}
        </span>
      ))}
    </div>
  )
}

export default function FocusPanel({ project, focus, onDelete }: Props): JSX.Element {
  if (!focus)
    return (
      <div className="p-4 text-sm text-hoi-muted">
        Ningún foco seleccionado.
        <br />
        <br />
        Haz doble clic en la cuadrícula para crear uno.
      </div>
    )

  const uid = focus.uid
  // group: escribir en un campo cuenta como UN paso de deshacer
  const patch = (p: Partial<Focus>, field = Object.keys(p)[0]): void =>
    store.updateProject((pr) => updateFocus(pr, uid, p), { group: `field:${uid}:${field}` })
  const idOk = ID_REGEX.test(focus.id)
  const dup = project.focuses.some((f) => f.uid !== uid && f.id === focus.id)
  const int = (v: string): number => Math.max(0, Math.round(Number(v)))

  return (
    <>
      {/* Encabezado fijo */}
      <h2 className="shrink-0 border-b border-hoi-border px-4 py-2 font-medium text-hoi-text">
        Foco seleccionado
      </h2>
      {/* Contenido con scroll vertical */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        <div>
          <label className="label">Nombre</label>
          <input
            data-focus-name
            className="input"
            value={focus.name}
            onChange={(e) =>
              store.updateProject((p) => setFocusName(p, uid, e.target.value), {
                group: `field:${uid}:name`
              })
            }
          />
        </div>

        <div>
          <label className="label">ID (interno, sin espacios)</label>
          <input
            className={`input font-mono ${idOk && !dup ? '' : 'border-red-500'}`}
            value={focus.id}
            onChange={(e) =>
              store.updateProject(
                (p) => renameFocusId(p, uid, e.target.value.replace(/\s/g, '_')),
                {
                  group: `field:${uid}:id`
                }
              )
            }
          />
          {!idOk && (
            <p className="mt-1 text-xs text-red-400">Solo letras sin tildes, números y _</p>
          )}
          {dup && <p className="mt-1 text-xs text-red-400">Ya hay otro foco con este id</p>}
          <p className="mt-1 text-[10px] text-hoi-muted">
            Al cambiarlo se actualizan sus referencias en los bloques.
          </p>
        </div>

        <IconField
          project={project}
          target="focus"
          ownerUid={uid}
          ownerName={focus.name}
          icon={focus.icon}
          iconAuto={focus.iconAuto}
        />

        <div>
          <label className="label">Descripción</label>
          <textarea
            className="input h-20 resize-none"
            value={focus.description}
            onChange={(e) => patch({ description: e.target.value })}
          />
        </div>

        <div>
          <label className="label">Costo (semanas)</label>
          <input
            type="number"
            min={1}
            className="input"
            value={focus.cost}
            onChange={(e) => patch({ cost: int(e.target.value) })}
          />
          <p className="mt-1 text-xs text-hoi-muted">= {focus.cost * 7} días en el juego</p>
        </div>

        <div className="flex gap-2">
          <div className="flex-1">
            <label className="label">Posición X</label>
            <input
              type="number"
              min={0}
              className="input"
              value={focus.x}
              onChange={(e) => patch({ x: int(e.target.value) })}
            />
          </div>
          <div className="flex-1">
            <label className="label">Posición Y</label>
            <input
              type="number"
              min={0}
              className="input"
              value={focus.y}
              onChange={(e) => patch({ y: int(e.target.value) })}
            />
          </div>
        </div>

        <div data-focus-links className="space-y-2">
          <div>
            <div className="label">
              Se necesita antes
              <Help id="foco.prerrequisito" />
            </div>
            <NameChips project={project} uids={focus.prerequisites} />
          </div>
          <div>
            <div className="label">
              Excluyente con
              <Help id="foco.excluyente" />
            </div>
            <NameChips project={project} uids={focus.mutuallyExclusive} />
          </div>
          <div>
            <div className="label">
              Saltar si
              <Help id="foco.saltarSi" />
            </div>
            <p className="text-xs text-hoi-muted">
              {focus.scripts.bypass.trim()
                ? 'Tiene una condición para saltarlo.'
                : 'Sin condición. Se arma con bloques, abajo.'}
            </p>
          </div>
        </div>

        <button className="btn mt-2 justify-center text-red-400" onClick={onDelete}>
          <Trash2 size={16} /> Borrar foco
        </button>
      </div>
    </>
  )
}
