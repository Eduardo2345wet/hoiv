// Pestaña Tecnologías: subideologías (parche mínimo del archivo de ideologías del juego) y, en Modo
// avanzado, tecnologías nuevas dentro de carpetas existentes (parche mínimo del enlace del juego).
import { useState } from 'react'
import type { Project } from '../types'
import { store, useApp } from '../store/appStore'
import { registerSectionScreen } from '../sections/ui'
import {
  GROUPS,
  createIdeology,
  createTech,
  deleteIdeology,
  deleteTech,
  ideologyLoc,
  techNode,
  textPatchRequests,
  updateIdeology,
  updateTech,
  validateIdeologies,
  validateTechnologies
} from '../sections/technologies'
import { serialize } from '../export/clausewitz'
import type { IdeologyDef, Technology } from '../sections/types'
import ImageUploader from './ImageUploader'
import { Badge, Button, Field, NumberField, Select } from './kit'
import { IDEOLOGY_ICON_SIZE } from '../sections/technologies'

const patchI = (uid: string, p: Partial<IdeologyDef>, g?: string): void =>
  store.updateProject(
    (pr) => updateIdeology(pr, uid, p),
    g ? { group: `ideo:${uid}:${g}` } : undefined
  )
const patchT = (uid: string, p: Partial<Technology>, g?: string): void =>
  store.updateProject((pr) => updateTech(pr, uid, p), g ? { group: `tech:${uid}:${g}` } : undefined)

function IdeologyEditor({ project, i }: { project: Project; i: IdeologyDef }): JSX.Element {
  const [up, setUp] = useState(false)
  return (
    <div className="space-y-3 p-3">
      <h2 className="text-sm font-semibold">Subideología</h2>
      <p className="text-xs text-hoi-muted">
        Se agrega dentro de uno de los 4 grupos del juego: al exportar se parte del archivo REAL de
        ideologías de tu juego y solo se inserta el nuevo type (nunca se escribe sin partir del
        real).
      </p>
      <Field label="Grupo">
        <Select
          value={i.group}
          options={GROUPS.map((g) => ({ value: g.id, label: g.label }))}
          onChange={(v) => patchI(i.uid, { group: v as IdeologyDef['group'] })}
        />
      </Field>
      <Field label="Nombre">
        <input
          className="input"
          value={i.name}
          onChange={(e) => patchI(i.uid, { name: e.target.value }, 'name')}
        />
      </Field>
      <Field label="ID">
        <input
          className="input font-mono"
          value={i.id}
          onChange={(e) =>
            patchI(i.uid, { id: e.target.value.replace(/[^A-Za-z0-9_]/g, '_') }, 'id')
          }
        />
      </Field>
      <Field label="Descripción">
        <textarea
          className="input h-14"
          value={i.description}
          onChange={(e) => patchI(i.uid, { description: e.target.value }, 'desc')}
        />
      </Field>
      <Field label="Color (opcional)" help="r g b de 0 a 255">
        <div className="flex items-center gap-1">
          {[0, 1, 2].map((n) => (
            <input
              key={n}
              type="number"
              className="input w-16"
              min={0}
              max={255}
              value={i.color?.[n] ?? ''}
              placeholder={['r', 'g', 'b'][n]}
              onChange={(e) => {
                const cur = i.color ?? [0, 0, 0]
                const next = [...cur] as [number, number, number]
                next[n] = Number(e.target.value)
                patchI(i.uid, { color: next }, `color${n}`)
              }}
            />
          ))}
          {i.color && (
            <Button small onClick={() => patchI(i.uid, { color: null })}>
              Quitar
            </Button>
          )}
        </div>
      </Field>
      <Field
        label="Ícono (opcional)"
        help={`${IDEOLOGY_ICON_SIZE.w}×${IDEOLOGY_ICON_SIZE.h}, por verificar con el juego`}
      >
        <div className="flex items-center gap-2">
          {i.icon && <img src={i.icon} alt="" className="h-8 w-8 rounded" />}
          <Button small onClick={() => setUp(true)}>
            Subir…
          </Button>
          {i.icon && (
            <Button small onClick={() => patchI(i.uid, { icon: null })}>
              Quitar
            </Button>
          )}
        </div>
      </Field>
      {up && (
        <ImageUploader
          size={IDEOLOGY_ICON_SIZE}
          title="Ícono de la subideología"
          onClose={() => setUp(false)}
          onAcceptImage={(png) => {
            patchI(i.uid, { icon: png })
            setUp(false)
          }}
        />
      )}
      {validateIdeologies(project, store.catalogGame())
        .filter((x) => x.uid === i.uid)
        .map((x, n) => (
          <p
            key={n}
            className={`text-xs ${x.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}`}
          >
            {x.message}
          </p>
        ))}
    </div>
  )
}

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
  const folders = [
    ...new Set((game?.technologies ?? []).map((g) => g.folder).filter(Boolean))
  ] as string[]
  const all = [
    ...(game?.technologies ?? []).map((g) => g.id),
    ...(project.technologies ?? []).filter((x) => x.uid !== t.uid).map((x) => x.id)
  ]
  const patches = textPatchRequests(project, game).filter((r) => r.kind === 'tech')
  return (
    <div className="space-y-3 p-3">
      <h2 className="flex items-center gap-2 text-sm font-semibold">
        Tecnología nueva{' '}
        {!project.techAdvanced && <Badge>Modo avanzado apagado: no se exporta</Badge>}
      </h2>
      <p className="text-xs text-hoi-muted">
        Va dentro de una carpeta EXISTENTE de la pantalla de investigación. Si un prerrequisito es
        del juego, se parcha su <code>path</code> en su archivo real (parche mínimo). Nunca se
        escribe interface/countrytechtreeview.gui.
      </p>
      <Field label="Nombre">
        <input
          className="input"
          value={t.name}
          onChange={(e) => patchT(t.uid, { name: e.target.value }, 'name')}
        />
      </Field>
      <Field label="ID">
        <input
          className="input font-mono"
          value={t.id}
          onChange={(e) =>
            patchT(t.uid, { id: e.target.value.replace(/[^A-Za-z0-9_]/g, '_') }, 'id')
          }
        />
      </Field>
      <Field label="Descripción">
        <textarea
          className="input h-14"
          value={t.description}
          onChange={(e) => patchT(t.uid, { description: e.target.value }, 'desc')}
        />
      </Field>
      <Field label="Carpeta de investigación" help="Una carpeta que ya exista en el juego">
        {folders.length ? (
          <Select
            value={t.folder}
            options={[
              { value: '', label: 'Elige una carpeta…' },
              ...folders.map((f) => ({ value: f, label: f }))
            ]}
            onChange={(v) => patchT(t.uid, { folder: v })}
          />
        ) : (
          <input
            className="input font-mono"
            placeholder="infantry_folder"
            value={t.folder}
            onChange={(e) => patchT(t.uid, { folder: e.target.value.trim() }, 'folder')}
          />
        )}
      </Field>
      <div className="flex gap-3">
        <Field label="Posición x">
          <NumberField value={t.x} min={0} onChange={(v) => patchT(t.uid, { x: v })} />
        </Field>
        <Field label="Posición y">
          <NumberField value={t.y} min={0} onChange={(v) => patchT(t.uid, { y: v })} />
        </Field>
        <Field label="Costo">
          <NumberField value={t.cost} min={0} onChange={(v) => patchT(t.uid, { cost: v })} />
        </Field>
        <Field label="Año">
          <NumberField value={t.year} min={1900} onChange={(v) => patchT(t.uid, { year: v })} />
        </Field>
      </div>
      <Field label="Categorías" help="Separadas por comas, ej. infantry_weapons">
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
      <Field label="Prerrequisitos (líneas hacia esta tecnología)">
        <IdList
          value={t.prerequisites}
          onChange={(v) => patchT(t.uid, { prerequisites: v })}
          options={all}
          placeholder="Añadir prerrequisito…"
        />
      </Field>
      <Field label="Qué desbloquea">
        <IdList
          value={t.leadsTo}
          onChange={(v) => patchT(t.uid, { leadsTo: v })}
          options={all}
          placeholder="Añadir tecnología que desbloquea…"
        />
      </Field>
      {patches.length > 0 && (
        <p className="text-xs text-hoi-muted">
          Parches mínimos de archivos del juego al exportar:{' '}
          {patches
            .map((p) => (p.kind === 'tech' ? `common/technologies/${p.file}` : ''))
            .join(', ')}
        </p>
      )}
      {validateTechnologies(project, game)
        .filter((x) => x.uid === t.uid)
        .map((x, n) => (
          <p
            key={n}
            className={`text-xs ${x.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}`}
          >
            {x.message}
          </p>
        ))}
    </div>
  )
}

function Side({ project, uid }: { project: Project; uid: string | null }): JSX.Element {
  const i = (project.ideologies ?? []).find((x) => x.uid === uid)
  const t = (project.technologies ?? []).find((x) => x.uid === uid)
  if (!i && !t)
    return (
      <p className="text-xs text-hoi-muted">
        Elige una subideología o tecnología para ver su script.
      </p>
    )
  if (i)
    return (
      <div className="text-xs">
        <div className="mb-1 text-hoi-muted">Se inserta en types de «{i.group}»:</div>
        <pre className="whitespace-pre-wrap rounded bg-hoi-card p-2 font-mono text-[11px]">
          {i.color ? `${i.id} = {\n\tcolor = { ${i.color.join(' ')} }\n}` : `${i.id} = { }`}
        </pre>
        <div className="mb-1 mt-2 text-hoi-muted">Localización:</div>
        <pre className="whitespace-pre-wrap rounded bg-hoi-card p-2 font-mono text-[11px]">
          {ideologyLoc({ ...project, ideologies: [i] })[0]?.text}
        </pre>
      </div>
    )
  return (
    <pre className="whitespace-pre-wrap rounded bg-hoi-card p-2 font-mono text-[11px]">
      {serialize([techNode(project, t!)])}
    </pre>
  )
}

registerSectionScreen('tecnologias', {
  create: () => {
    let uid = ''
    store.updateProject((p) => {
      const r = createIdeology(p, {})
      uid = r.ideology.uid
      return r.project
    })
    return uid
  },
  templates: [
    {
      id: 'tech',
      label: 'Nueva tecnología (Modo avanzado)',
      create: () => {
        if (!store.get().project?.techAdvanced) {
          store.toast('Activa el Modo avanzado para crear tecnologías.')
          return null
        }
        let uid = ''
        store.updateProject((p) => {
          const r = createTech(p, {})
          uid = r.tech.uid
          return r.project
        })
        return uid
      }
    }
  ],
  remove: (uid) => {
    const p = store.get().project
    if (!p) return
    if ((p.ideologies ?? []).some((i) => i.uid === uid) && confirm('¿Borrar la subideología?'))
      store.updateProject((pr) => deleteIdeology(pr, uid))
    else if ((p.technologies ?? []).some((t) => t.uid === uid) && confirm('¿Borrar la tecnología?'))
      store.updateProject((pr) => deleteTech(pr, uid))
  },
  items: (p) => [
    ...(p.ideologies ?? []).map((i) => ({
      uid: i.uid,
      id: i.id,
      name: `Ideología · ${i.name || i.id}`
    })),
    ...(p.technologies ?? []).map((t) => ({
      uid: t.uid,
      id: t.id,
      name: `Tecnología · ${t.name || t.id}`
    }))
  ],
  renderHeader: (p) => (
    <label
      className="mt-2 flex items-start gap-2 text-xs text-hoi-muted"
      title="Tecnologías nuevas: parchan archivos del juego (con parche mínimo)"
    >
      <input
        type="checkbox"
        checked={!!p.techAdvanced}
        onChange={(e) => store.updateProject((pr) => ({ ...pr, techAdvanced: e.target.checked }))}
      />
      <span>
        <b>Modo avanzado</b>: tecnologías nuevas dentro de carpetas existentes (parchan archivos del
        juego)
      </span>
    </label>
  ),
  renderEditor: (p, sel) => {
    const i = (p.ideologies ?? []).find((x) => x.uid === sel)
    if (i) return <IdeologyEditor project={p} i={i} />
    const t = (p.technologies ?? []).find((x) => x.uid === sel)
    return t ? <TechEditor project={p} t={t} /> : null
  },
  renderPreview: (p, sel) => <Side project={p} uid={sel} />
})
