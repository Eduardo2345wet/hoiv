// Pestaña Tecnologías: subideologías (parche mínimo del archivo de ideologías del juego) y, en Modo
// avanzado, tecnologías nuevas dentro de carpetas existentes (parche mínimo del enlace del juego).
import { useState } from 'react'
import { BookOpen, FlaskConical, Palette } from 'lucide-react'
import type { Project } from '../types'
import { store, useApp } from '../store/appStore'
import { registerSectionScreen, type GroupNode, type TemplateCard } from '../sections/ui'
import {
  GROUPS,
  GROUP_COLORS,
  IDEOLOGY_ICON_SIZE,
  createIdeology,
  createTech,
  deleteIdeology,
  deleteTech,
  folderLabel,
  groupLabel,
  hexToRgb,
  ideologyLoc,
  newIdeology,
  newTech,
  rgbToHex,
  techNode,
  textPatchRequests,
  updateIdeology,
  updateTech,
  validateIdeologies,
  validateTechnologies
} from '../sections/technologies'
import { serialize } from '../export/clausewitz'
import { loadImage, resizeImage } from '../export/imageCanvas'
import type { IdeologyDef, Technology } from '../sections/types'
import ImageUploader from './ImageUploader'
import Modal from './Modal'
import Help from './Help'
import { Button, Card, Field, NumberField, Select, type CardNote } from './kit'

const patchI = (uid: string, p: Partial<IdeologyDef>, g?: string): void =>
  store.updateProject(
    (pr) => updateIdeology(pr, uid, p),
    g ? { group: `ideo:${uid}:${g}` } : undefined
  )
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
function Swatch({ i, size = 18 }: { i: IdeologyDef; size?: number }): JSX.Element {
  const c = i.color ?? GROUP_COLORS[i.group]
  return (
    <span
      className="inline-block shrink-0 rounded-sm border border-white/20"
      style={{ width: size, height: size, background: `rgb(${c.join(',')})` }}
    />
  )
}

// ---------------------------------------------------------------- subideología

function IconPicker({ i }: { i: IdeologyDef }): JSX.Element {
  const project = useApp((s) => s.project)
  const [dialog, setDialog] = useState<'upload' | 'library' | null>(null)
  const fromLibrary = async (png: string): Promise<void> => {
    const img = await loadImage(png)
    const c = resizeImage(img, IDEOLOGY_ICON_SIZE.w, IDEOLOGY_ICON_SIZE.h, 'ajustar')
    patchI(i.uid, { icon: c.toDataURL('image/png') })
    setDialog(null)
  }
  return (
    <div className="flex items-center gap-3">
      <div className="flex h-12 w-12 items-center justify-center rounded bg-[#101013]">
        {i.icon ? (
          <img src={i.icon} alt="" className="h-8 w-8" data-ideology-icon />
        ) : (
          <span className="text-[10px] text-hoi-muted">Sin ícono</span>
        )}
      </div>
      <Button small onClick={() => setDialog('upload')}>
        Subir imagen
      </Button>
      <Button small onClick={() => setDialog('library')}>
        De mi biblioteca
      </Button>
      {i.icon && (
        <button
          className="text-xs text-hoi-muted underline hover:text-hoi-text"
          onClick={() => patchI(i.uid, { icon: null })}
        >
          Quitar
        </button>
      )}
      {dialog === 'upload' && (
        <ImageUploader
          size={IDEOLOGY_ICON_SIZE}
          title="Ícono de la subideología"
          onClose={() => setDialog(null)}
          onAcceptImage={(png) => {
            patchI(i.uid, { icon: png })
            setDialog(null)
          }}
        />
      )}
      {dialog === 'library' && (
        <Modal title="Elegir de mi biblioteca" width={560} onClose={() => setDialog(null)}>
          {project?.icons.length ? (
            <div className="grid grid-cols-4 gap-2">
              {project.icons.map((a) => (
                <button
                  key={a.id}
                  onClick={() => void fromLibrary(a.png)}
                  className="flex flex-col items-center gap-1 rounded border border-hoi-border p-2 hover:border-hoi-accent"
                >
                  <img src={a.png} alt="" style={{ height: 48 }} />
                  <span className="w-full truncate text-[11px]">{a.name}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-hoi-muted">Todavía no hay íconos en la biblioteca.</p>
          )}
        </Modal>
      )}
    </div>
  )
}

function IdeologyEditor({ project, i }: { project: Project; i: IdeologyDef }): JSX.Element {
  const notes = validateIdeologies(project, store.catalogGame())
    .filter((x) => x.uid === i.uid)
    .map(noteOf)
  const base = i.color ?? GROUP_COLORS[i.group]
  return (
    <div className="mx-auto max-w-3xl p-5" data-ideology-editor>
      <Card title="Subideología" help={<Help id="tech.subideologia" />} notes={notes}>
        <Field label="Nombre">
          <input
            className="input"
            value={i.name}
            onChange={(e) => patchI(i.uid, { name: e.target.value }, 'name')}
          />
        </Field>
        <Field label="Grupo">
          <Select
            value={i.group}
            options={GROUPS.map((g) => ({ value: g.id, label: g.label }))}
            onChange={(v) => patchI(i.uid, { group: v as IdeologyDef['group'] })}
          />
        </Field>
        <Field label="Descripción">
          <textarea
            className="input h-16"
            value={i.description}
            onChange={(e) => patchI(i.uid, { description: e.target.value }, 'desc')}
          />
        </Field>
      </Card>
      <Card title="Color e ícono">
        <Field label="Color">
          <div className="flex items-center gap-3">
            <input
              type="color"
              data-ideology-color
              className="h-9 w-14 cursor-pointer rounded border border-hoi-border bg-transparent p-0.5"
              value={rgbToHex(base)}
              onChange={(e) => {
                const rgb = hexToRgb(e.target.value)
                if (rgb) patchI(i.uid, { color: rgb }, 'color')
              }}
            />
            <span className="text-xs text-hoi-muted">
              {i.color ? 'Color propio' : `Color del grupo ${groupLabel(i.group)}`}
            </span>
            {i.color && (
              <button
                className="text-xs text-hoi-muted underline hover:text-hoi-text"
                onClick={() => patchI(i.uid, { color: null })}
              >
                Usar el del grupo
              </button>
            )}
          </div>
        </Field>
        <Field label="Ícono">
          <IconPicker i={i} />
        </Field>
      </Card>
      <Card title="Opciones avanzadas" collapsible defaultOpen={false}>
        <Field label="Identificador" help="Se genera solo a partir del nombre.">
          <input
            className="input font-mono"
            value={i.id}
            onChange={(e) =>
              patchI(i.uid, { id: e.target.value.replace(/[^A-Za-z0-9_]/g, '_') }, 'id')
            }
          />
        </Field>
      </Card>
    </div>
  )
}

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
  const folders = [
    ...new Set((game?.technologies ?? []).map((g) => g.folder).filter(Boolean))
  ] as string[]
  const all = [
    ...(game?.technologies ?? []).map((g) => g.id),
    ...(project.technologies ?? []).filter((x) => x.uid !== t.uid).map((x) => x.id)
  ]
  const patches = textPatchRequests(project, game).filter((r) => r.kind === 'tech')
  const notes: CardNote[] = [
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
          {folders.length ? (
            <Select
              value={t.folder}
              options={[
                { value: '', label: 'Elige una carpeta…' },
                ...folders.map((f) => ({ value: f, label: folderLabel(f) }))
              ]}
              onChange={(v) => patchT(t.uid, { folder: v })}
            />
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

// ---------------------------------------------------------------- vista previa

/** La subideología como se ve en la ventana de gobierno: ícono, nombre y color */
function IdeologyPreview({ i }: { i: IdeologyDef }): JSX.Element {
  const c = i.color ?? GROUP_COLORS[i.group]
  return (
    <div
      data-ideology-preview
      className="mx-auto w-full max-w-[320px] rounded-sm border-2 border-[#8c7b4f] bg-[#232b36] p-3"
    >
      <div className="mb-2 border-b border-[#5a6578] pb-1 text-xs uppercase tracking-wide text-hoi-muted">
        Gobierno
      </div>
      <div className="flex items-center gap-3 rounded-sm border border-[#3f4858] bg-[#1c222b] p-2">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-black/30">
          {i.icon ? (
            <img src={i.icon} alt="" className="h-8 w-8" />
          ) : (
            <Palette size={18} className="text-hoi-muted" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div data-preview-name className="truncate text-sm font-semibold text-hoi-text">
            {i.name || 'Nombre de la subideología'}
          </div>
          <div className="truncate text-[11px] text-hoi-muted">{groupLabel(i.group)}</div>
        </div>
        <span
          data-preview-color
          className="h-6 w-6 shrink-0 rounded-sm border border-white/20"
          style={{ background: `rgb(${c.join(',')})` }}
        />
      </div>
      {i.description && (
        <p className="mt-2 text-[11px] leading-snug text-hoi-muted">{i.description}</p>
      )}
    </div>
  )
}

/** La tecnología como una casilla del árbol de investigación */
function TechPreview({ t }: { t: Technology }): JSX.Element {
  return (
    <div className="mx-auto w-full max-w-[320px]">
      <div className="mb-1 text-xs text-hoi-muted">
        {t.folder ? folderLabel(t.folder) : 'Elige una carpeta'} · columna {t.x}, fila {t.y}
      </div>
      <div data-tech-preview className="w-40 rounded-sm border-2 border-[#8c7b4f] bg-[#232b36] p-2">
        <div className="flex h-12 items-center justify-center rounded-sm bg-black/30">
          <FlaskConical size={22} className="text-hoi-muted" />
        </div>
        <div className="mt-1 truncate text-center text-xs font-semibold text-hoi-text">
          {t.name || 'Tecnología sin nombre'}
        </div>
        <div className="text-center text-[10px] text-hoi-muted">
          {t.cost} de costo · {t.year}
        </div>
      </div>
    </div>
  )
}

function Preview({ project, uid }: { project: Project; uid: string | null }): JSX.Element {
  const i = (project.ideologies ?? []).find((x) => x.uid === uid)
  const t = (project.technologies ?? []).find((x) => x.uid === uid)
  if (i) return <IdeologyPreview i={i} />
  if (t) return <TechPreview t={t} />
  return <p className="text-xs text-hoi-muted">Elige una subideología o una tecnología.</p>
}

// ---------------------------------------------------------------- registro

const cards: TemplateCard[] = [
  {
    id: 'subideologia',
    label: 'Subideología',
    description: 'Una variante dentro de democracia, comunismo, fascismo o no alineado.',
    thumb: <BookOpen size={20} />
  },
  {
    id: 'tecnologia',
    label: 'Tecnología nueva',
    description: 'Para el árbol de investigación. Necesita el Modo avanzado.',
    thumb: <FlaskConical size={20} />
  }
]

registerSectionScreen('tecnologias', {
  intro:
    'Crea subideologías para los gobiernos de tu mod. Las tecnologías nuevas son opcionales y necesitan el Modo avanzado.',
  newSpec: {
    title: 'Nueva subideología o tecnología',
    nameLabel: 'Nombre',
    namePlaceholder: 'Por ejemplo: Socialdemocracia',
    defaultTemplate: 'subideologia',
    templates: cards,
    groupLabel: 'Grupo de ideología',
    groups: () => GROUPS.map((g) => ({ id: g.id, name: g.label })),
    needsGroup: (tpl) => tpl === 'subideologia',
    create: ({ name, groupId, template }) => {
      if (template === 'tecnologia') {
        if (!store.get().project?.techAdvanced) {
          store.toast('Activa el Modo avanzado para crear tecnologías.')
          return null
        }
        let uid = ''
        store.updateProject((p) => {
          const r = createTech(p, { name })
          uid = r.tech.uid
          return r.project
        })
        return uid
      }
      let uid = ''
      store.updateProject((p) => {
        const r = createIdeology(p, {
          name,
          group: (groupId as IdeologyDef['group'] | null) ?? 'neutrality'
        })
        uid = r.ideology.uid
        return r.project
      })
      return uid
    }
  },
  groups: (p): GroupNode[] => {
    const ideologies = [...(p.ideologies ?? [])].sort(
      (a, b) =>
        GROUPS.findIndex((g) => g.id === a.group) - GROUPS.findIndex((g) => g.id === b.group)
    )
    return [
      {
        id: 'ideologias',
        title: 'Ideologías',
        items: ideologies.map((i, n) => ({
          uid: i.uid,
          heading: n === 0 || ideologies[n - 1].group !== i.group ? groupLabel(i.group) : undefined,
          title: i.name,
          subtitle: i.id,
          thumb: <Swatch i={i} />
        }))
      },
      {
        id: 'tecnologias',
        title: 'Tecnologías',
        items: (p.technologies ?? []).map((t) => ({
          uid: t.uid,
          title: t.name,
          subtitle: t.id,
          thumb: <FlaskConical size={16} className="text-hoi-muted" />
        }))
      }
    ]
  },
  duplicate: (uid) => {
    const p = store.get().project
    if (!p) return null
    const i = (p.ideologies ?? []).find((x) => x.uid === uid)
    if (i) {
      const c = newIdeology(p, { name: `${i.name} (copia)` })
      const copy: IdeologyDef = { ...i, uid: c.uid, id: c.id, name: c.name }
      store.updateProject((pr) => ({ ...pr, ideologies: [...(pr.ideologies ?? []), copy] }))
      return copy.uid
    }
    const t = (p.technologies ?? []).find((x) => x.uid === uid)
    if (t) {
      const c = newTech(p, { name: `${t.name} (copia)` })
      const copy: Technology = { ...t, uid: c.uid, id: c.id, name: c.name }
      store.updateProject((pr) => ({ ...pr, technologies: [...(pr.technologies ?? []), copy] }))
      return copy.uid
    }
    return null
  },
  remove: (uid) => {
    const p = store.get().project
    if (!p) return
    if ((p.ideologies ?? []).some((i) => i.uid === uid) && confirm('¿Borrar la subideología?'))
      store.updateProject((pr) => deleteIdeology(pr, uid))
    else if ((p.technologies ?? []).some((t) => t.uid === uid) && confirm('¿Borrar la tecnología?'))
      store.updateProject((pr) => deleteTech(pr, uid))
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
    const i = (p.ideologies ?? []).find((x) => x.uid === sel)
    if (i) return <IdeologyEditor project={p} i={i} />
    const t = (p.technologies ?? []).find((x) => x.uid === sel)
    return t ? <TechEditor project={p} t={t} /> : null
  },
  renderPreview: (p, sel) => <Preview project={p} uid={sel} />,
  code: (p, sel) => {
    const i = (p.ideologies ?? []).find((x) => x.uid === sel)
    if (i)
      return [
        `# Se inserta en los tipos del grupo «${groupLabel(i.group)}»`,
        i.color ? `${i.id} = {\n\tcolor = { ${i.color.join(' ')} }\n}` : `${i.id} = { }`,
        '',
        '# Localización',
        ideologyLoc({ ...p, ideologies: [i] })[0]?.text ?? ''
      ].join('\n')
    const t = (p.technologies ?? []).find((x) => x.uid === sel)
    return t ? serialize([techNode(p, t)]) : null
  }
})
