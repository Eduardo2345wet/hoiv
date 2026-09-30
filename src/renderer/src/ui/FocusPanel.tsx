// Panel lateral con los datos del foco seleccionado
import { Trash2 } from 'lucide-react'
import type { Focus } from '../types'
import { FOCUS_ICONS } from './icons'
import { ID_REGEX } from '../export/validator'

interface Props {
  focus: Focus | null
  onChange: (patch: Partial<Focus>) => void
  onDelete: () => void
}

export default function FocusPanel({ focus, onChange, onDelete }: Props): JSX.Element {
  if (!focus)
    return (
      <div className="p-4 text-sm text-hoi-muted">
        Ningún foco seleccionado.
        <br />
        <br />
        Haz doble clic en la cuadrícula para crear uno.
      </div>
    )

  const idOk = ID_REGEX.test(focus.id)
  return (
    <div className="flex flex-col gap-3 overflow-y-auto p-4">
      <h2 className="font-semibold text-hoi-accent">Foco seleccionado</h2>

      <div>
        <label className="label">ID (interno, sin espacios)</label>
        <input
          className={`input font-mono ${idOk ? '' : 'border-red-500'}`}
          value={focus.id}
          onChange={(e) => onChange({ id: e.target.value.replace(/\s/g, '_') })}
        />
        {!idOk && <p className="mt-1 text-xs text-red-400">Solo letras sin tildes, números y _</p>}
      </div>

      <div>
        <label className="label">Nombre</label>
        <input className="input" value={focus.name} onChange={(e) => onChange({ name: e.target.value })} />
      </div>

      <div>
        <label className="label">Descripción</label>
        <textarea
          className="input h-24 resize-none"
          value={focus.description}
          onChange={(e) => onChange({ description: e.target.value })}
        />
      </div>

      <div>
        <label className="label">Costo (semanas)</label>
        <input
          type="number"
          min={1}
          className="input"
          value={focus.cost}
          onChange={(e) => onChange({ cost: Math.max(0, Math.round(Number(e.target.value))) })}
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
            onChange={(e) => onChange({ x: Math.max(0, Math.round(Number(e.target.value))) })}
          />
        </div>
        <div className="flex-1">
          <label className="label">Posición Y</label>
          <input
            type="number"
            min={0}
            className="input"
            value={focus.y}
            onChange={(e) => onChange({ y: Math.max(0, Math.round(Number(e.target.value))) })}
          />
        </div>
      </div>

      <div>
        <label className="label">Ícono</label>
        <div className="grid max-h-48 grid-cols-6 gap-1 overflow-y-auto rounded border border-hoi-border p-1">
          {FOCUS_ICONS.map(([gfx, label, emoji]) => (
            <button
              key={gfx}
              title={`${label}\n${gfx}`}
              onClick={() => onChange({ icon: gfx })}
              className={`rounded p-1 text-xl hover:bg-hoi-card ${
                focus.icon === gfx ? 'bg-hoi-accent/30 ring-1 ring-hoi-accent' : ''
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
        <p className="mt-1 break-all font-mono text-[10px] text-hoi-muted">{focus.icon}</p>
      </div>

      <button className="btn mt-2 justify-center text-red-400" onClick={onDelete}>
        <Trash2 size={16} /> Borrar foco
      </button>
    </div>
  )
}
