// Pestaña Decisiones: categorías (con su imagen) y decisiones dentro de ellas. Editor en tarjetas y
// vista previa de la categoría como se ve en el juego, con la entrada de cada decisión.
import { useState } from 'react'
import { Clock, MapPinned, ScrollText, Swords, Timer } from 'lucide-react'
import type { IconRef, Project } from '../types'
import { newUid } from '../types'
import { store, useApp } from '../store/appStore'
import { registerSectionScreen, type GroupNode } from '../sections/ui'
import {
  DECISION_KINDS,
  categoryNode,
  createCategory,
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
import { serialize } from '../export/clausewitz'
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
import GameIconPicker from './GameIconPicker'
import GameSprite from './GameSprite'
import ImageUploader from './ImageUploader'
import Modal from './Modal'
import Help from './Help'
import { Button, Card, Field, NumberField, Select, type CardNote } from './kit'
import { TemplateGallery } from './SectionParts'

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

const KIND_ICONS: Record<Decision['kind'], JSX.Element> = {
  normal: <ScrollText size={20} />,
  mission: <Timer size={20} />,
  'target-country': <Swords size={20} />,
  'target-state': <MapPinned size={20} />
}
const KIND_TEXT: Record<Decision['kind'], { label: string; description: string }> = {
  normal: { label: 'Decisión normal', description: 'Se toma cuando quieras, pagando su costo.' },
  mission: {
    label: 'Misión con cuenta regresiva',
    description: 'Tiene un tiempo límite para cumplirla.'
  },
  'target-country': {
    label: 'Contra otros países',
    description: 'Se toma contra un país concreto.'
  },
  'target-state': { label: 'Sobre estados', description: 'Se toma sobre estados del mapa.' }
}

/** Miniatura de un ícono (del juego o propio) */
function IconView({
  project,
  icon,
  h
}: {
  project: Project
  icon: IconRef | null
  h: number
}): JSX.Element {
  if (icon?.kind === 'game') return <GameSprite name={icon.gfx} height={h} />
  if (icon?.kind === 'asset') {
    const a = project.icons.find((x) => x.id === icon.assetId)
    if (a)
      return <img src={a.png} alt="" style={{ height: h }} className="rounded object-contain" />
  }
  return <GameSprite name={null} height={h} />
}

/** Ícono: del juego (con miniaturas), de mi biblioteca o subido */
function IconChooser({
  project,
  label,
  value,
  kind,
  onChange
}: {
  project: Project
  label: string
  value: IconRef | null
  kind: 'decision' | 'decisionCategory'
  onChange: (v: IconRef | null) => void
}): JSX.Element {
  const [dlg, setDlg] = useState<'game' | 'upload' | 'library' | null>(null)
  return (
    <Field label={label}>
      <div className="flex items-center gap-3">
        <div className="flex h-14 w-14 items-center justify-center rounded bg-hoi-bg">
          <IconView project={project} icon={value} h={44} />
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
          {value && (
            <Button small onClick={() => onChange(null)}>
              Quitar
            </Button>
          )}
        </div>
      </div>
      {dlg === 'game' && (
        <GameIconPicker
          kind={kind}
          current={value?.kind === 'game' ? value.gfx : null}
          onClose={() => setDlg(null)}
          onPick={(gfx) => {
            onChange({ kind: 'game', gfx })
            setDlg(null)
          }}
        />
      )}
      {dlg === 'upload' && (
        <ImageUploader
          size={{ w: 66, h: 66 }}
          title="Imagen del ícono"
          onClose={() => setDlg(null)}
          onAcceptImage={(png) => {
            const id = newUid()
            store.updateProject((p) =>
              addAsset(p, { id, name: 'ícono', target: 'idea', png, width: 66, height: 66 })
            )
            onChange({ kind: 'asset', assetId: id })
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
                  onChange({ kind: 'asset', assetId: a.id })
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
            x
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
      <BlocklyArea mode={mode} value={value} onChange={onChange} height={190} />
    </Field>
  )
}

const clean = (m: string): string => {
  const t = m.replace(/^(Decisión|Categoría) [^:]+: /, '')
  return t.charAt(0).toUpperCase() + t.slice(1)
}

function CategoryEditor({ project, c }: { project: Project; c: DecisionCategory }): JSX.Element {
  const count = decisionsOf(project, c.uid).length
  const notes: CardNote[] = validateDecisions(project)
    .filter((i) => i.uid === c.uid)
    .map((i) => ({ severity: i.severity === 'error' ? 'error' : 'aviso', text: clean(i.message) }))
  return (
    <div className="mx-auto max-w-3xl p-5" data-category-editor>
      <Card title="Categoría" help={<Help id="decision.categoria" />} notes={notes}>
        <Field label="Nombre">
          <input
            className="input"
            value={c.name}
            onChange={(e) => patchC(c.uid, { name: e.target.value }, 'name')}
          />
        </Field>
        <Field label="Descripción">
          <textarea
            className="input h-16"
            value={c.description}
            onChange={(e) => patchC(c.uid, { description: e.target.value }, 'desc')}
          />
        </Field>
        <IconChooser
          project={project}
          label="Ícono"
          kind="decisionCategory"
          value={c.icon}
          onChange={(v) => patchC(c.uid, { icon: v })}
        />
        <IconChooser
          project={project}
          label="Imagen de la categoría"
          kind="decisionCategory"
          value={c.picture}
          onChange={(v) => patchC(c.uid, { picture: v })}
        />
        <p className="text-xs text-hoi-muted">
          {count} decisión{count === 1 ? '' : 'es'} en esta categoría. La imagen solo se ve si la
          categoría tiene descripción.
        </p>
      </Card>
      <Card title="Opciones avanzadas" collapsible defaultOpen={false}>
        <Field label="Prioridad" help="Las de mayor número salen primero.">
          <NumberField value={c.priority} onChange={(v) => patchC(c.uid, { priority: v })} />
        </Field>
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={c.visibleWhenEmpty}
            onChange={(e) => patchC(c.uid, { visibleWhenEmpty: e.target.checked })}
          />
          Mostrar la categoría aunque no tenga decisiones disponibles
        </label>
        <Field label="Estados que se resaltan al abrirla">
          <Chips
            value={c.highlightStates}
            onChange={(v) => patchC(c.uid, { highlightStates: v })}
            add={() => chooseState({})}
            addLabel="Añadir estado"
          />
        </Field>
        <Field label="Centrar el mapa" help="Posición (x, y) y zoom. Vacío = no mueve el mapa.">
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
        <Field label="Identificador">
          <input className="input font-mono text-xs" value={c.id} readOnly />
        </Field>
      </Card>
    </div>
  )
}

function DecisionEditor({ project, d }: { project: Project; d: Decision }): JSX.Element {
  const set = (p: Partial<Decision>, g?: string): void => patchD(d.uid, p, g)
  const cats = project.decisionCategories ?? []
  const mission = d.kind === 'mission'
  const target = d.kind === 'target-country' || d.kind === 'target-state'
  const all = validateDecisions(project).filter((i) => i.uid === d.uid)
  const by = (re: RegExp): CardNote[] =>
    all
      .filter((i) => re.test(i.message))
      .map((i) => ({
        severity: i.severity === 'error' ? 'error' : 'aviso',
        text: clean(i.message)
      }))
  const notesWhen = by(/visible|activa/i)
  const notesMission = by(/misi|tiempo/i)
  const notesTarget = by(/objetivo/i)
  const notesAdv = by(/ai_will_do|IA|temporizador|costo personalizado/i)
  const used = new Set(
    [...notesWhen, ...notesMission, ...notesTarget, ...notesAdv].map((n) => n.text)
  )
  const notesBasic = all
    .map((i): CardNote => ({
      severity: i.severity === 'error' ? 'error' : 'aviso',
      text: clean(i.message)
    }))
    .filter((n) => !used.has(n.text))
  return (
    <div className="mx-auto max-w-3xl p-5" data-decision-editor>
      <Card title="Básico" notes={notesBasic}>
        <Field label="Nombre">
          <input
            className="input"
            value={d.name}
            onChange={(e) => set({ name: e.target.value }, 'name')}
          />
        </Field>
        <IconChooser
          project={project}
          label="Ícono"
          kind="decision"
          value={d.icon}
          onChange={(v) => set({ icon: v })}
        />
        <Field label="Descripción">
          <textarea
            className="input h-16"
            value={d.description}
            onChange={(e) => set({ description: e.target.value }, 'desc')}
          />
        </Field>
        <Field
          label="Costo en poder político"
          helpId="decision.costoPP"
          help={
            d.cost.mode === 'custom'
              ? 'Usa un costo personalizado (opciones avanzadas).'
              : undefined
          }
        >
          <NumberField
            value={d.cost.mode === 'pp' ? d.cost.pp : 0}
            min={0}
            onChange={(v) => set({ cost: { ...d.cost, mode: v > 0 ? 'pp' : 'none', pp: v } })}
          />
        </Field>
        <div className="mb-1 text-[13px] text-gray-300">Tipo</div>
        <TemplateGallery
          compact
          value={d.kind}
          onChange={(id) => set({ kind: id as Decision['kind'] })}
          templates={DECISION_KINDS.map((k) => ({
            id: k.id,
            label: KIND_TEXT[k.id].label,
            description: KIND_TEXT[k.id].description,
            thumb: KIND_ICONS[k.id]
          }))}
        />
      </Card>

      <Card title="Cuándo se puede tomar" notes={notesWhen}>
        {!mission && (
          <Script
            label="Se muestra cuando"
            mode="condition"
            value={d.visible}
            onChange={(v) => set({ visible: v })}
          />
        )}
        <Script
          label="Se puede tomar cuando"
          mode="condition"
          value={d.available}
          onChange={(v) => set({ available: v })}
        />
        {mission && (
          <Script
            label="Se activa cuando"
            mode="condition"
            value={d.activation}
            onChange={(v) => set({ activation: v })}
          />
        )}
      </Card>

      <Card title="Qué pasa al tomarla">
        <Script
          label="Efectos"
          mode="effect"
          value={d.complete}
          onChange={(v) => set({ complete: v })}
        />
      </Card>

      {mission && (
        <Card
          title="Duración y qué pasa si se acaba el tiempo"
          notes={notesMission}
          help={<Help id="decision.mision" />}
        >
          <Field label="Tiempo límite (días)">
            <NumberField
              value={d.missionTimeoutDays}
              min={0}
              onChange={(v) => set({ missionTimeoutDays: v })}
            />
          </Field>
          <Script
            label="Si se acaba el tiempo"
            mode="effect"
            value={d.timeout}
            onChange={(v) => set({ timeout: v })}
          />
        </Card>
      )}

      {target && (
        <Card
          title={d.kind === 'target-country' ? 'Contra qué países' : 'Sobre qué estados'}
          notes={notesTarget}
          help={
            <Help
              id={d.kind === 'target-country' ? 'decision.contraPaises' : 'decision.sobreEstados'}
            />
          }
        >
          {d.kind === 'target-country' ? (
            <Field label="Países">
              <Chips
                value={d.targetCountries}
                onChange={(v) => set({ targetCountries: v })}
                add={countryAdd}
                addLabel="Añadir país"
              />
            </Field>
          ) : (
            <Field label="Estados">
              <Chips
                value={d.targetStates}
                onChange={(v) => set({ targetStates: v })}
                add={() => chooseState({})}
                addLabel="Añadir estado"
              />
            </Field>
          )}
          <Script
            label="Condición para que sea un objetivo válido"
            mode="condition"
            value={d.targetTrigger}
            onChange={(v) => set({ targetTrigger: v })}
          />
        </Card>
      )}

      <Card title="Opciones avanzadas" collapsible defaultOpen={false} notes={notesAdv}>
        <Field label="Categoría" helpId="decision.categoria">
          <Select
            value={d.categoryUid ?? ''}
            options={[
              { value: '', label: 'Sin categoría' },
              ...cats.map((c) => ({ value: c.uid, label: c.name || 'Categoría sin nombre' }))
            ]}
            onChange={(v) => set({ categoryUid: v || null })}
          />
        </Field>
        <Field label="Prioridad" help="Las de mayor número salen primero.">
          <NumberField value={d.priority} onChange={(v) => set({ priority: v })} />
        </Field>
        <Field label="Solo para estos países" help="Vacío = cualquier país.">
          <Chips
            value={d.countries}
            onChange={(v) => set({ countries: v })}
            add={countryAdd}
            addLabel="Añadir país"
          />
        </Field>
        <Field label="Tipo de costo">
          <Select
            value={d.cost.mode === 'custom' ? 'custom' : 'normal'}
            options={[
              { value: 'normal', label: 'Poder político (el de arriba)' },
              { value: 'custom', label: 'Costo personalizado con condición propia' }
            ]}
            onChange={(v) =>
              set({
                cost: { ...d.cost, mode: v === 'custom' ? 'custom' : d.cost.pp > 0 ? 'pp' : 'none' }
              })
            }
          />
        </Field>
        {d.cost.mode === 'custom' && (
          <>
            <Script
              label="Condición del costo personalizado"
              mode="condition"
              value={d.cost.customTrigger}
              onChange={(v) => set({ cost: { ...d.cost, customTrigger: v } })}
              help="No cobra nada por sí solo: réstalo tú en los efectos de arriba."
            />
            <Field label="Texto del costo">
              <input
                className="input"
                value={d.cost.customText}
                onChange={(e) => set({ cost: { ...d.cost, customText: e.target.value } }, 'ctext')}
              />
            </Field>
            <Field label="Poder político que la IA cree que cuesta">
              <NumberField
                value={d.cost.aiHintPp}
                min={0}
                onChange={(v) => set({ cost: { ...d.cost, aiHintPp: v } })}
              />
            </Field>
          </>
        )}
        <Field label="Días para volver a poder tomarla">
          <NumberField value={d.daysReEnable} min={0} onChange={(v) => set({ daysReEnable: v })} />
        </Field>
        <label className="mb-3 flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={d.fireOnlyOnce}
            onChange={(e) => set({ fireOnlyOnce: e.target.checked })}
          />
          Solo se puede tomar una vez
        </label>
        <Field label="Duración del efecto temporal (días)" help="0 = sin temporizador">
          <NumberField value={d.daysRemove} min={0} onChange={(v) => set({ daysRemove: v })} />
        </Field>
        <Card title="Modificadores mientras dura">
          {d.modifiers.map((m, i) => (
            <div key={i} className="mb-1 flex items-center gap-1">
              <Select
                value={m.key}
                options={MODIFIERS.map((x) => ({ value: x.key, label: x.label }))}
                onChange={(v) =>
                  set({ modifiers: d.modifiers.map((x, n) => (n === i ? { ...x, key: v } : x)) })
                }
              />
              <NumberField
                value={m.value}
                onChange={(v) =>
                  set({ modifiers: d.modifiers.map((x, n) => (n === i ? { ...x, value: v } : x)) })
                }
              />
              <Button
                small
                onClick={() => set({ modifiers: d.modifiers.filter((_, n) => n !== i) })}
              >
                Quitar
              </Button>
            </div>
          ))}
          <Button
            small
            onClick={() =>
              set({ modifiers: [...d.modifiers, { key: MODIFIERS[0].key, value: 10 }] })
            }
          >
            Añadir modificador
          </Button>
        </Card>
        <Script
          label="Al terminar el temporizador"
          mode="effect"
          value={d.remove}
          onChange={(v) => set({ remove: v })}
        />
        <Script
          label="Condición para cancelarla"
          mode="condition"
          value={d.cancelTrigger}
          onChange={(v) => set({ cancelTrigger: v })}
        />
        <Script
          label="Al cancelarla"
          mode="effect"
          value={d.cancel}
          onChange={(v) => set({ cancel: v })}
        />
        {mission && (
          <>
            <label className="mb-2 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={d.selectableMission}
                onChange={(e) => set({ selectableMission: e.target.checked })}
              />
              La misión se puede elegir manualmente
            </label>
            <label className="mb-3 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={d.isGood}
                onChange={(e) => set({ isGood: e.target.checked })}
              />
              Es una misión buena para el país
            </label>
          </>
        )}
        <Field label="Peso para la IA" help="Con 0, la IA nunca la toma.">
          <NumberField value={d.aiBase} min={0} onChange={(v) => set({ aiBase: v })} />
        </Field>
        {d.aiModifiers.map((m, i) => (
          <Card
            key={i}
            title={`Ajuste de IA ${i + 1}`}
            actions={
              <Button
                small
                onClick={() => set({ aiModifiers: d.aiModifiers.filter((_, n) => n !== i) })}
              >
                Quitar
              </Button>
            }
          >
            <Field label="Multiplicador">
              <NumberField
                value={m.factor}
                onChange={(v) =>
                  set({
                    aiModifiers: d.aiModifiers.map((x, n) => (n === i ? { ...x, factor: v } : x))
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
              height={150}
            />
          </Card>
        ))}
        <div className="mb-3">
          <Button
            small
            onClick={() =>
              set({ aiModifiers: [...d.aiModifiers, { factor: 2, trigger: emptyScript() }] })
            }
          >
            Añadir ajuste de IA
          </Button>
        </div>
        <Field label="Guerra al completarla contra">
          <Chips
            value={d.warWithOnComplete ? [d.warWithOnComplete] : []}
            onChange={(v) => set({ warWithOnComplete: v[v.length - 1] ?? '' })}
            add={countryAdd}
            addLabel="Elegir país"
          />
        </Field>
        <Field label="Guerra al terminar el temporizador contra">
          <Chips
            value={d.warWithOnRemove ? [d.warWithOnRemove] : []}
            onChange={(v) => set({ warWithOnRemove: v[v.length - 1] ?? '' })}
            add={countryAdd}
            addLabel="Elegir país"
          />
        </Field>
        {target && (
          <Field label="Modo de mapa">
            <input
              className="input"
              placeholder="Opcional"
              value={d.onMapMode}
              onChange={(e) => set({ onMapMode: e.target.value.trim() }, 'mapmode')}
            />
          </Field>
        )}
        <Field label="Identificador">
          <input className="input font-mono text-xs" value={d.id} readOnly />
        </Field>
      </Card>
    </div>
  )
}

/** Vista previa: la categoría como en la pestaña de decisiones del juego, con la entrada de cada decisión */
function DecisionPreview({ project, uid }: { project: Project; uid: string }): JSX.Element | null {
  const dec = (project.decisions ?? []).find((d) => d.uid === uid)
  const cat = (project.decisionCategories ?? []).find(
    (c) => c.uid === (dec ? dec.categoryUid : uid)
  )
  if (!cat)
    return dec ? (
      <p className="text-xs text-hoi-muted">
        Esta decisión no tiene categoría: en el juego no aparecería.
      </p>
    ) : null
  const list = decisionsOf(project, cat.uid)
  return (
    <div
      data-decision-preview
      className="mx-auto w-full max-w-[340px] rounded-sm border-2 border-[#8c7b4f] bg-[#232b36] p-3"
    >
      <div className="mb-2 flex items-center gap-2 border-b border-[#5a6578] pb-2">
        <IconView project={project} icon={cat.icon} h={30} />
        <div className="min-w-0">
          <div data-preview-category className="truncate text-sm font-semibold text-hoi-text">
            {cat.name || 'Nombre de la categoría'}
          </div>
          {cat.description && (
            <div className="truncate text-[11px] text-hoi-muted">{cat.description}</div>
          )}
        </div>
      </div>
      {cat.picture && cat.description.trim() && (
        <div className="mb-2 flex h-12 items-center justify-center overflow-hidden rounded-sm bg-black/30">
          <IconView project={project} icon={cat.picture} h={44} />
        </div>
      )}
      <div className="space-y-1.5">
        {list.map((d) => {
          const on = d.uid === uid
          const days = d.kind === 'mission' ? d.missionTimeoutDays : d.daysRemove || d.daysReEnable
          return (
            <div
              key={d.uid}
              data-preview-decision
              className={`flex items-center gap-2 rounded-sm border px-2 py-1.5 ${on ? 'border-hoi-accent bg-[#2f3947]' : 'border-[#3f4858] bg-[#1c222b]'}`}
            >
              <IconView project={project} icon={d.icon} h={30} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs text-hoi-text">
                  {d.name || 'Decisión sin nombre'}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-hoi-muted">
                  {d.cost.mode === 'pp' && d.cost.pp > 0 && (
                    <span>{d.cost.pp} de poder político</span>
                  )}
                  {d.cost.mode === 'custom' && <span>Costo especial</span>}
                  {days > 0 && (
                    <span className="flex items-center gap-0.5">
                      <Clock size={10} /> {days} días
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
        {!list.length && (
          <p className="text-xs text-hoi-muted">Esta categoría aún no tiene decisiones.</p>
        )}
      </div>
    </div>
  )
}

const find = (p: Project, uid: string): 'cat' | 'dec' | null =>
  (p.decisionCategories ?? []).some((c) => c.uid === uid)
    ? 'cat'
    : (p.decisions ?? []).some((d) => d.uid === uid)
      ? 'dec'
      : null

registerSectionScreen('decisiones', {
  intro:
    'Las decisiones son acciones que el jugador elige en una pantalla propia, pagando un costo. Cada decisión pertenece a una categoría, que es su pestaña en el juego.',
  newSpec: {
    title: 'Nueva decisión',
    nameLabel: 'Nombre de la decisión',
    namePlaceholder: 'Por ejemplo: Reforma agraria',
    defaultTemplate: 'normal',
    groupLabel: 'Categoría',
    groupHelp: 'decision.categoria',
    newGroupLabel: 'Crear una categoría nueva…',
    groups: (p) =>
      (p.decisionCategories ?? []).map((c) => ({
        id: c.uid,
        name: c.name || 'Categoría sin nombre'
      })),
    templates: DECISION_KINDS.map((k) => ({
      id: k.id,
      label: KIND_TEXT[k.id].label,
      description: KIND_TEXT[k.id].description,
      thumb: KIND_ICONS[k.id]
    })),
    create: ({ name, groupId, newGroupName, template }) => {
      let uid = ''
      store.updateProject((p0) => {
        let p = p0
        let catUid = groupId
        if (!catUid) {
          const r = createCategory(p, { name: newGroupName || 'Categoría' })
          p = r.project
          catUid = r.category.uid
        }
        const d = decisionFromTemplate(p, template as Decision['kind'], {
          name,
          categoryUid: catUid
        })
        uid = d.uid
        return { ...p, decisions: [...(p.decisions ?? []), d] }
      })
      return uid
    }
  },
  renderHeader: () => (
    <button
      className="mt-2 w-full text-left text-xs text-hoi-muted underline hover:text-hoi-text"
      onClick={() =>
        store.openPrompt({
          message: 'Nombre de la categoría nueva:',
          defaultValue: '',
          validate: (t) => (t.trim() ? null : 'Escribe un nombre'),
          callback: (t) => {
            if (t) store.updateProject((p) => createCategory(p, { name: t.trim() }).project)
          }
        })
      }
    >
      Nueva categoría
    </button>
  ),
  groups: (p): GroupNode[] => {
    const item = (d: Decision): GroupNode['items'][number] => ({
      uid: d.uid,
      title: d.name,
      subtitle: d.id,
      thumb: <IconView project={p} icon={d.icon} h={26} />
    })
    const nodes: GroupNode[] = (p.decisionCategories ?? []).map((c) => ({
      id: c.uid,
      title: c.name || 'Categoría sin nombre',
      selectUid: c.uid,
      thumb: <IconView project={p} icon={c.icon} h={18} />,
      items: decisionsOf(p, c.uid).map(item)
    }))
    const loose = decisionsOf(p, null)
    if (loose.length) nodes.push({ id: '_sin', title: 'Sin categoría', items: loose.map(item) })
    return nodes
  },
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
    if (kind === 'cat' && confirm('¿Borrar la categoría? Sus decisiones quedarán sin categoría.'))
      store.updateProject((pr) => deleteCategory(pr, uid))
    else if (kind === 'dec' && confirm('¿Borrar la decisión?'))
      store.updateProject((pr) => deleteDecision(pr, uid))
  },
  renderEditor: (p, sel) => {
    if (!sel) return null
    const k = find(p, sel)
    if (k === 'cat')
      return <CategoryEditor project={p} c={p.decisionCategories.find((c) => c.uid === sel)!} />
    if (k === 'dec')
      return <DecisionEditor project={p} d={p.decisions.find((d) => d.uid === sel)!} />
    return null
  },
  renderPreview: (p, sel) => (sel ? <DecisionPreview project={p} uid={sel} /> : null),
  code: (p, sel) => {
    if (!sel) return null
    const d = (p.decisions ?? []).find((x) => x.uid === sel)
    const c = (p.decisionCategories ?? []).find((x) => x.uid === sel)
    if (c) return serialize([categoryNode(p, c)])
    if (!d) return null
    const only = {
      ...p,
      decisionCategories: (p.decisionCategories ?? []).filter((x) => x.uid === d.categoryUid),
      decisions: [d]
    }
    return decisionFiles(only)
      .filter((f) => f.text && f.path.endsWith('.txt'))
      .map((f) => f.text)
      .join('\n')
  }
})

void useApp
