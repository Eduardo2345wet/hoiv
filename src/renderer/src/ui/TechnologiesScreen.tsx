// Pestaña Tecnologías (Modo avanzado): tecnologías nuevas dentro de carpetas existentes de la pantalla
// de investigación (parche mínimo del enlace del juego).
import { useState } from 'react'
import { FlaskConical } from 'lucide-react'
import type { Project } from '../types'
import { store, useApp } from '../store/appStore'
import { registerSectionScreen, type GroupNode, type TemplateCard } from '../sections/ui'
import {
  createTech,
  deleteTech,
  folderApplies,
  folderChoices,
  folderName,
  newTech,
  techNode,
  textPatchRequests,
  updateTech,
  validateTechnologies
} from '../sections/technologies'
import { serialize } from '../export/clausewitz'
import type { Technology } from '../sections/types'
import Help from './Help'
import TechTree from './TechTree'
import { createPortal } from 'react-dom'
import { Card, Field, NumberField, Select, type CardNote } from './kit'

const patchT = (uid: string, p: Partial<Technology>, g?: string): void =>
  store.updateProject((pr) => updateTech(pr, uid, p), g ? { group: `tech:${uid}:${g}` } : undefined)

const clean = (m: string): string => {
  const t = m.replace(/^(Subideología|Tecnología) [^:]+: /, '')
  return t.charAt(0).toUpperCase() + t.slice(1)
}
const noteOf = (x: { severity: 'error' | 'aviso'; message: string }): CardNote => ({
  severity: x.severity === 'error' ? 'error' : 'aviso',
  text: clean(x.message)
})

/** Cuadrito del color de una subideología (el suyo o el de su grupo) */
// ---------------------------------------------------------------- tecnología

function IdList({
  value,
  onChange,
  options,
  placeholder
}: {
  value: string[]
  onChange: (v: string[]) => void
  options: string[]
  placeholder: string
}): JSX.Element {
  const [q, setQ] = useState('')
  const listId = `ids-${placeholder.replace(/\W/g, '')}`
  const add = (): void => {
    const id = q.trim()
    if (id && !value.includes(id)) onChange([...value, id])
    setQ('')
  }
  return (
    <div>
      <div className="mb-1 flex flex-wrap gap-1">
        {value.map((t) => (
          <span key={t} className="rounded bg-hoi-card px-2 py-0.5 font-mono text-xs">
            {t}{' '}
            <button
              className="text-hoi-muted"
              aria-label="Quitar"
              onClick={() => onChange(value.filter((x) => x !== t))}
            >
              ✕
            </button>
          </span>
        ))}
      </div>
      <input
        className="input w-72"
        list={listId}
        placeholder={placeholder}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && add()}
        onBlur={add}
      />
      <datalist id={listId}>
        {options.slice(0, 1500).map((o) => (
          <option key={o} value={o} />
        ))}
      </datalist>
    </div>
  )
}

function TechEditor({ project, t }: { project: Project; t: Technology }): JSX.Element {
  const game = useApp(() => store.catalogGame())
  const all = [
    ...(game?.technologies ?? []).map((g) => g.id),
    ...(project.technologies ?? []).filter((x) => x.uid !== t.uid).map((x) => x.id)
  ]
  const patches = textPatchRequests(project, game).filter((r) => r.kind === 'tech')
  const [showAll, setShowAll] = useState(false)
  const choices = folderChoices(game, showAll)
  const notes: CardNote[] = [
    ...(t.folder && !folderApplies(game, t.folder)
      ? [
          {
            severity: 'aviso' as const,
            text: 'Esta carpeta no se usa en tu juego (falta un DLC o la reemplaza otra): la tecnología no se vería.'
          }
        ]
      : []),
    ...(project.techAdvanced
      ? []
      : [
          {
            severity: 'aviso' as const,
            text: 'El Modo avanzado está apagado: esta tecnología no se exporta.'
          }
        ]),
    ...validateTechnologies(project, game)
      .filter((x) => x.uid === t.uid)
      .map(noteOf)
  ]
  return (
    <div className="mx-auto max-w-3xl p-5" data-tech-editor>
      <Card title="Tecnología" notes={notes}>
        <Field label="Nombre">
          <input
            className="input"
            value={t.name}
            onChange={(e) => patchT(t.uid, { name: e.target.value }, 'name')}
          />
        </Field>
        <Field label="Descripción">
          <textarea
            className="input h-16"
            value={t.description}
            onChange={(e) => patchT(t.uid, { description: e.target.value }, 'desc')}
          />
        </Field>
      </Card>
      <Card title="Dónde va en el árbol">
        <Field label="Carpeta de investigación">
          {choices.length ? (
            <>
              <Select
                value={t.folder}
                options={[
                  { value: '', label: 'Elige una carpeta…' },
                  ...(t.folder && !choices.some((c) => c.id === t.folder)
                    ? [{ value: t.folder, label: folderName(t.folder, game) }]
                    : []),
                  ...choices.map((c) => ({ value: c.id, label: c.label }))
                ]}
                onChange={(v) => patchT(t.uid, { folder: v })}
              />
              {game?.techFolders && (
                <label className="mt-1 flex items-center gap-1 text-xs text-hoi-muted">
                  <input
                    type="checkbox"
                    data-show-all-folders
                    checked={showAll}
                    onChange={(e) => setShowAll(e.target.checked)}
                  />
                  Mostrar todas
                </label>
              )}
            </>
          ) : (
            <input
              className="input"
              placeholder="Carpeta"
              value={t.folder}
              onChange={(e) => patchT(t.uid, { folder: e.target.value.trim() }, 'folder')}
            />
          )}
        </Field>
        <div className="flex flex-wrap gap-4">
          <Field label="Columna">
            <NumberField value={t.x} min={0} onChange={(v) => patchT(t.uid, { x: v })} />
          </Field>
          <Field label="Fila">
            <NumberField value={t.y} min={0} onChange={(v) => patchT(t.uid, { y: v })} />
          </Field>
          <Field label="Costo de investigación">
            <NumberField value={t.cost} min={0} onChange={(v) => patchT(t.uid, { cost: v })} />
          </Field>
          <Field label="Año">
            <NumberField value={t.year} min={1900} onChange={(v) => patchT(t.uid, { year: v })} />
          </Field>
        </div>
      </Card>
      <Card title="Conexiones con otras tecnologías">
        <Field label="Hace falta investigar antes">
          <IdList
            value={t.prerequisites}
            onChange={(v) => patchT(t.uid, { prerequisites: v })}
            options={all}
            placeholder="Añadir tecnología…"
          />
        </Field>
        <Field label="Desbloquea">
          <IdList
            value={t.leadsTo}
            onChange={(v) => patchT(t.uid, { leadsTo: v })}
            options={all}
            placeholder="Añadir tecnología…"
          />
        </Field>
      </Card>
      <Card title="Opciones avanzadas" collapsible defaultOpen={false}>
        <Field label="Identificador" help="Se genera solo a partir del nombre.">
          <input
            className="input font-mono"
            value={t.id}
            onChange={(e) =>
              patchT(t.uid, { id: e.target.value.replace(/[^A-Za-z0-9_]/g, '_') }, 'id')
            }
          />
        </Field>
        <Field label="Categorías" help="Separadas por comas.">
          <input
            className="input font-mono"
            value={t.categories.join(', ')}
            onChange={(e) =>
              patchT(
                t.uid,
                {
                  categories: e.target.value
                    .split(',')
                    .map((x) => x.trim())
                    .filter(Boolean)
                },
                'cats'
              )
            }
          />
        </Field>
        {patches.length > 0 && (
          <p className="text-xs text-hoi-muted">
            Al exportar se enlaza con tecnologías del juego (con el cambio mínimo en su archivo).
          </p>
        )}
      </Card>
    </div>
  )
}

/** Vista del árbol: pequeña a la derecha o en grande sobre el centro y la derecha */
function TreePreview({ project, tech }: { project: Project; tech: Technology }): JSX.Element {
  const [full, setFull] = useState(false)
  const tree = (
    <TechTree project={project} tech={tech} full={full} onToggleFull={() => setFull((f) => !f)} />
  )
  if (!full) return tree
  const left = document.querySelector('[data-pane="center"]')?.getBoundingClientRect().left ?? 300
  return (
    <>
      <p className="text-xs text-hoi-muted">El árbol está en grande.</p>
      {createPortal(
        <div
          data-tree-full
          className="fixed bottom-0 right-0 top-[7.5rem] z-[90] bg-hoi-bg p-2"
          style={{ left }}
        >
          {tree}
        </div>,
        document.body
      )}
    </>
  )
}

const cards: TemplateCard[] = [
  {
    id: 'tecnologia',
    label: 'Tecnología nueva',
    description: 'Para el árbol de investigación. Necesita el Modo avanzado.',
    thumb: <FlaskConical size={20} />
  }
]

registerSectionScreen('tecnologias', {
  intro:
    'Crea tecnologías nuevas dentro de una carpeta de investigación del juego. Necesitan el Modo avanzado.',
  newSpec: {
    title: 'Nueva tecnología',
    nameLabel: 'Nombre',
    namePlaceholder: 'Por ejemplo: Fusil mejorado',
    templates: cards,
    groupLabel: 'Carpeta de investigación',
    groupOptional: true,
    groups: () =>
      folderChoices(store.catalogGame(), false).map((c) => ({ id: c.id, name: c.label })),
    create: ({ name, groupId }) => {
      if (!store.get().project?.techAdvanced) {
        store.toast('Activa el Modo avanzado para crear tecnologías.')
        return null
      }
      let uid = ''
      store.updateProject((p) => {
        const r = createTech(p, { name, ...(groupId ? { folder: groupId } : {}) })
        uid = r.tech.uid
        return r.project
      })
      return uid
    }
  },
  groups: (p): GroupNode[] => {
    const by = new Map<string, Technology[]>()
    for (const t of p.technologies ?? []) by.set(t.folder, [...(by.get(t.folder) ?? []), t])
    return [...by.entries()].map(([f, list]) => ({
      id: f || '_sin_carpeta',
      title: f ? folderName(f, store.catalogGame()) : 'Sin carpeta',
      items: list.map((t) => ({
        uid: t.uid,
        title: t.name,
        subtitle: t.id,
        thumb: <FlaskConical size={16} className="text-hoi-muted" />
      }))
    }))
  },
  duplicate: (uid) => {
    const p = store.get().project
    const t = (p?.technologies ?? []).find((x) => x.uid === uid)
    if (!p || !t) return null
    const c = newTech(p, { name: `${t.name} (copia)` })
    const copy: Technology = { ...t, uid: c.uid, id: c.id, name: c.name }
    store.updateProject((pr) => ({ ...pr, technologies: [...(pr.technologies ?? []), copy] }))
    return copy.uid
  },
  remove: (uid) => {
    if (confirm('¿Borrar la tecnología?')) store.updateProject((pr) => deleteTech(pr, uid))
  },
  renderHeader: (p) => (
    <div className="mt-2" data-advanced-mode>
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center text-xs text-hoi-text">
          Modo avanzado
          <Help id="tech.modoAvanzado" />
        </span>
        <button
          role="switch"
          aria-checked={!!p.techAdvanced}
          aria-label="Modo avanzado"
          data-advanced-switch
          onClick={() => store.updateProject((pr) => ({ ...pr, techAdvanced: !pr.techAdvanced }))}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${p.techAdvanced ? 'bg-hoi-accent' : 'bg-hoi-card'}`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${p.techAdvanced ? 'left-[1.1rem]' : 'left-0.5'}`}
          />
        </button>
      </div>
      <p className="mt-1 text-[11px] text-hoi-muted">Para crear tecnologías nuevas.</p>
    </div>
  ),
  renderEditor: (p, sel) => {
    const t = (p.technologies ?? []).find((x) => x.uid === sel)
    return t ? <TechEditor project={p} t={t} /> : null
  },
  renderPreview: (p, sel) => {
    const t = (p.technologies ?? []).find((x) => x.uid === sel)
    return t ? <TreePreview project={p} tech={t} /> : null
  },
  code: (p, sel) => {
    const t = (p.technologies ?? []).find((x) => x.uid === sel)
    return t ? serialize([techNode(p, t)]) : null
  }
})
