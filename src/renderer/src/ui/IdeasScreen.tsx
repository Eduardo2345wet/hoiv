// Pestaña Espíritus nacionales con el esqueleto común: lista por país, editor en tarjetas y vista
// previa del espíritu como se ve en el juego (ícono, nombre y globo de información).
import { Copy, FilePlus, Plus, Trash2, TrendingDown, TrendingUp } from 'lucide-react'
import type { Idea, Project } from '../types'
import { store } from '../store/appStore'
import { registerSectionScreen, type GroupNode, type TemplateCard } from '../sections/ui'
import { createIdea, deleteIdea, renameIdeaId, setIdeaName, updateIdea } from './projectOps'
import { MODIFIERS, modifierDef } from '../catalog/modifiers'
import { ID_REGEX } from '../export/validator'
import { generateIdeas } from '../generator/ideas'
import { nameOfTag } from './countryFlow'
import IconThumb from './IconThumb'
import IconField from './IconField'
import Help from './Help'
import { Button, Card, Field, type CardNote } from './kit'

const NO_COUNTRY = '_sin_pais'

/** Países que empiezan con este espíritu (situación inicial) */
const ownersOf = (p: Project, id: string): string[] =>
  (p.countryStart ?? []).filter((c) => c.ideas.includes(id)).map((c) => c.country)

const lineOf = (m: { key: string; value: number }): string => {
  const d = modifierDef(m.key)
  const v = `${m.value > 0 ? '+' : ''}${m.value}${d?.percent ? ' %' : ''}`
  return `${d?.label ?? 'Otro modificador'}: ${v}`
}

function IdeaEditor({ project, idea }: { project: Project; idea: Idea }): JSX.Element {
  const uid = idea.uid
  const patch = (p: Partial<Idea>, field = Object.keys(p)[0]): void =>
    store.updateProject((pr) => updateIdea(pr, uid, p), { group: `field:${uid}:${field}` })
  const dup =
    project.ideas.some((i) => i.uid !== uid && i.id === idea.id) ||
    project.focuses.some((f) => f.id === idea.id)
  const setMod = (n: number, m: Partial<Idea['modifiers'][number]>): void =>
    patch({ modifiers: idea.modifiers.map((x, i) => (i === n ? { ...x, ...m } : x)) })
  const notes: CardNote[] = [
    ...(!idea.name.trim() ? [{ severity: 'error' as const, text: 'Falta el nombre.' }] : []),
    ...(!ID_REGEX.test(idea.id)
      ? [{ severity: 'error' as const, text: 'El identificador solo admite letras, números y _.' }]
      : []),
    ...(dup ? [{ severity: 'error' as const, text: 'Ese identificador ya está en uso.' }] : [])
  ]
  return (
    <div className="mx-auto max-w-3xl p-5" data-idea-editor>
      <Card title="Básico" notes={notes}>
        <Field label="Nombre">
          <input
            className="input"
            value={idea.name}
            onChange={(e) =>
              store.updateProject((p) => setIdeaName(p, uid, e.target.value), {
                group: `field:${uid}:name`
              })
            }
          />
        </Field>
        <Field label="Descripción">
          <textarea
            className="input h-20 resize-none"
            value={idea.description}
            onChange={(e) => patch({ description: e.target.value })}
          />
        </Field>
        <div className="max-w-[15rem]">
          <IconField
            project={project}
            target="idea"
            ownerUid={uid}
            ownerName={idea.name}
            icon={idea.icon}
            iconAuto={idea.iconAuto}
            picture={idea.picture}
          />
        </div>
        {idea.picture && !idea.icon && (
          <p className="mt-2 text-xs text-hoi-muted">
            Usa el ícono del propio juego; no se copia ningún archivo.
          </p>
        )}
      </Card>

      <Card title="Modificadores" help={<Help id="espiritu.modificadores" />}>
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
                {!def && <option value={m.key}>Otro modificador</option>}
              </select>
              <input
                type="number"
                className="input w-24"
                value={m.value}
                onChange={(e) => setMod(n, { value: Number(e.target.value) })}
              />
              <span className="w-4 text-sm text-hoi-muted">{def?.percent ? '%' : ''}</span>
              <button
                className="text-hoi-muted hover:text-red-400"
                title="Quitar"
                onClick={() => patch({ modifiers: idea.modifiers.filter((_, i) => i !== n) })}
              >
                <Trash2 size={16} />
              </button>
            </div>
          )
        })}
        <Button
          small
          onClick={() =>
            patch({ modifiers: [...idea.modifiers, { key: MODIFIERS[0].key, value: 5 }] })
          }
        >
          <Plus size={14} /> Añadir modificador
        </Button>
        {(idea.extraText || idea.extraModifierText) && (
          <div className="mt-3">
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
      </Card>

      <Card title="Opciones avanzadas" collapsible defaultOpen={false}>
        <Field label="Identificador" help="Se genera solo a partir del nombre.">
          <input
            className="input font-mono"
            value={idea.id}
            onChange={(e) =>
              store.updateProject((p) =>
                updateIdea(renameIdeaId(p, uid, e.target.value.replace(/\s/g, '_')), uid, {
                  idAuto: false
                })
              )
            }
          />
        </Field>
      </Card>
    </div>
  )
}

/** El espíritu como en la pantalla de gobierno y su globo de información */
function IdeaPreview({ project, idea }: { project: Project; idea: Idea }): JSX.Element {
  return (
    <div data-idea-preview className="mx-auto w-full max-w-[320px] space-y-3">
      <div className="flex items-center gap-3 rounded-sm border-2 border-[#8c7b4f] bg-[#232b36] p-3">
        <IconThumb icon={idea.icon} project={project} height={52} picture={idea.picture} />
        <div data-preview-name className="min-w-0 text-sm font-semibold text-hoi-text">
          {idea.name || 'Espíritu sin nombre'}
        </div>
      </div>
      <div className="rounded-sm border border-[#5a6578] bg-[#1c222b] p-3">
        <div className="text-sm font-semibold text-hoi-text">{idea.name || 'Sin nombre'}</div>
        {idea.description && (
          <p className="mt-1 text-[11px] italic leading-snug text-hoi-muted">{idea.description}</p>
        )}
        <ul className="mt-2 space-y-0.5 text-[11px]">
          {idea.modifiers.map((m, i) => (
            <li key={i} className={m.value >= 0 ? 'text-green-400' : 'text-red-400'}>
              {lineOf(m)}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

const cards: TemplateCard[] = [
  {
    id: 'blank',
    label: 'Espíritu en blanco',
    description: 'Empieza con un modificador de estabilidad.',
    thumb: <FilePlus size={20} />
  },
  {
    id: 'copy',
    label: 'Copiar uno del juego',
    description: 'Parte de un espíritu que ya existe en el juego.',
    thumb: <Copy size={20} />
  },
  {
    id: 'economy',
    label: 'Bonificación económica',
    description: 'Más fábricas y menos bienes de consumo.',
    thumb: <TrendingUp size={20} />
  },
  {
    id: 'penalty',
    label: 'Penalización temporal',
    description: 'Un efecto negativo que luego puedes quitar.',
    thumb: <TrendingDown size={20} />
  }
]

function copyFromGame(): void {
  store.set({
    ideaPicker: {
      mode: 'copy',
      onUse: () => undefined,
      onCopy: (src) =>
        store.set({ ideaCopy: { src, onCreated: (_id, uid) => store.set({ ideaToSelect: uid }) } })
    }
  })
}

registerSectionScreen('ideas', {
  intro:
    'Los espíritus nacionales son efectos permanentes de un país: cada uno cambia algunos números mientras esté activo.',
  newSpec: {
    title: 'Nuevo espíritu',
    nameLabel: 'Nombre del espíritu',
    namePlaceholder: 'Por ejemplo: Industria nacional',
    defaultTemplate: 'blank',
    templates: cards,
    direct: (t) => {
      if (t !== 'copy') return false
      copyFromGame()
      return true
    },
    create: ({ name, template }) => {
      let uid = ''
      store.updateProject((p) => {
        const r = createIdea(p, name)
        uid = r.idea.uid
        const mods =
          template === 'economy'
            ? [
                { key: 'industrial_capacity_factory', value: 10 },
                { key: 'consumer_goods_factor', value: -5 }
              ]
            : template === 'penalty'
              ? [{ key: 'stability_factor', value: -10 }]
              : null
        return mods ? updateIdea(r.project, uid, { modifiers: mods }) : r.project
      })
      return uid
    }
  },
  groups: (p): GroupNode[] => {
    const by = new Map<string, Idea[]>()
    for (const i of p.ideas) {
      const o = ownersOf(p, i.id)
      for (const t of o.length ? o : [NO_COUNTRY]) by.set(t, [...(by.get(t) ?? []), i])
    }
    return [...by.entries()].map(([t, list]) => ({
      id: t,
      title: t === NO_COUNTRY ? 'Sin país' : nameOfTag(t),
      items: list.map((i) => ({
        uid: i.uid,
        title: i.name,
        subtitle: i.id,
        thumb: <IconThumb icon={i.icon} project={p} height={26} picture={i.picture} />
      }))
    }))
  },
  remove: (uid) => {
    const i = store.get().project?.ideas.find((x) => x.uid === uid)
    if (i && confirm(`¿Borrar el espíritu "${i.name || i.id}"?`))
      store.updateProject((p) => deleteIdea(p, uid))
  },
  renderEditor: (p, sel) => {
    const i = p.ideas.find((x) => x.uid === sel)
    return i ? <IdeaEditor project={p} idea={i} /> : null
  },
  renderPreview: (p, sel) => {
    const i = p.ideas.find((x) => x.uid === sel)
    return i ? <IdeaPreview project={p} idea={i} /> : null
  },
  code: (p, sel) => (p.ideas.some((x) => x.uid === sel) ? generateIdeas(p) : null),
  renderHeader: () => (
    <div className="mt-2 flex items-center gap-1">
      <button className="btn flex-1 justify-center text-xs" data-copy-game onClick={copyFromGame}>
        Copiar uno del juego
      </button>
      <Help id="espiritu.copiarJuego" />
    </div>
  )
})
