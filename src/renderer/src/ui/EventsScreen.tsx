// Pestaña Eventos: lista por namespace, editor (General · Texto · Opciones · Avanzado), vista previa
// al estilo del juego, cadena de eventos y bloques en las opciones.
import { useState } from 'react'
import type { Project } from '../types'
import { store, useApp } from '../store/appStore'
import { registerSectionScreen } from '../sections/ui'
import {
  createEvent,
  deleteEvent,
  duplicateEvent,
  eventFiles,
  eventFromTemplate,
  eventId,
  eventLinks,
  eventPng,
  EVENT_TEMPLATES,
  updateEvent,
  validateEvents
} from '../sections/events'
import { newUid } from '../types'
import { emptyScript, type BlockScript, type EventOption, type GameEvent } from '../sections/types'
import { appendBlock } from '../blocks/area'
import { EVENT_TYPES } from '../blocks/effects'
import { chooseCountryTag } from './countryFlow'
import BlocklyArea from './BlocklyArea'
import { Badge, Button, Card, Field, NumberField, Select, Tabs } from './kit'

const patch = (uid: string, p: Partial<GameEvent>, group?: string): void =>
  store.updateProject(
    (pr) => updateEvent(pr, uid, p),
    group ? { group: `field:${uid}:${group}` } : undefined
  )

function PictureChooser({ project, ev }: { project: Project; ev: GameEvent }): JSX.Element {
  const game = useApp(() => store.catalogGame())
  const [open, setOpen] = useState(false)
  const pics = game?.eventPictures ?? []
  const pic = ev.picture
  const png = eventPng(project, pic)
  return (
    <Field
      label="Imagen"
      help="Del juego, subida (se recorta al tamaño de las del juego) o de tu biblioteca"
    >
      <div className="flex items-center gap-2">
        {png ? (
          <img src={png} alt="" className="h-12 rounded" />
        ) : (
          <span className="text-xs text-hoi-muted">
            {pic?.kind === 'game' ? pic.gfx : 'sin imagen'}
          </span>
        )}
        <Button small onClick={() => setOpen(!open)}>
          Elegir…
        </Button>
        <label className="btn cursor-pointer px-2 py-0.5 text-xs">
          Subir…
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              if (!f) return
              const r = new FileReader()
              r.onload = () =>
                patch(ev.uid, { picture: { kind: 'upload', png: String(r.result), name: f.name } })
              r.readAsDataURL(f)
            }}
          />
        </label>
        {pic && (
          <Button small onClick={() => patch(ev.uid, { picture: null })}>
            Quitar
          </Button>
        )}
      </div>
      {open && (
        <div className="mt-2 max-h-40 overflow-y-auto rounded border border-hoi-border p-1 text-xs">
          <div className="mb-1 font-semibold text-hoi-muted">
            Del juego {pics.length ? `(${pics.length})` : '(sin carpeta del juego)'}
          </div>
          {pics.map((g) => (
            <div
              key={g}
              className="cursor-pointer px-1 hover:bg-hoi-card"
              onClick={() => (patch(ev.uid, { picture: { kind: 'game', gfx: g } }), setOpen(false))}
            >
              {g}
            </div>
          ))}
          <div className="mt-1 font-semibold text-hoi-muted">
            Mi biblioteca ({project.icons.length})
          </div>
          {project.icons.map((a) => (
            <div
              key={a.id}
              className="flex cursor-pointer items-center gap-1 px-1 hover:bg-hoi-card"
              onClick={() => (
                patch(ev.uid, { picture: { kind: 'asset', assetId: a.id } }),
                setOpen(false)
              )}
            >
              <img src={a.png} alt="" className="h-5" /> {a.name}
            </div>
          ))}
        </div>
      )}
    </Field>
  )
}

function CountryChips({
  value,
  onChange
}: {
  value: string[]
  onChange: (v: string[]) => void
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {value.map((t) => (
        <span key={t} className="rounded bg-hoi-card px-2 py-0.5 font-mono text-xs">
          {t}{' '}
          <button className="text-hoi-muted" onClick={() => onChange(value.filter((x) => x !== t))}>
            ✕
          </button>
        </span>
      ))}
      <Button
        small
        onClick={() =>
          void chooseCountryTag('Añadir país').then(
            (t) => t && !value.includes(t) && onChange([...value, t])
          )
        }
      >
        + País
      </Button>
    </div>
  )
}

function Preview({ project, ev }: { project: Project; ev: GameEvent }): JSX.Element {
  const png = eventPng(project, ev.picture)
  return (
    <div className="mx-auto w-72 rounded border border-hoi-border bg-black/40 p-2 text-center text-xs">
      {png && <img src={png} alt="" className="mx-auto mb-1 w-full rounded" />}
      <div className="font-semibold">
        {ev.flags.hidden ? '(evento oculto)' : ev.title || 'Título'}
      </div>
      <p className="my-1 text-hoi-muted">{ev.description || 'Descripción'}</p>
      {ev.options.map((o) => (
        <div key={o.uid} className="mt-1 rounded border border-hoi-border bg-hoi-card px-2 py-1">
          {o.name || '(opción)'}
        </div>
      ))}
    </div>
  )
}

function Chain({
  project,
  selected,
  select
}: {
  project: Project
  selected: string | null
  select: (uid: string) => void
}): JSX.Element {
  const links = eventLinks(project)
  // Columnas por profundidad desde los eventos que nadie lanza
  const targeted = new Set(links.map((l) => l.to))
  const col = new Map<string, number>()
  const queue = project.events.filter((e) => !targeted.has(e.uid)).map((e) => e.uid)
  queue.forEach((u) => col.set(u, 0))
  for (let i = 0; i < queue.length; i++)
    for (const l of links)
      if (l.from === queue[i] && !col.has(l.to))
        (col.set(l.to, col.get(queue[i])! + 1), queue.push(l.to))
  for (const e of project.events) if (!col.has(e.uid)) col.set(e.uid, 0)
  const rowIn = new Map<number, number>()
  const pos = new Map<string, { x: number; y: number }>()
  for (const e of project.events) {
    const c = col.get(e.uid)!
    const r = rowIn.get(c) ?? 0
    rowIn.set(c, r + 1)
    pos.set(e.uid, { x: 20 + c * 190, y: 20 + r * 70 })
  }
  const W = 20 + (Math.max(0, ...col.values()) + 1) * 190
  const H = 40 + Math.max(1, ...rowIn.values()) * 70
  return (
    <div className="overflow-auto p-3">
      <div className="relative" style={{ width: W, height: H }}>
        <svg className="absolute inset-0" width={W} height={H}>
          {links.map((l, i) => {
            const a = pos.get(l.from)!
            const b = pos.get(l.to)!
            return (
              <line
                key={i}
                x1={a.x + 160}
                y1={a.y + 22}
                x2={b.x}
                y2={b.y + 22}
                stroke="#e8913a"
                strokeWidth={2}
                markerEnd="url(#arr)"
              />
            )
          })}
          <defs>
            <marker id="arr" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill="#e8913a" />
            </marker>
          </defs>
        </svg>
        {project.events.map((e) => (
          <div
            key={e.uid}
            onClick={() => select(e.uid)}
            className={`absolute w-40 cursor-pointer rounded border-2 bg-hoi-card px-2 py-1 text-xs ${e.uid === selected ? 'border-hoi-accent' : 'border-hoi-border'}`}
            style={{ left: pos.get(e.uid)!.x, top: pos.get(e.uid)!.y, height: 44 }}
          >
            <div className="font-mono text-[10px] text-hoi-muted">{eventId(e)}</div>
            <div className="truncate">{e.title || '(sin título)'}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Options({ project, ev }: { project: Project; ev: GameEvent }): JSX.Element {
  const setOpt = (i: number, o: Partial<EventOption>): void =>
    patch(ev.uid, { options: ev.options.map((x, n) => (n === i ? { ...x, ...o } : x)) })
  const move = (i: number, d: number): void => {
    const a = [...ev.options]
    const j = i + d
    if (j < 0 || j >= a.length) return
    ;[a[i], a[j]] = [a[j], a[i]]
    patch(ev.uid, { options: a })
  }
  return (
    <>
      {ev.options.map((o, i) => (
        <Card
          key={o.uid}
          title={`Opción ${i + 1}`}
          actions={
            <span className="flex gap-1">
              <Button small onClick={() => move(i, -1)}>
                ↑
              </Button>
              <Button small onClick={() => move(i, 1)}>
                ↓
              </Button>
              <Button
                small
                onClick={() => patch(ev.uid, { options: ev.options.filter((_, n) => n !== i) })}
              >
                Borrar
              </Button>
            </span>
          }
        >
          <Field label="Texto del botón">
            <input
              className="input"
              value={o.name}
              onChange={(e) => setOpt(i, { name: e.target.value })}
            />
          </Field>
          <Field
            label="ai_chance (base)"
            help="Proporcional entre las opciones; 0 = la IA no la elige al azar"
          >
            <NumberField value={o.aiBase} min={0} onChange={(v) => setOpt(i, { aiBase: v })} />
          </Field>
          <Field
            label="Condición (opcional)"
            help="Si todas las opciones tienen condición y ninguna se cumple, la ventana queda sin botones"
          >
            <BlocklyArea
              mode="condition"
              value={o.trigger}
              onChange={(v) => setOpt(i, { trigger: v })}
              height={160}
            />
          </Field>
          <Field label="Efectos">
            <BlocklyArea
              mode="effect"
              value={o.effects}
              onChange={(v) => setOpt(i, { effects: v })}
              height={220}
            />
          </Field>
          <Field label="Enlazar a otro evento">
            <Select
              value=""
              options={[
                { value: '', label: 'Lanzar evento…' },
                ...project.events
                  .filter((e) => e.uid !== ev.uid)
                  .map((e) => ({ value: eventId(e), label: `${eventId(e)} ${e.title}` }))
              ]}
              onChange={(id) => {
                if (!id) return
                const nb = appendBlock(o.effects, 'effect', 'country', {
                  type: 'eff_fire_event',
                  fields: { TYPE: 'country_event', EVENT: id, DAYS: 1, RANDOM: 0, TARGET: '' }
                })
                setOpt(i, { effects: nb })
              }}
            />
          </Field>
        </Card>
      ))}
      <Button
        onClick={() =>
          patch(ev.uid, {
            options: [
              ...ev.options,
              { uid: newUid(), name: '', trigger: emptyScript(), effects: emptyScript(), aiBase: 1 }
            ]
          })
        }
      >
        + Añadir opción
      </Button>
    </>
  )
}

function Editor({ project, uid }: { project: Project; uid: string }): JSX.Element | null {
  const ev = project.events.find((e) => e.uid === uid)
  const [tab, setTab] = useState('general')
  if (!ev) return null
  const fl = (o: Partial<GameEvent['flags']>): void =>
    patch(ev.uid, { flags: { ...ev.flags, ...o } })
  const script = (
    k: 'trigger' | 'immediate' | 'after',
    mode: 'effect' | 'condition',
    label: string
  ): JSX.Element => (
    <Field label={label}>
      <BlocklyArea
        mode={mode}
        value={ev[k] as BlockScript}
        onChange={(v) => patch(ev.uid, { [k]: v })}
        height={200}
      />
    </Field>
  )
  return (
    <div className="p-4">
      <div className="mb-2 flex items-center gap-2">
        <h2 className="font-mono text-sm">{eventId(ev)}</h2>
        <Badge>{ev.type}</Badge>
      </div>
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'general', label: 'General' },
          { id: 'texto', label: 'Texto' },
          { id: 'opciones', label: 'Opciones' },
          { id: 'avanzado', label: 'Avanzado' }
        ]}
      />
      <div className="mt-3 max-w-3xl">
        {tab === 'general' && (
          <>
            <Field label="Tipo">
              <Select
                value={ev.type}
                options={EVENT_TYPES.map(([l, v]) => ({ value: v, label: l }))}
                onChange={(v) => patch(ev.uid, { type: v as GameEvent['type'] })}
              />
            </Field>
            <Field label="Namespace" help="Se declara con add_namespace; minúsculas, números y _">
              <input
                className="input w-64 font-mono"
                value={ev.namespace}
                onChange={(e) => patch(ev.uid, { namespace: e.target.value }, 'ns')}
              />
            </Field>
            <Field label="Número" help="Entero entre 1 y 99999">
              <NumberField
                value={ev.number}
                min={1}
                max={99999}
                onChange={(v) => patch(ev.uid, { number: v })}
              />
            </Field>
            <Field
              label="Países"
              help="Si es automático, limita a quién le pasa (vacío = cualquiera)"
            >
              <CountryChips
                value={ev.countries}
                onChange={(v) => patch(ev.uid, { countries: v })}
              />
            </Field>
            <PictureChooser project={project} ev={ev} />
          </>
        )}
        {tab === 'texto' && (
          <>
            <Field label="Título">
              <input
                className="input"
                value={ev.title}
                onChange={(e) => patch(ev.uid, { title: e.target.value }, 'title')}
              />
            </Field>
            <Field label="Descripción">
              <textarea
                className="input h-24"
                value={ev.description}
                onChange={(e) => patch(ev.uid, { description: e.target.value }, 'desc')}
              />
            </Field>
            {(['titleVariants', 'descVariants'] as const).map((k) => (
              <Card
                key={k}
                title={
                  k === 'titleVariants'
                    ? 'Variantes del título (condicionales)'
                    : 'Variantes de la descripción (condicionales)'
                }
                actions={
                  <Button
                    small
                    onClick={() =>
                      patch(ev.uid, { [k]: [...ev[k], { text: '', trigger: emptyScript() }] })
                    }
                  >
                    + Variante
                  </Button>
                }
              >
                {ev[k].map((v, i) => (
                  <div key={i} className="mb-2">
                    <input
                      className="input mb-1"
                      placeholder="Texto"
                      value={v.text}
                      onChange={(e) =>
                        patch(ev.uid, {
                          [k]: ev[k].map((x, n) => (n === i ? { ...x, text: e.target.value } : x))
                        })
                      }
                    />
                    <BlocklyArea
                      mode="condition"
                      value={v.trigger}
                      height={140}
                      onChange={(t) =>
                        patch(ev.uid, {
                          [k]: ev[k].map((x, n) => (n === i ? { ...x, trigger: t } : x))
                        })
                      }
                    />
                    <Button
                      small
                      onClick={() => patch(ev.uid, { [k]: ev[k].filter((_, n) => n !== i) })}
                    >
                      Quitar variante
                    </Button>
                  </div>
                ))}
              </Card>
            ))}
            <Preview project={project} ev={ev} />
          </>
        )}
        {tab === 'opciones' && <Options project={project} ev={ev} />}
        {tab === 'avanzado' && (
          <>
            <Card title="Banderas">
              {(
                [
                  ['triggeredOnly', 'Solo por disparo (is_triggered_only)'],
                  ['fireOnlyOnce', 'Una vez en todo el juego (fire_only_once)'],
                  ['major', 'Para todos los países (major)'],
                  ['hidden', 'Oculto (sin título)'],
                  ['minorFlavor', 'minor_flavor']
                ] as const
              ).map(([k, l]) => (
                <label key={k} className="mb-1 flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={ev.flags[k]}
                    onChange={(e) => fl({ [k]: e.target.checked })}
                  />
                  {l}
                </label>
              ))}
            </Card>
            <Field label="mean_time_to_happen (días)" help="Solo para eventos automáticos">
              <NumberField
                value={ev.mtthDays}
                min={0}
                onChange={(v) => patch(ev.uid, { mtthDays: v })}
              />
            </Field>
            <Field label="timeout_days" help="0 = el valor por defecto (13)">
              <NumberField
                value={ev.timeoutDays}
                min={0}
                onChange={(v) => patch(ev.uid, { timeoutDays: v })}
              />
            </Field>
            {script('trigger', 'condition', 'Condición (trigger)')}
            {script('immediate', 'effect', 'immediate (antes de elegir)')}
            {script('after', 'effect', 'after (después de elegir)')}
          </>
        )}
      </div>
    </div>
  )
}

function Side({ project, uid }: { project: Project; uid: string | null }): JSX.Element {
  const ev = project.events.find((e) => e.uid === uid)
  if (!ev) return <p className="text-xs text-hoi-muted">Elige un evento para ver su script.</p>
  const issues = validateEvents(project).filter((i) => i.uid === ev.uid)
  const text = eventFiles({ ...project, events: [ev] })[0]?.text ?? ''
  return (
    <div className="text-xs">
      <Button
        small
        onClick={() =>
          void navigator.clipboard
            ?.writeText(`event ${eventId(ev)}`)
            .then(() => store.toast(`Copiado: event ${eventId(ev)} (consola del juego con -debug)`))
        }
      >
        Copiar comando de consola
      </Button>
      {issues.map((i, n) => (
        <p
          key={n}
          className={`mt-2 ${i.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}`}
        >
          {i.message}
        </p>
      ))}
      <pre className="mt-2 whitespace-pre-wrap rounded bg-hoi-card p-2 font-mono text-[11px]">
        {text}
      </pre>
    </div>
  )
}

function mk(
  over: Partial<GameEvent> | null,
  tpl?: Parameters<typeof eventFromTemplate>[1]
): string {
  let uid = ''
  store.updateProject((p) => {
    const r = tpl
      ? { project: { ...p, events: [...p.events, eventFromTemplate(p, tpl)] }, event: null }
      : createEvent(p, over ?? {})
    uid = tpl ? r.project.events[r.project.events.length - 1].uid : r.event!.uid
    return r.project
  })
  return uid
}

registerSectionScreen('eventos', {
  create: () => mk({}),
  duplicate: (uid) => {
    let out: string | null = null
    store.updateProject((p) => {
      const r = duplicateEvent(p, uid)
      out = r?.event.uid ?? null
      return r?.project ?? p
    })
    return out
  },
  remove: (uid) => {
    const e = store.get().project?.events.find((x) => x.uid === uid)
    if (e && confirm(`¿Borrar el evento ${eventId(e)}?`))
      store.updateProject((p) => deleteEvent(p, uid))
  },
  templates: EVENT_TEMPLATES.map((t) => ({
    id: t.id,
    label: t.label,
    create: () => mk(null, t.id)
  })),
  label: (i) => `${i.namespace}.${i.number}  ${i.title ?? ''}`,
  renderEditor: (p, sel) => (sel ? <Editor project={p} uid={sel} /> : null),
  renderPreview: (p, sel) => <Side project={p} uid={sel} />,
  renderOverview: (p, sel, select) => <Chain project={p} selected={sel} select={select} />
})
