// Pestaña Decisiones: categorías y decisiones (normales, misiones y con objetivo).
import { useState } from 'react'
import type { Project } from '../types'
import { newUid } from '../types'
import { store, useApp } from '../store/appStore'
import { registerSectionScreen } from '../sections/ui'
import {
  createCategory,
  createDecision,
  DECISION_KINDS,
  DECISION_TEMPLATES,
  decisionFiles,
  decisionFromTemplate,
  decisionsOf,
  deleteCategory,
  deleteDecision,
  duplicateDecision,
  updateCategory,
  updateDecision,
  validateDecisions
} from '../sections/decisions'
import {
  emptyScript,
  type BlockScript,
  type Decision,
  type DecisionCategory
} from '../sections/types'
import { MODIFIERS } from '../catalog/modifiers'
import { addAsset } from './projectOps'
import { chooseCountryTag } from './countryFlow'
import { chooseState } from './stateFlow'
import BlocklyArea from './BlocklyArea'
import { Badge, Button, Card, Field, NumberField, Select, Tabs } from './kit'
import type { IconRef } from '../types'

const patchD = (uid: string, p: Partial<Decision>, group?: string): void =>
  store.updateProject(
    (pr) => updateDecision(pr, uid, p),
    group ? { group: `field:${uid}:${group}` } : undefined
  )
const patchC = (uid: string, p: Partial<DecisionCategory>, group?: string): void =>
  store.updateProject(
    (pr) => updateCategory(pr, uid, p),
    group ? { group: `field:${uid}:${group}` } : undefined
  )

/** Ícono: del juego (lista GFX_decision_*), de mi biblioteca o subido */
function IconChooser({
  project,
  label,
  value,
  gameList,
  onChange
}: {
  project: Project
  label: string
  value: IconRef | null
  gameList: string[]
  onChange: (v: IconRef | null) => void
}): JSX.Element {
  const [open, setOpen] = useState(false)
  const png =
    value?.kind === 'asset' ? project.icons.find((a) => a.id === value.assetId)?.png : null
  return (
    <Field
      label={label}
      help="Del juego, de tu biblioteca o subido (se exporta como .dds con tu prefijo)"
    >
      <div className="flex items-center gap-2">
        {png ? (
          <img src={png} alt="" className="h-10 rounded" />
        ) : (
          <span className="text-xs text-hoi-muted">
            {value?.kind === 'game' ? value.gfx : 'sin ícono'}
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
              r.onload = () => {
                const id = newUid()
                store.updateProject((p) =>
                  addAsset(p, {
                    id,
                    name: f.name,
                    target: 'idea',
                    png: String(r.result),
                    width: 66,
                    height: 66
                  })
                )
                onChange({ kind: 'asset', assetId: id })
              }
              r.readAsDataURL(f)
            }}
          />
        </label>
        {value && (
          <Button small onClick={() => onChange(null)}>
            Quitar
          </Button>
        )}
      </div>
      {open && (
        <div className="mt-2 max-h-40 overflow-y-auto rounded border border-hoi-border p-1 text-xs">
          <div className="font-semibold text-hoi-muted">
            Del juego {gameList.length ? `(${gameList.length})` : '(sin carpeta del juego)'}
          </div>
          {gameList.map((g) => (
            <div
              key={g}
              className="cursor-pointer px-1 hover:bg-hoi-card"
              onClick={() => (onChange({ kind: 'game', gfx: g }), setOpen(false))}
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
              onClick={() => (onChange({ kind: 'asset', assetId: a.id }), setOpen(false))}
            >
              <img src={a.png} alt="" className="h-5" /> {a.name}
            </div>
          ))}
        </div>
      )}
    </Field>
  )
}

function Chips<T extends string | number>({
  value,
  onChange,
  add,
  addLabel
}: {
  value: T[]
  onChange: (v: T[]) => void
  add: () => Promise<T | null>
  addLabel: string
}): JSX.Element {
  return (
    <div className="flex flex-wrap items-center gap-1">
      {value.map((t) => (
        <span key={String(t)} className="rounded bg-hoi-card px-2 py-0.5 font-mono text-xs">
          {String(t)}{' '}
          <button className="text-hoi-muted" onClick={() => onChange(value.filter((x) => x !== t))}>
            ✕
          </button>
        </span>
      ))}
      <Button
        small
        onClick={() =>
          void add().then((t) => t !== null && !value.includes(t) && onChange([...value, t]))
        }
      >
        {addLabel}
      </Button>
    </div>
  )
}

const countryAdd = (): Promise<string | null> => chooseCountryTag('Añadir país')

function CategoryEditor({ project, c }: { project: Project; c: DecisionCategory }): JSX.Element {
  const game = useApp(() => store.catalogGame())
  const count = decisionsOf(project, c.uid).length
  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">Categoría</h2>
        <Badge>{count} decisiones</Badge>
      </div>
      <Field label="Nombre">
        <input
          className="input"
          value={c.name}
          onChange={(e) => patchC(c.uid, { name: e.target.value }, 'name')}
        />
      </Field>
      <Field
        label="Descripción"
        help="Sin descripción, el juego no muestra la imagen de la categoría"
      >
        <textarea
          className="input h-16"
          value={c.description}
          onChange={(e) => patchC(c.uid, { description: e.target.value }, 'desc')}
        />
      </Field>
      <IconChooser
        project={project}
        label="Ícono (GFX_decision_category_)"
        value={c.icon}
        gameList={game?.decisionCategoryIcons ?? []}
        onChange={(v) => patchC(c.uid, { icon: v })}
      />
      <IconChooser
        project={project}
        label="Imagen de la categoría"
        value={c.picture}
        gameList={game?.decisionCategoryIcons ?? []}
        onChange={(v) => patchC(c.uid, { picture: v })}
      />
      {c.picture && !c.description.trim() && (
        <p className="text-xs text-yellow-400">
          Aviso: la imagen no se verá porque la categoría no tiene descripción.
        </p>
      )}
      <Field label="Prioridad">
        <NumberField value={c.priority} onChange={(v) => patchC(c.uid, { priority: v })} />
      </Field>
      <label className="flex items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={c.visibleWhenEmpty}
          onChange={(e) => patchC(c.uid, { visibleWhenEmpty: e.target.checked })}
        />
        Visible aunque no tenga decisiones (visible_when_empty)
      </label>
      <Field label="Estados resaltados al abrirla (mini mapa)">
        <Chips
          value={c.highlightStates}
          onChange={(v) => patchC(c.uid, { highlightStates: v })}
          add={() => chooseState({})}
          addLabel="+ Estado"
        />
      </Field>
      <Field label="Centrar el mapa (on_map_area)" help="x, y y zoom; vacío = no mueve el mapa">
        <div className="flex items-center gap-1">
          {(['x', 'y', 'zoom'] as const).map((k) => (
            <input
              key={k}
              type="number"
              className="input w-20"
              placeholder={k}
              value={c.mapArea?.[k] ?? ''}
              onChange={(e) => {
                const v = e.target.value === '' ? null : Number(e.target.value)
                const cur = c.mapArea ?? { x: 0, y: 0, zoom: 100 }
                patchC(c.uid, { mapArea: v === null ? null : { ...cur, [k]: v } }, 'area')
              }}
            />
          ))}
        </div>
      </Field>
    </div>
  )
}

function Script({
  label,
  mode,
  value,
  onChange,
  help
}: {
  label: string
  mode: 'condition' | 'effect'
  value: BlockScript
  onChange: (v: BlockScript) => void
  help?: string
}): JSX.Element {
  return (
    <Field label={label} help={help}>
      <BlocklyArea mode={mode} value={value} onChange={onChange} height={200} />
    </Field>
  )
}

function DecisionEditor({ project, d }: { project: Project; d: Decision }): JSX.Element {
  const game = useApp(() => store.catalogGame())
  const [tab, setTab] = useState('general')
  const cats = project.decisionCategories ?? []
  const set = (p: Partial<Decision>, g?: string): void => patchD(d.uid, p, g)
  const tabs = [
    { id: 'general', label: 'General' },
    { id: 'cond', label: 'Condiciones' },
    { id: 'eff', label: 'Efectos' },
    { id: 'cost', label: 'Costo y tiempo' },
    { id: 'ai', label: 'IA' },
    ...(d.kind === 'target-country' || d.kind === 'target-state'
      ? [{ id: 'target', label: 'Objetivos' }]
      : [])
  ]
  return (
    <div className="p-3">
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <div className="mt-3 space-y-3">
        {tab === 'general' && (
          <>
            <Field label="Tipo">
              <Select
                value={d.kind}
                options={DECISION_KINDS.map((k) => ({ value: k.id, label: k.label }))}
                onChange={(v) => set({ kind: v as Decision['kind'] })}
              />
            </Field>
            <Field label="Nombre">
              <input
                className="input"
                value={d.name}
                onChange={(e) => set({ name: e.target.value }, 'name')}
              />
            </Field>
            <Field label="ID" help="Se usa en el script y como clave de localización">
              <input
                className="input font-mono"
                value={d.id}
                onChange={(e) => set({ id: e.target.value.replace(/[^A-Za-z0-9_]/g, '_') }, 'id')}
              />
            </Field>
            <Field label="Descripción">
              <textarea
                className="input h-16"
                value={d.description}
                onChange={(e) => set({ description: e.target.value }, 'desc')}
              />
            </Field>
            <IconChooser
              project={project}
              label="Ícono (GFX_decision_)"
              value={d.icon}
              gameList={game?.decisionIcons ?? []}
              onChange={(v) => set({ icon: v })}
            />
            <Field label="Categoría">
              <Select
                value={d.categoryUid ?? ''}
                options={[
                  { value: '', label: '(sin categoría)' },
                  ...cats.map((c) => ({ value: c.uid, label: c.name || c.id }))
                ]}
                onChange={(v) => set({ categoryUid: v || null })}
              />
            </Field>
            <Field label="Prioridad">
              <NumberField value={d.priority} onChange={(v) => set({ priority: v })} />
            </Field>
            <Field label="País (allowed)" help="Solo estos países la tienen; vacío = cualquiera">
              <Chips
                value={d.countries}
                onChange={(v) => set({ countries: v })}
                add={countryAdd}
                addLabel="+ País"
              />
            </Field>
          </>
        )}
        {tab === 'cond' && (
          <>
            <Script
              label="visible"
              mode="condition"
              value={d.visible}
              onChange={(v) => set({ visible: v })}
              help="Se revisa siempre. En misiones no funciona (usa activación)."
            />
            <Script
              label="available"
              mode="condition"
              value={d.available}
              onChange={(v) => set({ available: v })}
            />
            {d.kind === 'mission' && (
              <Script
                label="activation"
                mode="condition"
                value={d.activation}
                onChange={(v) => set({ activation: v })}
              />
            )}
          </>
        )}
        {tab === 'eff' && (
          <>
            <Script
              label="complete_effect"
              mode="effect"
              value={d.complete}
              onChange={(v) => set({ complete: v })}
            />
            <Script
              label="remove_effect (al terminar el temporizador)"
              mode="effect"
              value={d.remove}
              onChange={(v) => set({ remove: v })}
            />
            {d.kind === 'mission' && (
              <Script
                label="timeout_effect (misión sin cumplir)"
                mode="effect"
                value={d.timeout}
                onChange={(v) => set({ timeout: v })}
              />
            )}
            <Script
              label="cancel_trigger"
              mode="condition"
              value={d.cancelTrigger}
              onChange={(v) => set({ cancelTrigger: v })}
            />
            <Script
              label="cancel_effect"
              mode="effect"
              value={d.cancel}
              onChange={(v) => set({ cancel: v })}
            />
          </>
        )}
        {tab === 'cost' && (
          <>
            <Field label="Costo">
              <Select
                value={d.cost.mode}
                options={[
                  { value: 'none', label: 'Gratis' },
                  { value: 'pp', label: 'Poder político' },
                  { value: 'custom', label: 'Personalizado (custom_cost_trigger)' }
                ]}
                onChange={(v) => set({ cost: { ...d.cost, mode: v as Decision['cost']['mode'] } })}
              />
            </Field>
            {d.cost.mode === 'pp' && (
              <Field label="Poder político">
                <NumberField
                  value={d.cost.pp}
                  min={0}
                  onChange={(v) => set({ cost: { ...d.cost, pp: v } })}
                />
              </Field>
            )}
            {d.cost.mode === 'custom' && (
              <>
                <Script
                  label="custom_cost_trigger"
                  mode="condition"
                  value={d.cost.customTrigger}
                  onChange={(v) => set({ cost: { ...d.cost, customTrigger: v } })}
                  help="No cobra nada: resta el costo tú mismo en complete_effect."
                />
                <Field label="Texto del costo (custom_cost_text)">
                  <input
                    className="input"
                    value={d.cost.customText}
                    onChange={(e) =>
                      set({ cost: { ...d.cost, customText: e.target.value } }, 'ctext')
                    }
                  />
                </Field>
                <Field label="ai_hint_pp_cost">
                  <NumberField
                    value={d.cost.aiHintPp}
                    min={0}
                    onChange={(v) => set({ cost: { ...d.cost, aiHintPp: v } })}
                  />
                </Field>
              </>
            )}
            <Field label="Días para reactivar (days_re_enable)">
              <NumberField
                value={d.daysReEnable}
                min={0}
                onChange={(v) => set({ daysReEnable: v })}
              />
            </Field>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={d.fireOnlyOnce}
                onChange={(e) => set({ fireOnlyOnce: e.target.checked })}
              />
              Una sola vez (fire_only_once)
            </label>
            <Field label="Duración del temporizador (days_remove)" help="0 = sin temporizador">
              <NumberField value={d.daysRemove} min={0} onChange={(v) => set({ daysRemove: v })} />
            </Field>
            <Card title="Modificadores mientras corre el temporizador">
              {d.modifiers.map((m, i) => (
                <div key={i} className="mb-1 flex items-center gap-1">
                  <Select
                    value={m.key}
                    options={MODIFIERS.map((x) => ({ value: x.key, label: x.label }))}
                    onChange={(v) =>
                      set({
                        modifiers: d.modifiers.map((x, n) => (n === i ? { ...x, key: v } : x))
                      })
                    }
                  />
                  <NumberField
                    value={m.value}
                    onChange={(v) =>
                      set({
                        modifiers: d.modifiers.map((x, n) => (n === i ? { ...x, value: v } : x))
                      })
                    }
                  />
                  <Button
                    small
                    onClick={() => set({ modifiers: d.modifiers.filter((_, n) => n !== i) })}
                  >
                    ✕
                  </Button>
                </div>
              ))}
              <Button
                small
                onClick={() =>
                  set({ modifiers: [...d.modifiers, { key: MODIFIERS[0].key, value: 10 }] })
                }
              >
                + Modificador
              </Button>
            </Card>
            {d.kind === 'mission' && (
              <>
                <Field label="Tiempo límite de la misión (days_mission_timeout)">
                  <NumberField
                    value={d.missionTimeoutDays}
                    min={0}
                    onChange={(v) => set({ missionTimeoutDays: v })}
                  />
                </Field>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={d.selectableMission}
                    onChange={(e) => set({ selectableMission: e.target.checked })}
                  />
                  Misión seleccionable (selectable_mission)
                </label>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={d.isGood}
                    onChange={(e) => set({ isGood: e.target.checked })}
                  />
                  Es buena (is_good)
                </label>
              </>
            )}
            <Field label="Guerra al completar (war_with_on_complete)">
              <Chips
                value={d.warWithOnComplete ? [d.warWithOnComplete] : []}
                onChange={(v) => set({ warWithOnComplete: v[v.length - 1] ?? '' })}
                add={countryAdd}
                addLabel="Elegir país"
              />
            </Field>
            <Field label="Guerra al terminar el temporizador (war_with_on_remove)">
              <Chips
                value={d.warWithOnRemove ? [d.warWithOnRemove] : []}
                onChange={(v) => set({ warWithOnRemove: v[v.length - 1] ?? '' })}
                add={countryAdd}
                addLabel="Elegir país"
              />
            </Field>
          </>
        )}
        {tab === 'ai' && (
          <>
            <Field
              label="Peso base de la IA (ai_will_do)"
              help="Por defecto la IA NUNCA elige una decisión. 0 = no se escribe ai_will_do."
            >
              <NumberField value={d.aiBase} min={0} onChange={(v) => set({ aiBase: v })} />
            </Field>
            {d.aiBase <= 0 && !d.aiModifiers.length && (
              <p className="text-xs text-yellow-400">
                Aviso: con peso 0 la IA nunca usará esta decisión.
              </p>
            )}
            {d.aiModifiers.map((m, i) => (
              <Card
                key={i}
                title={`Modificador ${i + 1}`}
                actions={
                  <Button
                    small
                    onClick={() => set({ aiModifiers: d.aiModifiers.filter((_, n) => n !== i) })}
                  >
                    Borrar
                  </Button>
                }
              >
                <Field label="factor">
                  <NumberField
                    value={m.factor}
                    onChange={(v) =>
                      set({
                        aiModifiers: d.aiModifiers.map((x, n) =>
                          n === i ? { ...x, factor: v } : x
                        )
                      })
                    }
                  />
                </Field>
                <BlocklyArea
                  mode="condition"
                  value={m.trigger}
                  onChange={(v) =>
                    set({
                      aiModifiers: d.aiModifiers.map((x, n) => (n === i ? { ...x, trigger: v } : x))
                    })
                  }
                  height={160}
                />
              </Card>
            ))}
            <Button
              small
              onClick={() =>
                set({ aiModifiers: [...d.aiModifiers, { factor: 2, trigger: emptyScript() }] })
              }
            >
              + Modificador de IA
            </Button>
          </>
        )}
        {tab === 'target' && (
          <>
            {d.kind === 'target-country' ? (
              <Field label="Países objetivo (targets)">
                <Chips
                  value={d.targetCountries}
                  onChange={(v) => set({ targetCountries: v })}
                  add={countryAdd}
                  addLabel="+ País"
                />
              </Field>
            ) : (
              <Field label="Estados objetivo (state_target)">
                <Chips
                  value={d.targetStates}
                  onChange={(v) => set({ targetStates: v })}
                  add={() => chooseState({})}
                  addLabel="+ Estado"
                />
              </Field>
            )}
            <Script
              label="target_trigger"
              mode="condition"
              value={d.targetTrigger}
              onChange={(v) => set({ targetTrigger: v })}
              help="FROM es el objetivo."
            />
            <Field label="on_map_mode">
              <input
                className="input"
                placeholder="map_only"
                value={d.onMapMode}
                onChange={(e) => set({ onMapMode: e.target.value.trim() }, 'mapmode')}
              />
            </Field>
          </>
        )}
      </div>
    </div>
  )
}

function Side({ project, uid }: { project: Project; uid: string | null }): JSX.Element {
  const d = (project.decisions ?? []).find((x) => x.uid === uid)
  const c = (project.decisionCategories ?? []).find((x) => x.uid === uid)
  const item = d ?? c
  if (!item) return <p className="text-xs text-hoi-muted">Elige una decisión para ver su script.</p>
  const issues = validateDecisions(project).filter((i) => i.uid === item.uid)
  const only = d
    ? {
        ...project,
        decisionCategories: (project.decisionCategories ?? []).filter(
          (x) => x.uid === d.categoryUid
        ),
        decisions: [d]
      }
    : { ...project, decisionCategories: [c!], decisions: [] }
  const text = decisionFiles(only)
    .filter((f) => f.text && f.path.endsWith('.txt'))
    .map((f) => f.text)
    .join('\n')
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
      <pre className="whitespace-pre-wrap rounded bg-hoi-card p-2 font-mono text-[11px]">
        {text}
      </pre>
    </div>
  )
}

const find = (p: Project, uid: string): 'cat' | 'dec' | null =>
  (p.decisionCategories ?? []).some((c) => c.uid === uid)
    ? 'cat'
    : (p.decisions ?? []).some((d) => d.uid === uid)
      ? 'dec'
      : null

function mkCategory(): string {
  let uid = ''
  store.updateProject((p) => {
    const r = createCategory(p, {})
    uid = r.category.uid
    return r.project
  })
  return uid
}
function mkDecision(kind: Decision['kind'] | null): string {
  let uid = ''
  store.updateProject((p) => {
    // Sin categorías no hay dónde poner la decisión: se crea una vacía
    const base = (p.decisionCategories ?? []).length ? p : createCategory(p, {}).project
    const d = kind ? decisionFromTemplate(base, kind) : createDecision(base, {}).decision
    uid = d.uid
    const decisions = [...(base.decisions ?? []).filter((x) => x.uid !== d.uid), d]
    return { ...base, decisions }
  })
  return uid
}

registerSectionScreen('decisiones', {
  create: () => mkDecision(null),
  duplicate: (uid) => {
    let out: string | null = null
    store.updateProject((p) => {
      const r = duplicateDecision(p, uid)
      out = r?.decision.uid ?? null
      return r?.project ?? p
    })
    return out
  },
  remove: (uid) => {
    const p = store.get().project
    if (!p) return
    const kind = find(p, uid)
    if (kind === 'cat' && confirm('¿Borrar la categoría? Sus decisiones quedan sin categoría.'))
      store.updateProject((pr) => deleteCategory(pr, uid))
    else if (kind === 'dec' && confirm('¿Borrar la decisión?'))
      store.updateProject((pr) => deleteDecision(pr, uid))
  },
  templates: [
    { id: 'category', label: 'Nueva categoría', create: mkCategory },
    ...DECISION_TEMPLATES.map((t) => ({
      id: t.id,
      label: t.label,
      create: () => mkDecision(t.id)
    }))
  ],
  items: (p) => [
    ...(p.decisionCategories ?? []).flatMap((c) => [
      { uid: c.uid, id: c.id, name: `▸ ${c.name || c.id}` },
      ...decisionsOf(p, c.uid).map((d) => ({ uid: d.uid, id: d.id, name: `    ${d.name || d.id}` }))
    ]),
    ...decisionsOf(p, null).map((d) => ({
      uid: d.uid,
      id: d.id,
      name: `(sin categoría) ${d.name || d.id}`
    }))
  ],
  renderEditor: (p, sel) => {
    if (!sel) return null
    const k = find(p, sel)
    if (k === 'cat')
      return <CategoryEditor project={p} c={p.decisionCategories.find((c) => c.uid === sel)!} />
    if (k === 'dec')
      return <DecisionEditor project={p} d={p.decisions.find((d) => d.uid === sel)!} />
    return null
  },
  renderPreview: (p, sel) => <Side project={p} uid={sel} />
})
