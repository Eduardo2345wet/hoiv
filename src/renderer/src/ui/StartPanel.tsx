// "Situación inicial" de un país (valores, espíritus, tecnologías, diplomacia, guerras) y editor de
// escenarios de inicio (bookmarks). Todo se guarda en Project.countryStart / Project.bookmarks.
import { useMemo, useState } from 'react'
import type { Project } from '../types'
import { newUid } from '../types'
import { store, useApp } from '../store/appStore'
import { BUILTIN_AUTONOMY, newBookmark, setStart, startOf, validateStart } from '../sections/start'
import { nameOfTag, chooseCountryTag } from './countryFlow'
import { fold } from '../catalog/gameIdeas'
import { addAsset } from './projectOps'
import Modal from './Modal'
import { Button, Field, Select, Tabs } from './kit'
import type { Bookmark } from '../sections/types'

const upd = (tag: string, patch: Parameters<typeof setStart>[2], group?: string): void =>
  store.updateProject(
    (p) => setStart(p, tag, patch),
    group ? { group: `start:${tag}:${group}` } : undefined
  )

function Tags({
  value,
  onChange,
  label
}: {
  value: string[]
  onChange: (v: string[]) => void
  label: string
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {value.map((t) => (
        <span key={t} className="rounded bg-hoi-card px-2 py-0.5 text-xs">
          <span className="font-mono">{t}</span> {nameOfTag(t)}{' '}
          <button className="text-hoi-muted" onClick={() => onChange(value.filter((x) => x !== t))}>
            ✕
          </button>
        </span>
      ))}
      <Button
        small
        onClick={() =>
          void chooseCountryTag(label).then(
            (t) => t && !value.includes(t) && onChange([...value, t])
          )
        }
      >
        + País
      </Button>
    </div>
  )
}

function Pct({
  label,
  value,
  onChange,
  help
}: {
  label: string
  value: number | null
  onChange: (v: number | null) => void
  help?: string
}): JSX.Element {
  return (
    <Field
      label={label}
      help={help ?? 'Porcentaje 0–100. Vacío = no se toca lo que dice el juego.'}
    >
      <div className="flex items-center gap-1">
        <input
          type="number"
          className="input w-24"
          min={0}
          max={100}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
        />
        {value !== null && (
          <Button small onClick={() => onChange(null)}>
            Quitar
          </Button>
        )}
      </div>
    </Field>
  )
}

function TechPicker({
  value,
  onChange
}: {
  value: string[]
  onChange: (v: string[]) => void
}): JSX.Element {
  const game = useApp(() => store.catalogGame())
  const [q, setQ] = useState('')
  const all = game?.technologies ?? []
  const hits = useMemo(() => {
    const f = fold(q.trim())
    return f ? all.filter((t) => fold(t.id).includes(f)).slice(0, 30) : []
  }, [q, all])
  return (
    <div>
      <div className="flex flex-wrap gap-1">
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
        className="input mt-1"
        placeholder={
          all.length
            ? `Buscar entre ${all.length} tecnologías del juego…`
            : 'Sin carpeta del juego: escribe el id y Enter'
        }
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && q.trim() && !all.length) {
            onChange([...new Set([...value, q.trim()])])
            setQ('')
          }
        }}
      />
      {hits.length > 0 && (
        <div className="mt-1 max-h-32 overflow-y-auto rounded border border-hoi-border text-xs">
          {hits.map((t) => (
            <div
              key={t.id}
              className="cursor-pointer px-2 py-0.5 hover:bg-hoi-card"
              onClick={() => (onChange([...new Set([...value, t.id])]), setQ(''))}
            >
              {t.id}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export function StartPanel({
  project,
  tag,
  onClose
}: {
  project: Project
  tag: string
  onClose: () => void
}): JSX.Element {
  const game = useApp(() => store.catalogGame())
  const s = startOf(project, tag)
  const [tab, setTab] = useState('valores')
  const autonomy = game?.autonomyStates?.length ? game.autonomyStates : BUILTIN_AUTONOMY
  const issues = validateStart(project, game).filter((i) => i.tag === tag)
  const c = project.countries.find((x) => x.tag === tag)
  return (
    <Modal
      title={`Situación inicial · ${c?.names.name || tag} (${tag})`}
      width={640}
      onClose={onClose}
    >
      <Tabs
        tabs={[
          { id: 'valores', label: 'Valores' },
          { id: 'diplomacia', label: 'Diplomacia' },
          { id: 'guerras', label: 'Guerras' }
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="mt-3 space-y-3">
        {tab === 'valores' && (
          <>
            <Pct
              label="Estabilidad"
              value={s.stability}
              onChange={(v) => upd(tag, { stability: v })}
            />
            <Pct
              label="Apoyo a la guerra"
              value={s.warSupport}
              onChange={(v) => upd(tag, { warSupport: v })}
            />
            <Field label="Convoyes (set_convoys)" help="Vacío = no se toca">
              <input
                type="number"
                className="input w-24"
                min={0}
                value={s.convoys ?? ''}
                onChange={(e) =>
                  upd(tag, { convoys: e.target.value === '' ? null : Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Ranuras de investigación" help="Vacío = no se toca">
              <input
                type="number"
                className="input w-24"
                min={0}
                max={6}
                value={s.researchSlots ?? ''}
                onChange={(e) =>
                  upd(tag, { researchSlots: e.target.value === '' ? null : Number(e.target.value) })
                }
              />
            </Field>
            <Field label="Espíritus iniciales (add_ideas)">
              <div className="flex flex-wrap items-center gap-1">
                {s.ideas.map((i) => (
                  <span key={i} className="rounded bg-hoi-card px-2 py-0.5 font-mono text-xs">
                    {i}{' '}
                    <button onClick={() => upd(tag, { ideas: s.ideas.filter((x) => x !== i) })}>
                      ✕
                    </button>
                  </span>
                ))}
                <Button
                  small
                  onClick={() =>
                    store.set({
                      ideaPicker: {
                        mode: 'use',
                        onUse: (id) => upd(tag, { ideas: [...new Set([...s.ideas, id])] }),
                        onCopy: () => undefined
                      }
                    })
                  }
                >
                  + Del juego
                </Button>
                {project.ideas.length > 0 && (
                  <Select
                    value=""
                    options={[
                      { value: '', label: '+ De mi mod…' },
                      ...project.ideas.map((i) => ({ value: i.id, label: i.name || i.id }))
                    ]}
                    onChange={(v) => v && upd(tag, { ideas: [...new Set([...s.ideas, v])] })}
                  />
                )}
              </div>
            </Field>
            <Field label="Tecnologías iniciales" help="Nivel 1 (set_technology)">
              <TechPicker value={s.technologies} onChange={(v) => upd(tag, { technologies: v })} />
            </Field>
            <Field
              label="Fecha de inicio"
              help="En 1939 todo va en un bloque con fecha; el modo está pensado sobre todo para 1936."
            >
              <Select
                value={s.startDate}
                options={[
                  { value: '1936', label: '1936' },
                  { value: '1939', label: '1939 (bloque con fecha)' }
                ]}
                onChange={(v) => upd(tag, { startDate: v as '1936' | '1939' })}
              />
            </Field>
          </>
        )}
        {tab === 'diplomacia' && (
          <>
            <Field label="Facción">
              <Select
                value={s.faction ? (s.faction.joins ? 'joins' : 'create') : 'none'}
                options={[
                  { value: 'none', label: 'Ninguna' },
                  { value: 'create', label: 'Crear una facción' },
                  { value: 'joins', label: 'Unirse a la de otro país' }
                ]}
                onChange={(v) =>
                  upd(tag, {
                    faction:
                      v === 'none'
                        ? null
                        : { name: s.faction?.name ?? '', joins: v === 'joins' ? '' : null }
                  })
                }
              />
              {s.faction && !s.faction.joins && s.faction.joins !== '' && (
                <input
                  className="input mt-1"
                  placeholder="Nombre de la facción"
                  value={s.faction.name}
                  onChange={(e) =>
                    upd(tag, { faction: { name: e.target.value, joins: null } }, 'fname')
                  }
                />
              )}
              {s.faction && s.faction.joins !== null && (
                <div className="mt-1">
                  <Tags
                    value={s.faction.joins ? [s.faction.joins] : []}
                    onChange={(v) =>
                      upd(tag, { faction: { name: '', joins: v[v.length - 1] ?? '' } })
                    }
                    label="Unirse a la facción de…"
                  />
                </div>
              )}
            </Field>
            <Field label="Títeres" help="Nivel de autonomía leído del juego">
              {s.puppets.map((pu, i) => (
                <div key={i} className="mb-1 flex items-center gap-1 text-xs">
                  <span className="font-mono">{pu.tag}</span> {nameOfTag(pu.tag)}
                  <Select
                    value={pu.autonomy}
                    options={autonomy.map((a) => ({ value: a, label: a }))}
                    onChange={(v) =>
                      upd(tag, {
                        puppets: s.puppets.map((x, n) => (n === i ? { ...x, autonomy: v } : x))
                      })
                    }
                  />
                  <Button
                    small
                    onClick={() => upd(tag, { puppets: s.puppets.filter((_, n) => n !== i) })}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              <Button
                small
                onClick={() =>
                  void chooseCountryTag('Títere de ' + tag).then(
                    (t) =>
                      t &&
                      upd(tag, {
                        puppets: [
                          ...s.puppets,
                          { tag: t, autonomy: autonomy[0] ?? 'autonomy_puppet' }
                        ]
                      })
                  )
                }
              >
                + Títere
              </Button>
            </Field>
            <Field label="Garantías (give_guarantee)">
              <Tags
                value={s.guarantees}
                onChange={(v) => upd(tag, { guarantees: v })}
                label="Garantizar a…"
              />
            </Field>
          </>
        )}
        {tab === 'guerras' && (
          <Field
            label="Guerras al inicio"
            help="Se generan con on_actions (on_startup) y declare_war_on. Por verificar con los archivos del juego."
          >
            <Tags
              value={s.wars}
              onChange={(v) => upd(tag, { wars: v })}
              label="Declarar la guerra a…"
            />
          </Field>
        )}
        {issues.map((i, n) => (
          <p
            key={n}
            className={`text-xs ${i.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}`}
          >
            {i.message}
          </p>
        ))}
      </div>
    </Modal>
  )
}

const patchB = (uid: string, p: Partial<Bookmark>, group?: string): void =>
  store.updateProject(
    (pr) => ({
      ...pr,
      bookmarks: (pr.bookmarks ?? []).map((b) => (b.uid === uid ? { ...b, ...p } : b))
    }),
    group ? { group: `bookmark:${uid}:${group}` } : undefined
  )

export function ScenariosDialog({
  project,
  onClose
}: {
  project: Project
  onClose: () => void
}): JSX.Element {
  const bs = project.bookmarks ?? []
  return (
    <Modal title="Escenarios de inicio (bookmarks)" width={680} onClose={onClose}>
      <p className="mb-2 text-xs text-hoi-muted">
        Opcional. Cada escenario aparece en la pantalla de selección de partida. El modo está
        pensado sobre todo para 1936.
      </p>
      {bs.map((b) => (
        <div key={b.uid} className="mb-3 space-y-2 rounded border border-hoi-border p-2">
          <div className="flex gap-2">
            <input
              className="input flex-1"
              placeholder="Nombre"
              value={b.name}
              onChange={(e) => patchB(b.uid, { name: e.target.value }, 'name')}
            />
            <input
              className="input w-36 font-mono"
              value={b.date}
              onChange={(e) => patchB(b.uid, { date: e.target.value.trim() }, 'date')}
            />
            <Button
              small
              onClick={() =>
                store.updateProject((p) => ({
                  ...p,
                  bookmarks: p.bookmarks.filter((x) => x.uid !== b.uid)
                }))
              }
            >
              Borrar
            </Button>
          </div>
          <textarea
            className="input h-14"
            placeholder="Descripción"
            value={b.description}
            onChange={(e) => patchB(b.uid, { description: e.target.value }, 'desc')}
          />
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <label>
              Imagen:{' '}
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const f = e.target.files?.[0]
                  if (!f) return
                  const r = new FileReader()
                  r.onload = () => {
                    const id = newUid()
                    store.updateProject((p) =>
                      addAsset(p, {
                        id,
                        name: f.name,
                        target: 'idea',
                        png: String(r.result),
                        width: 640,
                        height: 220
                      })
                    )
                    patchB(b.uid, { picture: { kind: 'asset', assetId: id } })
                  }
                  r.readAsDataURL(f)
                }}
              />
            </label>
            <label className="flex items-center gap-1">
              <input
                type="checkbox"
                checked={b.isDefault}
                onChange={(e) => patchB(b.uid, { isDefault: e.target.checked })}
              />
              Es el escenario por defecto
            </label>
          </div>
          <Field
            label="Países destacados"
            help="El primero con ✔ es el país por defecto del escenario"
          >
            {b.featured.map((f, i) => (
              <div key={f.tag} className="mb-1 flex items-center gap-1 text-xs">
                <input
                  type="radio"
                  title="País por defecto"
                  checked={b.defaultCountry === f.tag}
                  onChange={() => patchB(b.uid, { defaultCountry: f.tag })}
                />
                <span className="font-mono">{f.tag}</span> {nameOfTag(f.tag)}
                <input
                  className="input flex-1"
                  placeholder="Texto de historia"
                  value={f.history}
                  onChange={(e) =>
                    patchB(
                      b.uid,
                      {
                        featured: b.featured.map((x, n) =>
                          n === i ? { ...x, history: e.target.value } : x
                        )
                      },
                      `hist${i}`
                    )
                  }
                />
                <Button
                  small
                  onClick={() => patchB(b.uid, { featured: b.featured.filter((_, n) => n !== i) })}
                >
                  ✕
                </Button>
              </div>
            ))}
            <Button
              small
              onClick={() =>
                void chooseCountryTag('País destacado').then(
                  (t) =>
                    t &&
                    !b.featured.some((x) => x.tag === t) &&
                    patchB(b.uid, {
                      featured: [
                        ...b.featured,
                        {
                          tag: t,
                          ideology:
                            project.countries.find((c) => c.tag === t)?.politics.ruling ??
                            'neutrality',
                          history: '',
                          ideas: [],
                          focuses: []
                        }
                      ]
                    })
                )
              }
            >
              + País destacado
            </Button>
          </Field>
        </div>
      ))}
      <Button
        onClick={() =>
          store.updateProject((p) => ({ ...p, bookmarks: [...(p.bookmarks ?? []), newBookmark()] }))
        }
      >
        + Nuevo escenario
      </Button>
    </Modal>
  )
}
