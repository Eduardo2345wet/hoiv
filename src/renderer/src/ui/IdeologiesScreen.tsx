// Pestaña Ideologías: subideologías (parche mínimo del archivo de ideologías del juego).
import { useState } from 'react'
import { BookOpen, Palette } from 'lucide-react'
import type { Project } from '../types'
import { store, useApp } from '../store/appStore'
import { registerSectionScreen, type GroupNode, type TemplateCard } from '../sections/ui'
import {
  GROUPS,
  GROUP_COLORS,
  IDEOLOGY_ICON_SIZE,
  createIdeology,
  deleteIdeology,
  groupLabel,
  hexToRgb,
  ideologyLoc,
  newIdeology,
  rgbToHex,
  updateIdeology,
  validateIdeologies
} from '../sections/technologies'
import { loadImage, resizeImage } from '../export/imageCanvas'
import type { IdeologyDef } from '../sections/types'
import ImageUploader from './ImageUploader'
import Modal from './Modal'
import Help from './Help'
import { Button, Card, Field, Select, type CardNote } from './kit'

const patchI = (uid: string, p: Partial<IdeologyDef>, g?: string): void =>
  store.updateProject(
    (pr) => updateIdeology(pr, uid, p),
    g ? { group: `ideo:${uid}:${g}` } : undefined
  )
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
const cards: TemplateCard[] = [
  {
    id: 'subideologia',
    label: 'Subideología',
    description: 'Una variante dentro de democracia, comunismo, fascismo o no alineado.',
    thumb: <BookOpen size={20} />
  }
]

registerSectionScreen('ideologias', {
  intro: 'Crea subideologías para los gobiernos de tu mod: nombre, grupo, color e ícono.',
  newSpec: {
    title: 'Nueva subideología',
    nameLabel: 'Nombre',
    namePlaceholder: 'Por ejemplo: Socialdemocracia',
    defaultTemplate: 'subideologia',
    templates: cards,
    groupLabel: 'Grupo de ideología',
    groups: () => GROUPS.map((g) => ({ id: g.id, name: g.label })),
    create: ({ name, groupId }) => {
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
  groups: (p): GroupNode[] =>
    GROUPS.map((g) => ({
      id: g.id,
      title: g.label,
      items: (p.ideologies ?? [])
        .filter((i) => i.group === g.id)
        .map((i) => ({ uid: i.uid, title: i.name, subtitle: i.id, thumb: <Swatch i={i} /> }))
    })),
  duplicate: (uid) => {
    const p = store.get().project
    const i = (p?.ideologies ?? []).find((x) => x.uid === uid)
    if (!p || !i) return null
    const c = newIdeology(p, { name: `${i.name} (copia)` })
    const copy: IdeologyDef = { ...i, uid: c.uid, id: c.id, name: c.name }
    store.updateProject((pr) => ({ ...pr, ideologies: [...(pr.ideologies ?? []), copy] }))
    return copy.uid
  },
  remove: (uid) => {
    if (confirm('¿Borrar la subideología?')) store.updateProject((pr) => deleteIdeology(pr, uid))
  },
  renderEditor: (p, sel) => {
    const i = (p.ideologies ?? []).find((x) => x.uid === sel)
    return i ? <IdeologyEditor project={p} i={i} /> : null
  },
  renderPreview: (p, sel) => {
    const i = (p.ideologies ?? []).find((x) => x.uid === sel)
    return i ? <IdeologyPreview i={i} /> : null
  },
  code: (p, sel) => {
    const i = (p.ideologies ?? []).find((x) => x.uid === sel)
    if (!i) return null
    return [
      `# Se inserta en los tipos del grupo «${groupLabel(i.group)}»`,
      i.color ? `${i.id} = {\n\tcolor = { ${i.color.join(' ')} }\n}` : `${i.id} = { }`,
      '',
      '# Localización',
      ideologyLoc({ ...p, ideologies: [i] })[0]?.text ?? ''
    ].join('\n')
  }
})
