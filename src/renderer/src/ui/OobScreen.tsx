// Pestaña Ejército: lista país → plantillas → divisiones. Las plantillas de división tienen una
// cuadrícula 5×5 y una columna de apoyo con arrastrar y soltar (ícono y nombre del juego en cada
// casilla); las divisiones se ubican con el mini mapa en modo provincia; la producción inicial es opcional.
import { useState } from 'react'
import {
  Crosshair,
  Footprints,
  LayoutGrid,
  MapPin,
  Shield,
  Truck,
  Users,
  Wrench
} from 'lucide-react'
import type { Project } from '../types'
import { store, useApp } from '../store/appStore'
import { registerSectionScreen, type GroupNode, type TemplateCard } from '../sections/ui'
import {
  COMBAT_GRID,
  DIVISION_PRESETS,
  SUPPORT_SLOTS,
  deleteOob,
  landUnits,
  newDivision,
  newTemplate,
  oobFilePath,
  oobOf,
  oobText,
  templateFromPreset,
  unitGroups,
  updateOob,
  validateOob,
  type OobIssue,
  type UnitInfo
} from '../sections/oob'
import { unitName, type UnitCategory } from '../../../shared/gameUnits'
import { newUid } from '../types'
import type { Oob, OobDivision, OobTemplate } from '../sections/types'
import { useSpriteThumb } from '../catalog/gameSprites'
import { chooseCountryTag, nameOfTag } from './countryFlow'
import { chooseProvince } from './stateFlow'
import { Button, Card, Field, Select, type CardNote } from './kit'
import Help from './Help'

const upd = (tag: string, f: (o: Oob) => Oob, group?: string): void =>
  store.updateProject(
    (p) => updateOob(p, tag, f),
    group ? { group: `oob:${tag}:${group}` } : undefined
  )

// ---------------------------------------------------------------- selección

type Sel =
  | { kind: 'country'; tag: string }
  | { kind: 'template'; tag: string; index: number }
  | { kind: 'division'; tag: string; uid: string }

const templateUid = (tag: string, index: number): string => `${tag}:t:${index}`
const divisionUid = (tag: string, uid: string): string => `${tag}:d:${uid}`
function parseSel(uid: string | null): Sel | null {
  if (!uid) return null
  const [tag, k, ...rest] = uid.split(':')
  if (k === 't') return { kind: 'template', tag, index: Number(rest[0]) }
  if (k === 'd') return { kind: 'division', tag, uid: rest.join(':') }
  return { kind: 'country', tag }
}

// ---------------------------------------------------------------- avisos

/** Texto corto de un aviso del validador, sin el prefijo del país ni de la plantilla */
function noteOf(i: OobIssue): CardNote {
  const t = i.message
    .replace(/^Ejército de [^:]+: /, '')
    .replace(/^la plantilla "[^"]*" /, '')
    .replace(/^la división en la provincia \d+: /, '')
  return {
    severity: i.severity === 'error' ? 'error' : 'aviso',
    text: t.charAt(0).toUpperCase() + t.slice(1)
  }
}

// ---------------------------------------------------------------- batallones

const CATEGORY_ICON: Record<UnitCategory, typeof Shield> = {
  infantry: Footprints,
  mobile: Truck,
  armor: Shield,
  artillery: Crosshair,
  support: Wrench
}

/** Ícono del batallón: el del juego (miniatura en caché) o uno genérico por tipo */
function UnitIcon({ unit, h }: { unit: UnitInfo | null; h: number }): JSX.Element {
  const src = useSpriteThumb(unit?.gfx ?? null)
  if (src)
    return (
      <img
        src={src}
        alt=""
        draggable={false}
        style={{ height: h, maxWidth: h * 1.6 }}
        className="object-contain"
      />
    )
  const Icon = CATEGORY_ICON[unit?.category ?? 'infantry']
  return <Icon size={Math.round(h * 0.75)} className="text-hoi-muted" />
}

/** Datos para mostrar un tipo de batallón (aunque el juego no lo tenga) */
function useUnitLookup(): (type: string) => UnitInfo {
  const game = useApp(() => store.catalogGame())
  const all = new Map(landUnits(game).map((u) => [u.id, u]))
  return (type) =>
    all.get(type) ?? {
      id: type,
      name: unitName(type, game?.unitNames),
      category: 'infantry',
      gfx: null
    }
}

type Brush = { kind: 'combat' | 'support'; type: string } | null

// ---------------------------------------------------------------- cuadrícula de la plantilla

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
  const infoOf = useUnitLookup()
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
    const info = cur ? infoOf(cur) : null
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
        title={info ? `${info.name} (clic para quitar)` : 'Arrastra un batallón aquí'}
        className={`flex h-[4.25rem] w-[4.25rem] flex-col items-center justify-center gap-0.5 overflow-hidden rounded border px-0.5 text-center text-[10px] leading-tight ${
          cur ? 'border-hoi-accent bg-hoi-card' : 'border-dashed border-hoi-border'
        }`}
      >
        {info && (
          <>
            <UnitIcon unit={info} h={26} />
            <span data-cell-name className="line-clamp-2 w-full break-words">
              {info.name}
            </span>
          </>
        )}
      </div>
    )
  }
  return (
    <div className="flex flex-wrap items-start gap-6">
      <div>
        <div className="mb-1 text-xs text-hoi-muted">
          Batallones de línea ({COMBAT_GRID.w}×{COMBAT_GRID.h})
        </div>
        <div
          className="grid gap-1"
          style={{ gridTemplateColumns: `repeat(${COMBAT_GRID.w}, 4.25rem)` }}
        >
          {Array.from({ length: COMBAT_GRID.h }, (_, y) =>
            Array.from({ length: COMBAT_GRID.w }, (_, x) => cell('combat', x, y))
          )}
        </div>
      </div>
      <div data-support-column>
        <div className="mb-1 text-xs text-hoi-muted">
          Apoyo
          <Help id="ejercito.apoyo" />
        </div>
        <div className="flex flex-col gap-1">
          {Array.from({ length: SUPPORT_SLOTS }, (_, y) => cell('support', 0, y))}
        </div>
      </div>
    </div>
  )
}

/** Dibujo pequeño de una plantilla (vista previa y lista de divisiones) */
function DivisionDesign({ t }: { t: OobTemplate }): JSX.Element {
  const infoOf = useUnitLookup()
  const sz = 34
  return (
    <div
      data-division-design
      className="rounded-sm border-2 border-[#8c7b4f] bg-[#232b36] p-3"
      style={{ width: 'fit-content', maxWidth: '100%' }}
    >
      <div className="mb-2 truncate text-sm font-semibold text-hoi-text">
        {t.name || 'Plantilla sin nombre'}
      </div>
      <div className="flex gap-3">
        <div
          className="grid gap-0.5"
          style={{ gridTemplateColumns: `repeat(${COMBAT_GRID.w}, ${sz}px)` }}
        >
          {Array.from({ length: COMBAT_GRID.h }, (_, y) =>
            Array.from({ length: COMBAT_GRID.w }, (_, x) => {
              const r = t.regiments.find((q) => q.x === x && q.y === y)
              const info = r ? infoOf(r.type) : null
              return (
                <div
                  key={`${x}${y}`}
                  title={info?.name}
                  className={`flex items-center justify-center rounded-sm border ${r ? 'border-[#8c7b4f] bg-[#2f3947]' : 'border-[#3f4858] bg-[#1c222b]'}`}
                  style={{ height: sz, width: sz }}
                >
                  {info && <UnitIcon unit={info} h={22} />}
                </div>
              )
            })
          )}
        </div>
        <div className="flex flex-col gap-0.5 border-l border-[#5a6578] pl-2">
          {Array.from({ length: SUPPORT_SLOTS }, (_, y) => {
            const s = t.support.find((q) => q.y === y)
            const info = s ? infoOf(s.type) : null
            return (
              <div
                key={y}
                title={info?.name}
                className={`flex items-center justify-center rounded-sm border ${s ? 'border-[#8c7b4f] bg-[#2f3947]' : 'border-[#3f4858] bg-[#1c222b]'}`}
                style={{ height: sz, width: sz }}
              >
                {info && <UnitIcon unit={info} h={22} />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- editores

function TemplateEditor({
  project,
  oob,
  index
}: {
  project: Project
  oob: Oob
  index: number
}): JSX.Element | null {
  const game = useApp(() => store.catalogGame())
  const map = useApp((s) => s.map)
  const [brush, setBrush] = useState<Brush>(null)
  const t = oob.templates[index]
  if (!t) return null
  const issues = validateOob(project, map, game).filter(
    (i) => i.country === oob.country && i.template === t.name && !i.division
  )
  const chip = (u: UnitInfo): JSX.Element => {
    const kind = u.category === 'support' ? 'support' : 'combat'
    const on = brush?.kind === kind && brush.type === u.id
    return (
      <span
        key={u.id}
        data-unit={u.id}
        draggable
        onDragStart={(e) => e.dataTransfer.setData('text/plain', `${kind}|${u.id}||`)}
        onClick={() => setBrush(on ? null : { kind, type: u.id })}
        className={`flex cursor-grab items-center gap-1.5 rounded border px-2 py-1 text-xs ${on ? 'border-hoi-accent bg-hoi-accent/20' : 'border-hoi-border bg-hoi-card'}`}
      >
        <UnitIcon unit={u} h={18} />
        {u.name}
      </span>
    )
  }
  const groups = unitGroups(game)
  return (
    <div className="mx-auto max-w-3xl p-5" data-template-editor>
      <Card
        title="Plantilla de división"
        help={<Help id="ejercito.plantilla" />}
        actions={
          <Button
            small
            onClick={() =>
              upd(oob.country, (o) => ({
                ...o,
                templates: o.templates.filter((_, i) => i !== index)
              }))
            }
          >
            Borrar plantilla
          </Button>
        }
      >
        <Field label="Nombre de la plantilla">
          <input
            className="input w-72"
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
        <p data-template-summary className="text-xs text-hoi-muted">
          {t.regiments.length} batallones de línea y {t.support.length} de apoyo
        </p>
      </Card>

      <Card title="Batallones" help={<Help id="ejercito.linea" />} notes={issues.map(noteOf)}>
        <p className="mb-3 text-xs text-hoi-muted">
          Arrastra un batallón de la lista a una casilla, o elige uno y haz clic en las casillas. Un
          clic en una casilla llena la vacía.
        </p>
        <TemplateGrid tag={oob.country} index={index} t={t} brush={brush} />
        <div className="mt-4 space-y-3 border-t border-hoi-border pt-3">
          {groups.map((g) => (
            <div key={g.category} data-unit-group={g.category}>
              <div className="mb-1 text-xs font-medium text-hoi-muted">{g.label}</div>
              <div className="flex flex-wrap gap-1">{g.units.map(chip)}</div>
            </div>
          ))}
        </div>
        {!game?.subUnits && (
          <p className="mt-3 text-xs text-hoi-muted">
            Sin la carpeta del juego se muestra la lista básica de batallones.
          </p>
        )}
      </Card>
    </div>
  )
}

function DivisionEditor({
  project,
  oob,
  uid
}: {
  project: Project
  oob: Oob
  uid: string
}): JSX.Element | null {
  const map = useApp((s) => s.map)
  const game = useApp(() => store.catalogGame())
  const d = oob.divisions.find((x) => x.uid === uid)
  if (!d) return null
  const issues = validateOob(project, map, game).filter(
    (i) => i.country === oob.country && i.division === uid
  )
  const setD = (p: Partial<OobDivision>, g?: string): void =>
    upd(
      oob.country,
      (o) => ({ ...o, divisions: o.divisions.map((x) => (x.uid === uid ? { ...x, ...p } : x)) }),
      g ? `${g}:${uid}` : undefined
    )
  return (
    <div className="mx-auto max-w-3xl p-5" data-division-editor>
      <Card title="Básico" notes={issues.map(noteOf)}>
        <Field label="Plantilla">
          <Select
            value={d.template}
            options={[
              ...(oob.templates.some((t) => t.name === d.template)
                ? []
                : [{ value: d.template, label: `${d.template || 'Ninguna'} (ya no existe)` }]),
              ...oob.templates.map((t) => ({ value: t.name, label: t.name }))
            ]}
            onChange={(v) => setD({ template: v })}
          />
        </Field>
        <Field label="Dónde empieza">
          <Button
            small
            onClick={() =>
              void chooseProvince({ current: d.province, onlyOwner: oob.country }).then(
                (prov) => prov && setD({ province: prov })
              )
            }
          >
            <MapPin size={12} /> Provincia {d.province}
          </Button>
        </Field>
        <Field label="Nombre (opcional)" help="Si lo dejas vacío, el juego le pone uno.">
          <input
            className="input w-64"
            value={d.name}
            onChange={(e) => setD({ name: e.target.value }, 'name')}
          />
        </Field>
      </Card>
      <Card title="Fuerza al empezar">
        <div className="flex flex-wrap gap-6">
          <Field label="Experiencia (0 a 1)">
            <input
              type="number"
              className="input w-24"
              min={0}
              max={1}
              step={0.1}
              value={d.experience}
              onChange={(e) => setD({ experience: Number(e.target.value) }, 'exp')}
            />
          </Field>
          <Field label="Equipo (0 a 1)">
            <input
              type="number"
              className="input w-24"
              min={0}
              max={1}
              step={0.1}
              value={d.equipment}
              onChange={(e) => setD({ equipment: Number(e.target.value) }, 'eq')}
            />
          </Field>
        </div>
      </Card>
      <Card title="Opciones avanzadas" collapsible defaultOpen={false}>
        <Field label="Número de orden" help="Solo se usa si no pones nombre.">
          <input
            type="number"
            className="input w-24"
            min={1}
            value={d.ordinal ?? ''}
            onChange={(e) =>
              setD({ ordinal: e.target.value === '' ? null : Number(e.target.value) }, 'ord')
            }
          />
        </Field>
      </Card>
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
                { value: '', label: 'Elige un equipo…' },
                ...game.equipments.map((e) => ({ value: e, label: e }))
              ]}
              onChange={(v) => set(i, { equipment: v })}
            />
          ) : (
            <input
              className="input w-60"
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
            Quitar
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
        Añadir producción
      </Button>
    </div>
  )
}

function CountryEditor({
  project,
  oob,
  select
}: {
  project: Project
  oob: Oob
  select: (uid: string) => void
}): JSX.Element {
  const map = useApp((s) => s.map)
  const game = useApp(() => store.catalogGame())
  const issues = validateOob(project, map, game).filter(
    (i) => i.country === oob.country && !i.template && !i.division
  )
  const addDivision = (): void =>
    void chooseProvince({ onlyOwner: oob.country }).then((prov) => {
      if (!prov) return
      const d = newDivision(oob, prov)
      upd(oob.country, (o) => ({ ...o, divisions: [...o.divisions, d] }))
      select(divisionUid(oob.country, d.uid))
    })
  return (
    <div className="mx-auto max-w-3xl p-5" data-country-editor>
      <Card title={`Ejército de ${nameOfTag(oob.country)}`} notes={issues.map(noteOf)}>
        <p className="mb-3 text-sm text-hoi-muted">
          {oob.templates.length} plantillas y {oob.divisions.length} divisiones al empezar la
          partida.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            small
            onClick={() => {
              const t = newTemplate(oob)
              upd(oob.country, (o) => ({ ...o, templates: [...o.templates, t] }))
              select(templateUid(oob.country, oob.templates.length))
            }}
          >
            Nueva plantilla
          </Button>
          <Button
            small
            disabled={!oob.templates.length}
            title={oob.templates.length ? undefined : 'Crea antes una plantilla'}
            onClick={addDivision}
          >
            Nueva división (elegir provincia en el mapa)
          </Button>
        </div>
        {!oob.templates.length && (
          <p className="mt-2 text-xs text-hoi-muted">Crea primero una plantilla de división.</p>
        )}
      </Card>
      <Card title="Producción inicial" collapsible defaultOpen={oob.production.length > 0}>
        <Production oob={oob} />
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------- vista previa

function Preview({ project, uid }: { project: Project; uid: string | null }): JSX.Element {
  const sel = parseSel(uid)
  const oob = sel ? oobOf(project, sel.tag) : undefined
  if (!sel || !oob)
    return <p className="text-xs text-hoi-muted">Elige una plantilla o una división.</p>
  if (sel.kind === 'template') {
    const t = oob.templates[sel.index]
    return t ? <DivisionDesign t={t} /> : <></>
  }
  if (sel.kind === 'division') {
    const d = oob.divisions.find((x) => x.uid === sel.uid)
    const t = d && oob.templates.find((x) => x.name === d.template)
    if (!d) return <></>
    return (
      <div className="space-y-2">
        {t ? (
          <DivisionDesign t={t} />
        ) : (
          <p className="text-xs text-hoi-muted">Esta división no tiene una plantilla válida.</p>
        )}
        <p className="text-xs text-hoi-muted">
          Provincia {d.province} · experiencia {Math.round(d.experience * 100)}% · equipo{' '}
          {Math.round(d.equipment * 100)}%
        </p>
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {oob.templates.map((t, i) => (
        <DivisionDesign key={i} t={t} />
      ))}
      {!oob.templates.length && (
        <p className="text-xs text-hoi-muted">Este país aún no tiene plantillas.</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- registro

const PRESET_ICON: Record<string, JSX.Element> = {
  blank: <LayoutGrid size={20} />,
  infantry: <Footprints size={20} />,
  motorized: <Truck size={20} />,
  armor: <Shield size={20} />
}
const presetCards: TemplateCard[] = DIVISION_PRESETS.map((x) => ({
  id: x.id,
  label: x.label,
  description: x.description,
  thumb: PRESET_ICON[x.id] ?? <Users size={20} />
}))

registerSectionScreen('ejercito', {
  intro:
    'Diseña las plantillas de división de un país y colócalas en el mapa al empezar la partida.',
  newSpec: {
    title: 'Nueva plantilla de división',
    nameLabel: 'Nombre de la plantilla',
    namePlaceholder: 'Por ejemplo: Infantería 1936',
    groupLabel: 'País',
    groups: (p) =>
      (p.oobs ?? []).map((o) => ({
        id: o.country,
        name: `${nameOfTag(o.country)} (${o.country})`
      })),
    pickGroup: {
      label: 'Elegir otro país…',
      pick: async () => {
        const tag = await chooseCountryTag('Ejército de…')
        return tag ? { id: tag, name: `${nameOfTag(tag)} (${tag})` } : null
      }
    },
    defaultTemplate: 'infantry',
    templates: presetCards,
    create: ({ name, groupId, template }) => {
      if (!groupId) return null
      let index = 0
      store.updateProject((p) =>
        updateOob(p, groupId, (o) => {
          index = o.templates.length
          return {
            ...o,
            templates: [...o.templates, templateFromPreset(o, template, name, store.catalogGame())]
          }
        })
      )
      return templateUid(groupId, index)
    }
  },
  groups: (p): GroupNode[] =>
    (p.oobs ?? []).map((o) => ({
      id: o.country,
      title: nameOfTag(o.country),
      selectUid: o.country,
      items: [
        ...o.templates.map((t, i) => ({
          uid: templateUid(o.country, i),
          heading: i === 0 ? 'Plantillas' : undefined,
          title: t.name,
          subtitle: `${t.regiments.length} batallones · ${t.support.length} de apoyo`
        })),
        ...o.divisions.map((d, i) => ({
          uid: divisionUid(o.country, d.uid),
          heading: i === 0 ? 'Divisiones' : undefined,
          title: d.name.trim() || `División ${i + 1}`,
          subtitle: `${d.template} · provincia ${d.province}`
        }))
      ]
    })),
  duplicate: (uid) => {
    const s = parseSel(uid)
    if (!s) return null
    if (s.kind === 'template') {
      const o = oobOf(store.get().project!, s.tag)
      const src = o?.templates[s.index]
      if (!o || !src) return null
      const copy = {
        ...newTemplate(o, `${src.name} (copia)`),
        regiments: src.regiments.map((r) => ({ ...r })),
        support: src.support.map((x) => ({ ...x }))
      }
      upd(s.tag, (x) => ({ ...x, templates: [...x.templates, copy] }))
      return templateUid(s.tag, o.templates.length)
    }
    if (s.kind === 'division') {
      const o = oobOf(store.get().project!, s.tag)
      const src = o?.divisions.find((d) => d.uid === s.uid)
      if (!o || !src) return null
      const copy = { ...src, uid: newUid() }
      upd(s.tag, (x) => ({ ...x, divisions: [...x.divisions, copy] }))
      return divisionUid(s.tag, copy.uid)
    }
    return null
  },
  remove: (uid) => {
    const s = parseSel(uid)
    if (!s) return
    if (s.kind === 'template')
      upd(s.tag, (o) => ({ ...o, templates: o.templates.filter((_, i) => i !== s.index) }))
    else if (s.kind === 'division')
      upd(s.tag, (o) => ({ ...o, divisions: o.divisions.filter((d) => d.uid !== s.uid) }))
    else if (
      confirm(`¿Borrar el ejército de ${nameOfTag(s.tag)}? El juego volverá a usar el suyo.`)
    )
      store.updateProject((p) => deleteOob(p, s.tag))
  },
  renderEditor: (p, sel, select) => {
    const s = parseSel(sel)
    const o = s ? oobOf(p, s.tag) : undefined
    if (!s || !o) return null
    if (s.kind === 'template') return <TemplateEditor project={p} oob={o} index={s.index} />
    if (s.kind === 'division') return <DivisionEditor project={p} oob={o} uid={s.uid} />
    return <CountryEditor project={p} oob={o} select={select} />
  },
  renderPreview: (p, sel) => <Preview project={p} uid={sel} />,
  code: (p, sel) => {
    const s = parseSel(sel)
    const o = s ? oobOf(p, s.tag) : undefined
    return s && o ? `# ${oobFilePath(p, s.tag)}\n${oobText(s.tag, o)}` : null
  }
})
