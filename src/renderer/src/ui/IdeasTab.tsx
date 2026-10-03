// Pestaña "Espíritus nacionales": lista + editor del seleccionado
import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import type { Idea, Project } from '../types'
import { store, useApp } from '../store/appStore'
import { createIdea, deleteIdea, renameIdeaId, setIdeaName, updateIdea } from './projectOps'
import { MODIFIERS, modifierDef } from '../catalog/modifiers'
import { ID_REGEX } from '../export/validator'
import IconThumb from './IconThumb'
import IconField from './IconField'

export default function IdeasTab({ project }: { project: Project }): JSX.Element {
  const [selected, setSelected] = useState<string | null>(project.ideas[0]?.uid ?? null)
  const idea = project.ideas.find((i) => i.uid === selected) ?? null
  // Un espíritu recién creado a partir de uno del juego se abre para editarlo
  const toSelect = useApp((s) => s.ideaToSelect)
  useEffect(() => {
    if (!toSelect) return
    setSelected(toSelect)
    store.set({ ideaToSelect: null })
  }, [toSelect])
  const fromGame = (): void =>
    store.set({
      ideaPicker: {
        mode: 'copy',
        onUse: () => undefined,
        onCopy: (src) => store.set({ ideaCopy: { src, onCreated: (_id, uid) => setSelected(uid) } })
      }
    })

  const add = (): void => {
    let uid = ''
    store.updateProject((p) => {
      const r = createIdea(p)
      uid = r.idea.uid
      return r.project
    })
    setSelected(uid)
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Lista */}
      <aside className="flex w-72 flex-col border-r border-hoi-border bg-hoi-panel">
        <div className="shrink-0 border-b border-hoi-border p-3">
          <button className="btn-primary w-full justify-center" onClick={add}>
            <Plus size={16} /> Nuevo espíritu
          </button>
          <button className="btn mt-2 w-full justify-center" onClick={fromGame}>
            Nuevo a partir del juego…
          </button>
        </div>
        <ul className="min-h-0 flex-1 overflow-y-auto p-2">
          {project.ideas.map((i) => (
            <li
              key={i.uid}
              onClick={() => setSelected(i.uid)}
              className={`mb-1 flex cursor-pointer items-center gap-2 rounded p-2 ${
                i.uid === selected ? 'bg-hoi-accent/20 ring-1 ring-hoi-accent' : 'hover:bg-hoi-card'
              }`}
            >
              <IconThumb icon={i.icon} project={project} height={40} />
              <div className="min-w-0">
                <div className="truncate text-sm">
                  {i.name || <span className="text-red-400">sin nombre</span>}
                </div>
                <div className="truncate font-mono text-[10px] text-hoi-muted">{i.id}</div>
              </div>
            </li>
          ))}
          {!project.ideas.length && (
            <p className="p-2 text-sm text-hoi-muted">Aún no hay espíritus nacionales.</p>
          )}
        </ul>
      </aside>

      {/* Editor */}
      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        {idea ? (
          <IdeaEditor project={project} idea={idea} onDeleted={() => setSelected(null)} />
        ) : (
          <p className="text-hoi-muted">Selecciona o crea un espíritu nacional.</p>
        )}
      </div>
    </div>
  )
}

function IdeaEditor({
  project,
  idea,
  onDeleted
}: {
  project: Project
  idea: Idea
  onDeleted: () => void
}): JSX.Element {
  const uid = idea.uid
  const patch = (p: Partial<Idea>, field = Object.keys(p)[0]): void =>
    store.updateProject((pr) => updateIdea(pr, uid, p), { group: `field:${uid}:${field}` })
  const dup =
    project.ideas.some((i) => i.uid !== uid && i.id === idea.id) ||
    project.focuses.some((f) => f.id === idea.id)
  const setMod = (n: number, m: Partial<Idea['modifiers'][number]>): void =>
    patch({
      modifiers: idea.modifiers.map((x, i) => (i === n ? { ...x, ...m } : x))
    })

  return (
    <div className="flex max-w-3xl gap-6">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div>
          <label className="label">Nombre</label>
          <input
            className="input"
            value={idea.name}
            onChange={(e) =>
              store.updateProject((p) => setIdeaName(p, uid, e.target.value), {
                group: `field:${uid}:name`
              })
            }
          />
        </div>
        <div>
          <label className="label">ID</label>
          <input
            className={`input font-mono ${ID_REGEX.test(idea.id) && !dup ? '' : 'border-red-500'}`}
            value={idea.id}
            onChange={(e) =>
              store.updateProject((p) =>
                updateIdea(renameIdeaId(p, uid, e.target.value.replace(/\s/g, '_')), uid, {
                  idAuto: false
                })
              )
            }
          />
          {dup && <p className="mt-1 text-xs text-red-400">Ese id ya está en uso</p>}
        </div>
        <div>
          <label className="label">Descripción</label>
          <textarea
            className="input h-20 resize-none"
            value={idea.description}
            onChange={(e) => patch({ description: e.target.value })}
          />
        </div>

        <div>
          <label className="label">Modificadores</label>
          {idea.modifiers.map((m, n) => {
            const def = modifierDef(m.key)
            return (
              <div key={n} className="mb-1 flex items-center gap-2">
                <select
                  className="input flex-1"
                  value={m.key}
                  onChange={(e) => setMod(n, { key: e.target.value })}
                >
                  {MODIFIERS.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                  {!def && <option value={m.key}>{m.key}</option>}
                </select>
                <input
                  type="number"
                  className="input w-24"
                  value={m.value}
                  onChange={(e) => setMod(n, { value: Number(e.target.value) })}
                />
                <span className="w-4 text-sm text-hoi-muted">{def?.percent ? '%' : ''}</span>
                <button
                  className="text-red-400"
                  title="Quitar"
                  onClick={() =>
                    patch({
                      modifiers: idea.modifiers.filter((_, i) => i !== n)
                    })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )
          })}
          <button
            className="btn mt-1"
            onClick={() =>
              patch({
                modifiers: [...idea.modifiers, { key: MODIFIERS[0].key, value: 5 }]
              })
            }
          >
            <Plus size={14} /> Añadir modificador
          </button>
        </div>

        {(idea.extraText || idea.extraModifierText) && (
          <div>
            <label className="label">Avanzado (texto, solo lectura: se exporta tal cual)</label>
            <textarea
              readOnly
              className="input h-28 resize-none font-mono text-[11px]"
              value={[
                idea.extraModifierText && `modifier = {\n${idea.extraModifierText}\n}`,
                idea.extraText
              ]
                .filter(Boolean)
                .join('\n')}
            />
          </div>
        )}
        {idea.picture && !idea.icon && (
          <p className="text-xs text-hoi-muted">
            Ícono del juego: <span className="font-mono">GFX_idea_{idea.picture}</span> (no se copia
            ningún archivo; elige otro a la derecha si quieres cambiarlo).
          </p>
        )}

        <button
          className="btn mt-4 w-fit text-red-400"
          onClick={() => {
            if (!confirm(`¿Borrar el espíritu "${idea.name || idea.id}"?`)) return
            store.updateProject((p) => deleteIdea(p, uid))
            onDeleted()
          }}
        >
          <Trash2 size={16} /> Borrar espíritu
        </button>
      </div>
      <div className="w-60 shrink-0">
        <IconField
          project={project}
          target="idea"
          ownerUid={uid}
          ownerName={idea.name}
          icon={idea.icon}
          iconAuto={idea.iconAuto}
        />
      </div>
    </div>
  )
}
