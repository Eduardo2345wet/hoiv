// Pestaña Eventos: grupos de eventos (cada grupo es un namespace y un archivo), editor en tarjetas
// (Básico · Opciones · Cuándo ocurre · Opciones avanzadas) y vista previa visual como en el juego.
import { useState } from 'react'
import { EyeOff, Flag, GitFork, Newspaper } from 'lucide-react'
import type { Project } from '../types'
import { newUid } from '../types'
import { store, useApp } from '../store/appStore'
import { registerSectionScreen, type GroupNode } from '../sections/ui'
import {
  EVENT_PICTURE_SIZE,
  EVENT_TEMPLATES,
  createEventGroup,
  deleteEvent,
  deleteEventGroup,
  duplicateEvent,
  eventFiles,
  eventFromTemplate,
  eventGroupList,
  eventGroupName,
  eventId,
  eventLinks,
  eventPng,
  linkedEventIds,
  renameEventGroup,
  updateEvent,
  validateEvents,
  type EventTemplate
} from '../sections/events'
import { emptyScript, type BlockScript, type EventOption, type GameEvent } from '../sections/types'
import { appendBlock } from '../blocks/area'
import { chooseCountryTag } from './countryFlow'
import { runCommand } from './commands'
import BlocklyArea from './BlocklyArea'
import GameIconPicker from './GameIconPicker'
import GameSprite from './GameSprite'
import ImageUploader from './ImageUploader'
import Modal from './Modal'
import Help from './Help'
import { useSpriteThumb } from '../catalog/gameSprites'
import { Button, Card, Field, NumberField, Select, type CardNote } from './kit'
import { TemplateGallery } from './SectionParts'

const patch = (uid: string, p: Partial<GameEvent>, group?: string): void =>
  store.updateProject(
    (pr) => updateEvent(pr, uid, p),
    group ? { group: `field:${uid}:${group}` } : undefined
  )

const TEMPLATE_ICONS: Record<EventTemplate, JSX.Element> = {
  pais: <Flag size={20} />,
  noticias: <Newspaper size={20} />,
  eleccion: <GitFork size={20} />,
  oculto: <EyeOff size={20} />
}

/** Imagen del evento (propia o del juego) en miniatura */
function EventThumb({
  project,
  ev,
  h
}: {
  project: Project
  ev: GameEvent
  h: number
}): JSX.Element {
  const png = eventPng(project, ev.picture)
  if (png) return <img src={png} alt="" style={{ height: h }} className="rounded object-cover" />
  if (ev.picture?.kind === 'game') return <GameSprite name={ev.picture.gfx} height={h} />
  return <GameSprite name={null} height={h} />
}

/** Imagen a todo el ancho con la proporción real de las imágenes de evento del juego */
function PictureFill({
  project,
  ev,
  ratio
}: {
  project: Project
  ev: GameEvent
  ratio: number
}): JSX.Element {
  const png = eventPng(project, ev.picture)
  const sprite = useSpriteThumb(ev.picture?.kind === 'game' ? ev.picture.gfx : null)
  const src = png ?? sprite ?? null
  return (
    <div
      className="w-full overflow-hidden rounded-sm bg-black/40"
      style={{ aspectRatio: `${ratio}` }}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-center justify-center text-xs text-hoi-muted">
          Sin imagen
        </div>
      )}
    </div>
  )
}

/** Vista previa: imita la ventana del evento del juego (país o noticia), actualizada en vivo */
function EventPreview({ project, ev }: { project: Project; ev: GameEvent }): JSX.Element {
  const game = useApp(() => store.catalogGame())
  const size = game?.eventPictureSize ?? EVENT_PICTURE_SIZE
  const ratio = size.w / size.h
  const news = ev.type === 'news_event'
  if (ev.flags.hidden)
    return (
      <div className="rounded-lg border border-dashed border-hoi-border p-4 text-center text-xs text-hoi-muted">
        Evento oculto: no muestra ninguna ventana, solo ejecuta sus efectos.
      </div>
    )
  return (
    <div data-event-preview={news ? 'news' : 'country'} className="mx-auto w-full max-w-[340px]">
      <div
        className={
          news
            ? 'rounded-sm border-2 border-[#6b5d3c] bg-[#e8dfc5] p-3 text-[#2a2418] shadow-lg'
            : 'rounded-sm border-2 border-[#8c7b4f] bg-[#232b36] p-3 text-hoi-text shadow-lg'
        }
      >
        {news && (
          <div className="mb-2 border-b border-[#6b5d3c] pb-1 text-center text-[10px] uppercase tracking-[0.25em]">
            Noticias del mundo
          </div>
        )}
        <div
          data-preview-title
          className={`mb-2 text-center text-base font-semibold ${news ? 'font-serif text-lg' : ''}`}
        >
          {ev.title || 'Título del evento'}
        </div>
        <PictureFill project={project} ev={ev} ratio={ratio} />
        <p
          data-preview-text
          className={`my-3 whitespace-pre-wrap text-xs leading-relaxed ${news ? 'text-[#3d3424]' : 'text-gray-300'}`}
        >
          {ev.description || 'Aquí va el texto del evento.'}
        </p>
        <div className="space-y-1.5">
          {(ev.options.length ? ev.options : [{ uid: 'x', name: '' } as EventOption]).map((o) => (
            <div
              key={o.uid}
              data-preview-option
              className={`rounded-sm border px-2 py-1.5 text-center text-xs ${news ? 'border-[#6b5d3c] bg-[#d8ccab]' : 'border-[#5a6578] bg-[#2f3947]'}`}
            >
              {o.name || 'Opción'}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Cadena de eventos (vista general) */
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

function notesOf(
  project: Project,
  ev: GameEvent
): Record<'basic' | 'options' | 'when' | 'adv', CardNote[]> {
  const out: Record<'basic' | 'options' | 'when' | 'adv', CardNote[]> = {
    basic: [],
    options: [],
    when: [],
    adv: []
  }
  for (const i of validateEvents(project).filter((x) => x.uid === ev.uid)) {
    const text = i.message.replace(/^Evento [^:]+: /, '')
    const note: CardNote = {
      severity: i.severity === 'error' ? 'error' : 'aviso',
      text: text.charAt(0).toUpperCase() + text.slice(1)
    }
    if (/título|descripción|imagen/i.test(text)) out.basic.push(note)
    else if (/opci/i.test(text)) out.options.push(note)
    else if (/autom|MTTH|país|mean_time|disparo|condici/i.test(text)) out.when.push(note)
    else out.adv.push(note)
  }
  return out
}

function PictureCard({ project, ev }: { project: Project; ev: GameEvent }): JSX.Element {
  const game = useApp(() => store.catalogGame())
  const size = game?.eventPictureSize ?? EVENT_PICTURE_SIZE
  const [dlg, setDlg] = useState<'game' | 'upload' | 'library' | null>(null)
  return (
    <Field label="Imagen">
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-24 items-center justify-center overflow-hidden rounded bg-hoi-bg">
          <EventThumb project={project} ev={ev} h={64} />
        </div>
        <div className="flex flex-wrap gap-1">
          <Button small onClick={() => setDlg('game')}>
            Elegir del juego
          </Button>
          <Button small onClick={() => setDlg('upload')}>
            Subir imagen
          </Button>
          <Button small onClick={() => setDlg('library')}>
            Mi biblioteca
          </Button>
          {ev.picture && (
            <Button small onClick={() => patch(ev.uid, { picture: null })}>
              Quitar
            </Button>
          )}
        </div>
      </div>
      {dlg === 'game' && (
        <GameIconPicker
          kind="event"
          current={ev.picture?.kind === 'game' ? ev.picture.gfx : null}
          onClose={() => setDlg(null)}
          onPick={(gfx) => {
            patch(ev.uid, { picture: { kind: 'game', gfx } })
            setDlg(null)
          }}
        />
      )}
      {dlg === 'upload' && (
        <ImageUploader
          size={size}
          title="Imagen del evento"
          onClose={() => setDlg(null)}
          onAcceptImage={(png) => {
            patch(ev.uid, { picture: { kind: 'upload', png, name: 'imagen.png' } })
            setDlg(null)
          }}
        />
      )}
      {dlg === 'library' && (
        <Modal title="Mi biblioteca" width={560} onClose={() => setDlg(null)}>
          <div className="grid grid-cols-4 gap-2">
            {project.icons.map((a) => (
              <button
                key={a.id}
                className="flex flex-col items-center gap-1 rounded border border-hoi-border p-2 hover:bg-hoi-card"
                onClick={() => {
                  patch(ev.uid, { picture: { kind: 'asset', assetId: a.id } })
                  setDlg(null)
                }}
              >
                <img src={a.png} alt="" style={{ height: 48 }} />
                <span className="w-full truncate text-[11px]">{a.name}</span>
              </button>
            ))}
          </div>
          {!project.icons.length && (
            <p className="text-sm text-hoi-muted">Tu biblioteca está vacía.</p>
          )}
        </Modal>
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
            x
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
        Añadir país
      </Button>
    </div>
  )
}

function OptionsCard({
  project,
  ev,
  notes
}: {
  project: Project
  ev: GameEvent
  notes: CardNote[]
}): JSX.Element {
  const setOpt = (i: number, o: Partial<EventOption>): void =>
    patch(ev.uid, { options: ev.options.map((x, n) => (n === i ? { ...x, ...o } : x)) })
  const move = (i: number, d: number): void => {
    const a = [...ev.options]
    const j = i + d
    if (j < 0 || j >= a.length) return
    ;[a[i], a[j]] = [a[j], a[i]]
    patch(ev.uid, { options: a })
  }
  const siblings = project.events.filter((e) => e.namespace === ev.namespace && e.uid !== ev.uid)
  const titleOf = (id: string): string => {
    const e = project.events.find((x) => eventId(x) === id)
    return e ? e.title || 'Evento sin título' : id
  }
  return (
    <Card
      title="Opciones (botones)"
      notes={notes}
      actions={
        <Button
          small
          onClick={() =>
            patch(ev.uid, {
              options: [
                ...ev.options,
                {
                  uid: newUid(),
                  name: '',
                  trigger: emptyScript(),
                  effects: emptyScript(),
                  aiBase: 1
                }
              ]
            })
          }
        >
          Añadir opción
        </Button>
      }
    >
      {ev.options.map((o, i) => {
        const linked = linkedEventIds(o.effects.code)
        return (
          <div key={o.uid} className="mb-3 rounded border border-hoi-border bg-hoi-bg/40 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs text-hoi-muted">Opción {i + 1}</span>
              <span className="flex gap-1">
                <Button small onClick={() => move(i, -1)}>
                  Subir
                </Button>
                <Button small onClick={() => move(i, 1)}>
                  Bajar
                </Button>
                <Button
                  small
                  onClick={() => patch(ev.uid, { options: ev.options.filter((_, n) => n !== i) })}
                >
                  Quitar
                </Button>
              </span>
            </div>
            <Field label="Texto del botón">
              <input
                className="input"
                value={o.name}
                onChange={(e) => setOpt(i, { name: e.target.value })}
              />
            </Field>
            <Field label="Qué pasa al elegirla">
              <BlocklyArea
                mode="effect"
                value={o.effects}
                onChange={(v) => setOpt(i, { effects: v })}
                height={200}
              />
            </Field>
            <Field label="Lleva después a">
              {linked.length > 0 && (
                <p className="mb-1 text-xs text-hoi-muted">
                  {linked.map((id) => titleOf(id)).join(', ')}
                </p>
              )}
              <Select
                value=""
                options={[
                  {
                    value: '',
                    label: siblings.length
                      ? 'Elegir un evento del grupo…'
                      : 'No hay más eventos en este grupo'
                  },
                  ...siblings.map((e) => ({
                    value: eventId(e),
                    label: e.title || 'Evento sin título'
                  }))
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
            <details className="text-xs">
              <summary className="cursor-pointer text-hoi-muted hover:text-hoi-text">
                Más sobre esta opción
              </summary>
              <div className="mt-2">
                <Field label="Solo se ofrece si se cumple">
                  <BlocklyArea
                    mode="condition"
                    value={o.trigger}
                    onChange={(v) => setOpt(i, { trigger: v })}
                    height={150}
                  />
                </Field>
                <Field label="Probabilidad para la IA" help="0 = la IA nunca la elige al azar">
                  <NumberField
                    value={o.aiBase}
                    min={0}
                    onChange={(v) => setOpt(i, { aiBase: v })}
                  />
                </Field>
              </div>
            </details>
          </div>
        )
      })}
    </Card>
  )
}

function Editor({ project, uid }: { project: Project; uid: string }): JSX.Element | null {
  const ev = project.events.find((e) => e.uid === uid)
  if (!ev) return null
  const fl = (o: Partial<GameEvent['flags']>): void =>
    patch(ev.uid, { flags: { ...ev.flags, ...o } })
  const notes = notesOf(project, ev)
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
        height={190}
      />
    </Field>
  )
  const types = [
    {
      id: 'country_event',
      label: 'Evento de país',
      description: 'Una ventana para el país afectado, con opciones.',
      thumb: <Flag size={20} />
    },
    {
      id: 'news_event',
      label: 'Noticia mundial',
      description: 'Un titular que ven todos los jugadores.',
      thumb: <Newspaper size={20} />
    },
    ...(ev.type === 'state_event'
      ? [
          {
            id: 'state_event',
            label: 'Evento de estado',
            description: 'Ocurre sobre un estado concreto.',
            thumb: <Flag size={20} />
          }
        ]
      : [])
  ]
  const auto = !ev.flags.triggeredOnly
  return (
    <div className="mx-auto max-w-3xl p-5" data-event-editor>
      <Card title="Básico" notes={notes.basic}>
        <Field label="Título">
          <input
            data-ev-title
            className="input"
            value={ev.title}
            onChange={(e) => patch(ev.uid, { title: e.target.value }, 'title')}
          />
        </Field>
        <Field label="Texto">
          <textarea
            data-ev-text
            className="input h-28"
            value={ev.description}
            onChange={(e) => patch(ev.uid, { description: e.target.value }, 'desc')}
          />
        </Field>
        <PictureCard project={project} ev={ev} />
        <div className="mb-1 text-[13px] text-gray-300">
          Tipo de evento <Help id="evento.noticia" />
        </div>
        <TemplateGallery
          templates={types}
          value={ev.type}
          onChange={(id) =>
            patch(ev.uid, {
              type: id as GameEvent['type'],
              flags: {
                ...ev.flags,
                major: id === 'news_event' ? true : ev.flags.major && ev.type !== 'news_event'
              }
            })
          }
          compact
        />
      </Card>

      <OptionsCard project={project} ev={ev} notes={notes.options} />

      <Card title="Cuándo ocurre" notes={notes.when} help={<Help id="evento.activacion" />}>
        <TemplateGallery
          compact
          value={auto ? 'auto' : 'lanzado'}
          onChange={(id) => fl({ triggeredOnly: id === 'lanzado' })}
          templates={[
            {
              id: 'lanzado',
              label: 'Solo cuando otro lo lance',
              description: 'Un foco, una decisión u otro evento lo activan.'
            },
            {
              id: 'auto',
              label: 'Cuando se cumplan condiciones',
              description: 'Ocurre solo cuando se den las condiciones que pongas.'
            }
          ]}
        />
        {auto && (
          <div className="mt-3">
            {script('trigger', 'condition', 'Condiciones para que ocurra')}
            <Field label="Tiempo promedio para que ocurra (días)" helpId="evento.tiempoPromedio">
              <NumberField
                value={ev.mtthDays}
                min={0}
                onChange={(v) => patch(ev.uid, { mtthDays: v })}
              />
            </Field>
          </div>
        )}
        <label className="mb-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={ev.flags.fireOnlyOnce}
            onChange={(e) => fl({ fireOnlyOnce: e.target.checked })}
          />
          Una sola vez en la partida <Help id="evento.unaVez" />
        </label>
        <Field label="A quién le pasa" help="Si no eliges ninguno, le pasa al país que lo reciba.">
          <CountryChips value={ev.countries} onChange={(v) => patch(ev.uid, { countries: v })} />
        </Field>
      </Card>

      <Card title="Opciones avanzadas" collapsible defaultOpen={false} notes={notes.adv}>
        <label className="mb-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={ev.flags.hidden}
            onChange={(e) => fl({ hidden: e.target.checked })}
          />
          Oculto (sin ventana) <Help id="evento.oculto" />
        </label>
        <Field
          label="Tiempo para responder (días)"
          helpId="evento.tiempoResponder"
          help="Vacío o 0 = el valor normal del juego"
        >
          <NumberField
            value={ev.timeoutDays}
            min={0}
            onChange={(v) => patch(ev.uid, { timeoutDays: v })}
          />
        </Field>
        <label className="mb-2 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={ev.flags.major}
            onChange={(e) => fl({ major: e.target.checked })}
          />
          Mostrar a todos los jugadores
        </label>
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={ev.flags.minorFlavor}
            onChange={(e) => fl({ minorFlavor: e.target.checked })}
          />
          Evento de poca importancia
        </label>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Grupo de eventos" helpId="evento.grupo">
            <input className="input" value={eventGroupName(project, ev.namespace)} readOnly />
          </Field>
          <Field label="Identificador del grupo">
            <input
              className="input font-mono text-xs"
              value={ev.namespace}
              onChange={(e) => patch(ev.uid, { namespace: e.target.value }, 'ns')}
            />
          </Field>
          <Field label="Número" help="Entre 1 y 99999">
            <NumberField
              value={ev.number}
              min={1}
              max={99999}
              onChange={(v) => patch(ev.uid, { number: v })}
            />
          </Field>
        </div>
        {script('immediate', 'effect', 'Efectos al aparecer (antes de elegir)')}
        {script('after', 'effect', 'Efectos después de elegir')}
        {(['titleVariants', 'descVariants'] as const).map((k) => (
          <Card
            key={k}
            title={
              k === 'titleVariants'
                ? 'Otros títulos según condiciones'
                : 'Otros textos según condiciones'
            }
            actions={
              <Button
                small
                onClick={() =>
                  patch(ev.uid, { [k]: [...ev[k], { text: '', trigger: emptyScript() }] })
                }
              >
                Añadir variante
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
      </Card>
    </div>
  )
}

function GroupEditor({
  project,
  ns,
  onOpenChain
}: {
  project: Project
  ns: string
  onOpenChain: () => void
}): JSX.Element {
  const name = eventGroupName(project, ns)
  const count = project.events.filter((e) => e.namespace === ns).length
  return (
    <div className="mx-auto max-w-3xl p-5" data-group-editor>
      <Card title="Grupo de eventos" help={<Help id="evento.grupo" />}>
        <Field label="Nombre del grupo">
          <input
            className="input"
            value={name}
            onChange={(e) =>
              store.updateProject((p) => renameEventGroup(p, ns, e.target.value), {
                group: `evgroup:${ns}`
              })
            }
          />
        </Field>
        <p className="mb-3 text-xs text-hoi-muted">
          {count} evento{count === 1 ? '' : 's'} en este grupo. Todos se guardan juntos en un mismo
          archivo.
        </p>
        <div className="flex gap-2">
          <Button onClick={onOpenChain} disabled={!count}>
            Ver la cadena de eventos
          </Button>
          <Button
            disabled={count > 0}
            title={count > 0 ? 'Borra o mueve antes sus eventos' : undefined}
            onClick={() => store.updateProject((p) => deleteEventGroup(p, ns))}
          >
            Borrar grupo
          </Button>
        </div>
      </Card>
      <Card title="Opciones avanzadas" collapsible defaultOpen={false}>
        <Field label="Identificador del grupo" help="Se genera solo a partir del nombre.">
          <input className="input font-mono text-xs" value={ns} readOnly />
        </Field>
      </Card>
    </div>
  )
}

const isGroup = (uid: string | null): boolean => !!uid && uid.startsWith('group:')

registerSectionScreen('eventos', {
  intro:
    'Los eventos son ventanas que aparecen en la partida con un texto y opciones para el jugador. Se organizan en grupos, y unos pueden llevar a otros formando una cadena.',
  newSpec: {
    title: 'Nuevo evento',
    nameLabel: 'Título del evento',
    namePlaceholder: 'Por ejemplo: Estalla la guerra civil',
    defaultTemplate: 'pais',
    groupLabel: 'Grupo de eventos',
    groupHelp: 'evento.grupo',
    newGroupLabel: 'Crear un grupo nuevo…',
    groups: (p) => eventGroupList(p).map((g) => ({ id: g.namespace, name: g.name })),
    templates: EVENT_TEMPLATES.map((t) => ({
      id: t.id,
      label: t.label,
      description: t.description,
      thumb: TEMPLATE_ICONS[t.id]
    })),
    create: ({ name, groupId, newGroupName, template }) => {
      let uid = ''
      store.updateProject((p0) => {
        let p = p0
        let ns = groupId ?? ''
        if (!ns) {
          const r = createEventGroup(p, newGroupName || 'Eventos')
          p = r.project
          ns = r.group.namespace
        }
        const e = eventFromTemplate(p, template as EventTemplate, { namespace: ns, title: name })
        uid = e.uid
        return { ...p, events: [...p.events, e] }
      })
      return uid
    }
  },
  groups: (p): GroupNode[] =>
    eventGroupList(p).map((g) => ({
      id: g.namespace,
      title: g.name,
      selectUid: `group:${g.namespace}`,
      items: p.events
        .filter((e) => e.namespace === g.namespace)
        .map((e) => ({
          uid: e.uid,
          title: e.flags.hidden ? `${e.title || 'Evento'} (oculto)` : e.title,
          subtitle: eventId(e),
          thumb: <EventThumb project={p} ev={e} h={26} />
        }))
    })),
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
    if (isGroup(uid)) {
      store.updateProject((p) => deleteEventGroup(p, uid.slice(6)))
      return
    }
    const e = store.get().project?.events.find((x) => x.uid === uid)
    if (e && confirm(`¿Borrar el evento "${e.title || eventId(e)}"?`))
      store.updateProject((p) => deleteEvent(p, uid))
  },
  renderEditor: (p, sel) => {
    if (!sel) return null
    if (isGroup(sel))
      return (
        <GroupEditor
          project={p}
          ns={sel.slice(6)}
          onOpenChain={() => runCommand('section:eventos:preview')}
        />
      )
    return <Editor project={p} uid={sel} />
  },
  renderPreview: (p, sel) => {
    const ev = p.events.find((e) => e.uid === sel)
    return ev ? <EventPreview project={p} ev={ev} /> : null
  },
  code: (p, sel) => {
    const ev = p.events.find((e) => e.uid === sel)
    return ev ? (eventFiles({ ...p, events: [ev] })[0]?.text ?? null) : null
  },
  renderOverview: (p, sel, select) => <Chain project={p} selected={sel} select={select} />
})
