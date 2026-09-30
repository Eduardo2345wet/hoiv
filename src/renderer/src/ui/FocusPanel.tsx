// Panel de propiedades del foco seleccionado.

import { Trash2, X } from 'lucide-react'
import { GENERIC_ICONS } from '../model/icons'
import type { Focus, Project } from '../model/project'

interface Props {
  project: Project
  focus: Focus | null
  onChange: (uid: string, changes: Partial<Focus>) => void
  onDelete: (uid: string) => void
  onTogglePrerequisite: (parentUid: string, childUid: string) => void
  onToggleExclusive: (aUid: string, bUid: string) => void
}

const ID_REGEX = /^[A-Za-z0-9_]+$/

const inputClass =
  'w-full rounded border border-hoi-border bg-hoi-bg px-2 py-1 text-sm text-hoi-text outline-none focus:border-hoi-accent select-text'

function Label({ children }: { children: React.ReactNode }): JSX.Element {
  return <label className="mb-1 mt-3 block text-xs font-semibold text-hoi-muted">{children}</label>
}

export default function FocusPanel(props: Props): JSX.Element {
  const { project, focus } = props

  if (!focus) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-hoi-muted">
        Selecciona un foco en el árbol para editarlo, o pulsa «Añadir foco».
      </div>
    )
  }

  const byUid = new Map(project.foci.map((f) => [f.uid, f]))
  const nameOf = (uid: string): string => {
    const f = byUid.get(uid)
    return f ? f.name || f.id : '(foco borrado)'
  }
  const set = (changes: Partial<Focus>): void => props.onChange(focus.uid, changes)
  const idDuplicated = project.foci.some((f) => f.uid !== focus.uid && f.id === focus.id)
  const idInvalid = !ID_REGEX.test(focus.id)
  const iconInList = GENERIC_ICONS.some((i) => i.value === focus.icon)

  return (
    <div className="h-full overflow-y-auto p-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wide text-hoi-accent">Foco</h2>
        <button
          onClick={() => props.onDelete(focus.uid)}
          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-400 hover:bg-red-500/10"
        >
          <Trash2 size={14} /> Borrar
        </button>
      </div>

      <Label>Id (solo letras sin tilde, números y _)</Label>
      <input
        className={inputClass}
        value={focus.id}
        onChange={(e) => set({ id: e.target.value.replace(/\s/g, '_') })}
      />
      {idInvalid && <p className="mt-1 text-xs text-red-400">El id tiene caracteres no permitidos.</p>}
      {idDuplicated && <p className="mt-1 text-xs text-red-400">Ya hay otro foco con este id.</p>}

      <Label>Nombre (lo que ve el jugador)</Label>
      <input className={inputClass} value={focus.name} onChange={(e) => set({ name: e.target.value })} />

      <Label>Descripción</Label>
      <textarea
        className={inputClass + ' h-20 resize-none'}
        value={focus.description}
        onChange={(e) => set({ description: e.target.value })}
      />

      <Label>Costo (1 unidad = 7 días)</Label>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={0}
          step={1}
          className={inputClass + ' w-24'}
          value={focus.cost}
          onChange={(e) => set({ cost: Math.max(0, Number(e.target.value) || 0) })}
        />
        <span className="text-xs text-hoi-muted">= {Math.round(focus.cost * 7)} días</span>
      </div>

      <Label>Ícono</Label>
      <select
        className={inputClass}
        value={iconInList ? focus.icon : ''}
        onChange={(e) => e.target.value && set({ icon: e.target.value })}
      >
        {!iconInList && <option value="">Personalizado</option>}
        {GENERIC_ICONS.map((icon) => (
          <option key={icon.value} value={icon.value}>
            {icon.label}
          </option>
        ))}
      </select>
      <input
        className={inputClass + ' mt-1 font-mono text-xs'}
        value={focus.icon}
        onChange={(e) => set({ icon: e.target.value.trim() })}
        title="Nombre del ícono en el juego"
      />

      <Label>Posición en la cuadrícula</Label>
      <p className="text-xs text-hoi-text">
        x = {focus.x}, y = {focus.y}
      </p>

      <Label>Prerrequisitos</Label>
      {focus.prerequisites.length === 0 ? (
        <p className="text-xs text-hoi-muted">Ninguno. Usa el modo «Prerrequisito» del lienzo.</p>
      ) : (
        <>
          <ul className="space-y-1">
            {focus.prerequisites.map((uid) => (
              <li key={uid} className="flex items-center justify-between rounded bg-hoi-card px-2 py-1 text-xs">
                {nameOf(uid)}
                <button onClick={() => props.onTogglePrerequisite(uid, focus.uid)} title="Quitar">
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
          {focus.prerequisites.length > 1 && (
            <div className="mt-2 space-y-1 text-xs">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={focus.prerequisiteMode === 'all'}
                  onChange={() => set({ prerequisiteMode: 'all' })}
                />
                Hay que completar TODOS
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={focus.prerequisiteMode === 'any'}
                  onChange={() => set({ prerequisiteMode: 'any' })}
                />
                Basta con completar UNO (línea discontinua)
              </label>
            </div>
          )}
        </>
      )}

      <Label>Mutuamente excluyente con</Label>
      {focus.mutuallyExclusive.length === 0 ? (
        <p className="text-xs text-hoi-muted">Ninguno. Usa el modo «Excluyente» del lienzo.</p>
      ) : (
        <ul className="space-y-1">
          {focus.mutuallyExclusive.map((uid) => (
            <li key={uid} className="flex items-center justify-between rounded bg-red-500/10 px-2 py-1 text-xs">
              {nameOf(uid)}
              <button onClick={() => props.onToggleExclusive(focus.uid, uid)} title="Quitar">
                <X size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
