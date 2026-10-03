// Pestaña Ejército: plantillas de división (cuadrícula 5×5 + columna de apoyo con arrastrar y soltar),
// divisiones ubicadas con el mini mapa en modo provincia y producción inicial.
import { useState } from 'react'
import { MapPin } from 'lucide-react'
import type { Project } from '../types'
import { store, useApp } from '../store/appStore'
import { registerSectionScreen } from '../sections/ui'
import {
  COMBAT_GRID,
  SUPPORT_SLOTS,
  deleteOob,
  newDivision,
  newTemplate,
  oobFilePath,
  oobOf,
  oobText,
  unitLists,
  updateOob,
  validateOob
} from '../sections/oob'
import type { Oob, OobDivision, OobTemplate } from '../sections/types'
import { chooseCountryTag, nameOfTag } from './countryFlow'
import { chooseProvince } from './stateFlow'
import { Button, Field, Select, Tabs } from './kit'

const upd = (tag: string, f: (o: Oob) => Oob, group?: string): void =>
  store.updateProject(
    (p) => updateOob(p, tag, f),
    group ? { group: `oob:${tag}:${group}` } : undefined
  )

const short = (t: string): string => t.replace(/_/g, ' ').slice(0, 11)

type Brush = { kind: 'combat' | 'support'; type: string } | null

function TemplateGrid({
  tag,
  index,
  t,
  brush
}: {
  tag: string
  index: number
  t: OobTemplate
  brush: Brush
}): JSX.Element {
  const setT = (f: (t: OobTemplate) => OobTemplate): void =>
    upd(tag, (o) => ({ ...o, templates: o.templates.map((x, i) => (i === index ? f(x) : x)) }))
  const place = (kind: 'combat' | 'support', x: number, y: number, type: string): void =>
    setT((tt) =>
      kind === 'combat'
        ? {
            ...tt,
            regiments: [...tt.regiments.filter((r) => !(r.x === x && r.y === y)), { type, x, y }]
          }
        : { ...tt, support: [...tt.support.filter((s) => s.y !== y), { type, y }] }
    )
  const clear = (kind: 'combat' | 'support', x: number, y: number): void =>
    setT((tt) =>
      kind === 'combat'
        ? { ...tt, regiments: tt.regiments.filter((r) => !(r.x === x && r.y === y)) }
        : { ...tt, support: tt.support.filter((s) => s.y !== y) }
    )
  const drop = (e: React.DragEvent, kind: 'combat' | 'support', x: number, y: number): void => {
    e.preventDefault()
    const [k, type, fx, fy] = e.dataTransfer.getData('text/plain').split('|')
    if (!type || k !== kind) return
    if (fx !== undefined && fx !== '') clear(kind, Number(fx), Number(fy)) // mover
    place(kind, x, y, type)
  }
  const cell = (kind: 'combat' | 'support', x: number, y: number): JSX.Element => {
    const cur =
      kind === 'combat'
        ? t.regiments.find((r) => r.x === x && r.y === y)?.type
        : t.support.find((s) => s.y === y)?.type
    return (
      <div
        key={`${kind}${x}${y}`}
        data-cell={`${kind}:${x}:${y}`}
        draggable={!!cur}
        onDragStart={(e) => e.dataTransfer.setData('text/plain', `${kind}|${cur}|${x}|${y}`)}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => drop(e, kind, x, y)}
        onClick={() => {
          if (brush && brush.kind === kind) place(kind, x, y, brush.type)
          else if (cur) clear(kind, x, y)
        }}
        title={cur ? `${cur} (clic para quitar)` : 'Arrastra un batallón aquí'}
        className={`flex h-14 w-14 items-center justify-center rounded border text-center text-[10px] leading-tight ${
          cur ? 'border-hoi-accent bg-hoi-card' : 'border-dashed border-hoi-border'
        }`}
      >
        {cur ? short(cur) : ''}
      </div>
    )
  }
  return (
    <div className="flex gap-4">
      <div>
        <div className="mb-1 text-xs text-hoi-muted">
          Combate ({COMBAT_GRID.w}×{COMBAT_GRID.h})
        </div>
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${COMBAT_GRID.w}, 3.5rem)` }}
        >
          {Array.from({ length: COMBAT_GRID.h }, (_, y) =>
            Array.from({ length: COMBAT_GRID.w }, (_, x) => cell('combat', x, y))
          )}
        </div>
      </div>
      <div>
        <div className="mb-1 text-xs text-hoi-muted">Apoyo</div>
        <div className="flex flex-col gap-1">
          {Array.from({ length: SUPPORT_SLOTS }, (_, y) => cell('support', 0, y))}
        </div>
      </div>
    </div>
  )
}

function Templates({ oob }: { oob: Oob }): JSX.Element {
  const game = useApp(() => store.catalogGame())
  const units = unitLists(game)
  const [sel, setSel] = useState(0)
  const [brush, setBrush] = useState<Brush>(null)
  const index = Math.min(sel, oob.templates.length - 1)
  const t = oob.templates[index]
  const chip = (kind: 'combat' | 'support', type: string): JSX.Element => {
    const on = brush?.kind === kind && brush.type === type
    return (
      <span
        key={`${kind}${type}`}
        draggable
        onDragStart={(e) => e.dataTransfer.setData('text/plain', `${kind}|${type}||`)}
        onClick={() => setBrush(on ? null : { kind, type })}
        className={`cursor-grab rounded border px-2 py-0.5 text-xs ${on ? 'border-hoi-accent bg-hoi-accent/20' : 'border-hoi-border bg-hoi-card'}`}
      >
        {type}
      </span>
    )
  }
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1">
        {oob.templates.map((x, i) => (
          <button
            key={x.name + i}
            className={`btn px-2 py-0.5 text-xs ${i === index ? 'border-hoi-accent' : ''}`}
            onClick={() => setSel(i)}
          >
            {x.name || '(sin nombre)'}
          </button>
        ))}
        <Button
          small
          onClick={() => {
            upd(oob.country, (o) => ({ ...o, templates: [...o.templates, newTemplate(o)] }))
            setSel(oob.templates.length)
          }}
        >
          + Plantilla
        </Button>
      </div>
      {t ? (
        <>
          <div className="flex items-end gap-2">
            <Field label="Nombre de la plantilla">
              <input
                className="input w-64"
                value={t.name}
                onChange={(e) => {
                  const name = e.target.value
                  // Las divisiones que usaban el nombre viejo siguen a la plantilla
                  upd(
                    oob.country,
                    (o) => ({
                      ...o,
                      templates: o.templates.map((x, i) => (i === index ? { ...x, name } : x)),
                      divisions: o.divisions.map((d) =>
                        d.template === t.name ? { ...d, template: name } : d
                      )
                    }),
                    `tname${index}`
                  )
                }}
              />
            </Field>
            <Button
              small
              onClick={() => {
                upd(oob.country, (o) => ({
                  ...o,
                  templates: o.templates.filter((_, i) => i !== index)
                }))
                setSel(0)
              }}
            >
              Borrar plantilla
            </Button>
          </div>
          <div className="text-xs text-hoi-muted">
            Arrastra batallones desde la paleta (o elige uno y haz clic en una casilla). Clic en una
            casilla llena la vacía.
          </div>
          <TemplateGrid tag={oob.country} index={index} t={t} brush={brush} />
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-hoi-muted">
              Batallones{' '}
              {game?.subUnits ? '(del juego)' : '(lista de reserva: sin carpeta del juego)'}
            </div>
            <div className="flex flex-wrap gap-1">{units.combat.map((u) => chip('combat', u))}</div>
            <div className="mb-1 mt-2 text-xs font-semibold uppercase text-hoi-muted">Apoyo</div>
            <div className="flex flex-wrap gap-1">
              {units.support.map((u) => chip('support', u))}
            </div>
          </div>
          <div className="text-xs text-hoi-muted">
            {t.regiments.length} batallón(es) de combate · {t.support.length} de apoyo
          </div>
        </>
      ) : (
        <p className="text-sm text-hoi-muted">Aún no hay plantillas. Crea la primera.</p>
      )}
    </div>
  )
}

function Divisions({ oob }: { oob: Oob }): JSX.Element {
  const setD = (uid: string, p: Partial<OobDivision>, g?: string): void =>
    upd(
      oob.country,
      (o) => ({ ...o, divisions: o.divisions.map((d) => (d.uid === uid ? { ...d, ...p } : d)) }),
      g ? `${g}:${uid}` : undefined
    )
  const add = (): void =>
    void chooseProvince({ onlyOwner: oob.country }).then(
      (prov) =>
        prov &&
        upd(oob.country, (o) => ({ ...o, divisions: [...o.divisions, newDivision(o, prov)] }))
    )
  return (
    <div className="space-y-2">
      {oob.divisions.map((d) => (
        <div
          key={d.uid}
          className="flex flex-wrap items-end gap-2 rounded border border-hoi-border p-2"
        >
          <Field label="Plantilla">
            <Select
              value={d.template}
              options={[
                ...(oob.templates.some((t) => t.name === d.template)
                  ? []
                  : [{ value: d.template, label: `${d.template || '—'} (no existe)` }]),
                ...oob.templates.map((t) => ({ value: t.name, label: t.name }))
              ]}
              onChange={(v) => setD(d.uid, { template: v })}
            />
          </Field>
          <Field label="Provincia">
            <Button
              small
              onClick={() =>
                void chooseProvince({ current: d.province, onlyOwner: oob.country }).then(
                  (prov) => prov && setD(d.uid, { province: prov })
                )
              }
            >
              <MapPin size={12} /> {d.province}
            </Button>
          </Field>
          <Field label="Nombre (opcional)">
            <input
              className="input w-44"
              value={d.name}
              onChange={(e) => setD(d.uid, { name: e.target.value }, 'name')}
            />
          </Field>
          <Field label="N.º de orden" help="Solo si no pones nombre">
            <input
              type="number"
              className="input w-20"
              min={1}
              value={d.ordinal ?? ''}
              onChange={(e) =>
                setD(
                  d.uid,
                  { ordinal: e.target.value === '' ? null : Number(e.target.value) },
                  'ord'
                )
              }
            />
          </Field>
          <Field label="Experiencia (0–1)">
            <input
              type="number"
              className="input w-20"
              min={0}
              max={1}
              step={0.1}
              value={d.experience}
              onChange={(e) => setD(d.uid, { experience: Number(e.target.value) }, 'exp')}
            />
          </Field>
          <Field label="Equipo (0–1)">
            <input
              type="number"
              className="input w-20"
              min={0}
              max={1}
              step={0.1}
              value={d.equipment}
              onChange={(e) => setD(d.uid, { equipment: Number(e.target.value) }, 'eq')}
            />
          </Field>
          <Button
            small
            onClick={() =>
              upd(oob.country, (o) => ({
                ...o,
                divisions: o.divisions.filter((x) => x.uid !== d.uid)
              }))
            }
          >
            Borrar
          </Button>
        </div>
      ))}
      <Button onClick={add} disabled={!oob.templates.length}>
        + División (elegir provincia en el mapa)
      </Button>
      {!oob.templates.length && (
        <span className="ml-2 text-xs text-hoi-muted">Crea antes una plantilla.</span>
      )}
    </div>
  )
}

function Production({ oob }: { oob: Oob }): JSX.Element {
  const game = useApp(() => store.catalogGame())
  const set = (i: number, p: Partial<Oob['production'][number]>): void =>
    upd(oob.country, (o) => ({
      ...o,
      production: o.production.map((x, n) => (n === i ? { ...x, ...p } : x))
    }))
  return (
    <div className="space-y-2">
      <p className="text-xs text-hoi-muted">
        Opcional. Fábricas que ya producen este equipo al empezar la partida.
      </p>
      {oob.production.map((x, i) => (
        <div key={i} className="flex items-center gap-2">
          {game?.equipments ? (
            <Select
              value={x.equipment}
              options={[
                { value: '', label: 'Equipo…' },
                ...game.equipments.map((e) => ({ value: e, label: e }))
              ]}
              onChange={(v) => set(i, { equipment: v })}
            />
          ) : (
            <input
              className="input w-60 font-mono"
              placeholder="Equipo"
              value={x.equipment}
              onChange={(e) => set(i, { equipment: e.target.value.trim() })}
            />
          )}
          <input
            type="number"
            className="input w-20"
            min={1}
            value={x.factories}
            onChange={(e) => set(i, { factories: Number(e.target.value) })}
          />
          <span className="text-xs text-hoi-muted">fábricas</span>
          <Button
            small
            onClick={() =>
              upd(oob.country, (o) => ({
                ...o,
                production: o.production.filter((_, n) => n !== i)
              }))
            }
          >
            ✕
          </Button>
        </div>
      ))}
      <Button
        small
        onClick={() =>
          upd(oob.country, (o) => ({
            ...o,
            production: [...o.production, { equipment: '', factories: 1 }]
          }))
        }
      >
        + Producción
      </Button>
    </div>
  )
}

function Editor({ oob }: { oob: Oob }): JSX.Element {
  const [tab, setTab] = useState('plantillas')
  return (
    <div className="p-3">
      <h2 className="mb-2 text-sm font-semibold">
        Ejército de {nameOfTag(oob.country)} <span className="font-mono">({oob.country})</span>
      </h2>
      <Tabs
        tabs={[
          { id: 'plantillas', label: 'Plantillas' },
          { id: 'divisiones', label: `Divisiones (${oob.divisions.length})` },
          { id: 'produccion', label: 'Producción' }
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="mt-3">
        {tab === 'plantillas' && <Templates oob={oob} />}
        {tab === 'divisiones' && <Divisions oob={oob} />}
        {tab === 'produccion' && <Production oob={oob} />}
      </div>
    </div>
  )
}

function Side({ project, tag }: { project: Project; tag: string | null }): JSX.Element {
  const map = useApp((s) => s.map)
  const oob = tag ? oobOf(project, tag) : undefined
  if (!oob || !tag)
    return <p className="text-xs text-hoi-muted">Elige un país para ver su ejército.</p>
  const issues = validateOob(project, map, store.catalogGame()).filter((i) => i.country === tag)
  return (
    <div className="text-xs">
      {issues.map((i, n) => (
        <p
          key={n}
          className={`mb-1 ${i.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}`}
        >
          {i.message}
        </p>
      ))}
      <div className="mb-1 font-mono text-hoi-muted">{oobFilePath(project, tag)}</div>
      <pre className="whitespace-pre-wrap rounded bg-hoi-card p-2 font-mono text-[11px]">
        {oobText(tag, oob)}
      </pre>
    </div>
  )
}

registerSectionScreen('ejercito', {
  create: async () => {
    const tag = await chooseCountryTag('Ejército de…')
    if (!tag) return null
    store.updateProject((p) => (oobOf(p, tag) ? p : updateOob(p, tag, (o) => o)))
    return tag
  },
  remove: (tag) => {
    if (confirm(`¿Borrar el ejército de ${tag}? (El juego volverá a usar su OOB original.)`))
      store.updateProject((p) => deleteOob(p, tag))
  },
  items: (p) =>
    (p.oobs ?? []).map((o) => ({
      uid: o.country,
      id: o.country,
      name: `${o.country} · ${nameOfTag(o.country)}`
    })),
  renderEditor: (p, sel) => {
    const o = sel ? oobOf(p, sel) : undefined
    return o ? <Editor oob={o} /> : null
  },
  renderPreview: (p, sel) => <Side project={p} tag={sel} />
})
