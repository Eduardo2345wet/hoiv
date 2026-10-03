// Pestaña Personajes: líderes, consejeros, generales, mariscales y almirantes de cualquier país.
import { useState } from 'react'
import type { Project } from '../types'
import { store, useApp } from '../store/appStore'
import { registerSectionScreen } from '../sections/ui'
import {
  ADVISOR_SLOTS,
  characterFiles,
  characterNode,
  characterUsage,
  createCharacter,
  deleteCharacter,
  duplicateCharacter,
  leadersToCharacters,
  ROLES,
  SKILL_RANGE,
  updateCharacter,
  validateCharacters
} from '../sections/characters'
import type { AdvisorSlot, Character, CharacterRole } from '../sections/types'
import { serialize } from '../export/clausewitz'
import { chooseCountryTag } from './countryFlow'
import BlocklyArea from './BlocklyArea'
import { Button, Card, Field, NumberField, Select, Tabs } from './kit'

const patch = (uid: string, p: Partial<Character>, group?: string): void =>
  store.updateProject(
    (pr) => updateCharacter(pr, uid, p),
    group ? { group: `field:${uid}:${group}` } : undefined
  )

/** Rasgos con búsqueda sobre la lista real del juego (o escritura libre si no hay carpeta) */
function TraitPicker({
  value,
  onChange,
  options
}: {
  value: string[]
  onChange: (v: string[]) => void
  options: string[] | null
}): JSX.Element {
  const [q, setQ] = useState('')
  const found = (options ?? [])
    .filter((t) => t.includes(q.trim().toLowerCase()) && !value.includes(t))
    .slice(0, 8)
  return (
    <div>
      <div className="mb-1 flex flex-wrap gap-1">
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
        className="input"
        placeholder={options ? 'Buscar rasgo del juego…' : 'Escribe el rasgo y pulsa Enter'}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && !options && q.trim()) {
            onChange([...value, q.trim()])
            setQ('')
          }
        }}
      />
      {q.trim() &&
        found.map((t) => (
          <div
            key={t}
            className="cursor-pointer px-1 text-xs hover:bg-hoi-card"
            onClick={() => (onChange([...value, t]), setQ(''))}
          >
            {t}
          </div>
        ))}
    </div>
  )
}

function Portrait({
  label,
  value,
  onChange
}: {
  label: string
  value: string | null
  onChange: (v: string | null) => void
}): JSX.Element {
  return (
    <Field label={label} help="Se recorta al tamaño de los retratos del juego al exportar">
      <div className="flex items-center gap-2">
        {value ? (
          <img src={value} alt="" className="h-16 rounded" />
        ) : (
          <span className="text-xs text-hoi-muted">sin retrato</span>
        )}
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
              r.onload = () => onChange(String(r.result))
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
    </Field>
  )
}

function Skill({
  label,
  value,
  onChange
}: {
  label: string
  value: number
  onChange: (v: number) => void
}): JSX.Element {
  const bad = !(value >= SKILL_RANGE.min && value <= SKILL_RANGE.max)
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-28">{label}</span>
      <input
        type="range"
        min={SKILL_RANGE.min}
        max={SKILL_RANGE.max}
        value={Math.min(SKILL_RANGE.max, Math.max(SKILL_RANGE.min, value))}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <NumberField value={value} onChange={onChange} />
      {bad && (
        <span className="text-yellow-400">
          fuera de {SKILL_RANGE.min}–{SKILL_RANGE.max}
        </span>
      )}
    </div>
  )
}

function Editor({ project, c }: { project: Project; c: Character }): JSX.Element {
  const game = useApp(() => store.catalogGame())
  const [tab, setTab] = useState('general')
  const set = (p: Partial<Character>, g?: string): void => patch(c.uid, p, g)
  const toggle = (r: CharacterRole): void =>
    set({ roles: c.roles.includes(r) ? c.roles.filter((x) => x !== r) : [...c.roles, r] })
  const lt = game?.leaderTraits
  const advTraits = lt ? lt.filter((t) => t.slot === c.advisor.slot).map((t) => t.id) : null
  const leaderTraits = lt ? lt.filter((t) => !t.slot).map((t) => t.id) : null
  const unitTraits = game?.unitTraits ? game.unitTraits.map((t) => t.id) : null
  const usage = characterUsage(project, c)
  const mil = c.roles.some((r) => r === 'corps_commander' || r === 'field_marshal')
  return (
    <div className="p-3">
      <Tabs
        tabs={[
          { id: 'general', label: 'General' },
          { id: 'roles', label: 'Roles' }
        ]}
        value={tab}
        onChange={setTab}
      />
      <div className="mt-3 space-y-3">
        {tab === 'general' && (
          <>
            <Field label="Nombre">
              <input
                className="input"
                value={c.name}
                onChange={(e) => set({ name: e.target.value }, 'name')}
              />
            </Field>
            <Field label="ID" help="Se usa para el nombre y para reclutarlo">
              <input
                className="input font-mono"
                value={c.id}
                onChange={(e) => set({ id: e.target.value.replace(/[^A-Za-z0-9_]/g, '_') }, 'id')}
              />
            </Field>
            <Field label="País">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs">{c.country || '(sin elegir)'}</span>
                <Button
                  small
                  onClick={() =>
                    void chooseCountryTag('País del personaje').then(
                      (t) => t && set({ country: t })
                    )
                  }
                >
                  Elegir…
                </Button>
              </div>
            </Field>
            <Portrait
              label="Retrato civil (líder / consejero)"
              value={c.portraits.civilian}
              onChange={(v) => set({ portraits: { ...c.portraits, civilian: v } })}
            />
            <Portrait
              label="Retrato de ejército"
              value={c.portraits.army}
              onChange={(v) => set({ portraits: { ...c.portraits, army: v } })}
            />
            <Portrait
              label="Retrato de armada"
              value={c.portraits.navy}
              onChange={(v) => set({ portraits: { ...c.portraits, navy: v } })}
            />
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={c.recruit}
                onChange={(e) => set({ recruit: e.target.checked })}
              />
              Reclutar al inicio (recruit_character; sin esto no aparece nunca)
            </label>
            {usage.length > 0 && <p className="text-xs text-hoi-muted">Uso: {usage.join(', ')}.</p>}
          </>
        )}
        {tab === 'roles' && (
          <>
            <div className="flex flex-wrap gap-3 text-xs">
              {ROLES.map((r) => (
                <label key={r.id} className="flex items-center gap-1">
                  <input
                    type="checkbox"
                    checked={c.roles.includes(r.id)}
                    onChange={() => toggle(r.id)}
                  />
                  {r.label}
                </label>
              ))}
            </div>
            {c.roles.includes('country_leader') && (
              <Card title="Líder del país">
                <Field label="Ideología (subideología)">
                  <input
                    className="input font-mono"
                    value={c.leader.ideology}
                    onChange={(e) =>
                      set({ leader: { ...c.leader, ideology: e.target.value } }, 'ideo')
                    }
                  />
                </Field>
                <Field label="Rasgos">
                  <TraitPicker
                    value={c.leader.traits}
                    options={leaderTraits}
                    onChange={(v) => set({ leader: { ...c.leader, traits: v } })}
                  />
                </Field>
              </Card>
            )}
            {c.roles.includes('advisor') && (
              <Card title="Consejero">
                <Field label="Ranura">
                  <Select
                    value={c.advisor.slot}
                    options={ADVISOR_SLOTS.map((s) => ({ value: s.id, label: s.label }))}
                    onChange={(v) => set({ advisor: { ...c.advisor, slot: v as AdvisorSlot } })}
                  />
                </Field>
                <Field label="Identificador del cargo (único)">
                  <input
                    className="input font-mono"
                    value={c.advisor.ideaToken}
                    onChange={(e) =>
                      set(
                        {
                          advisor: {
                            ...c.advisor,
                            ideaToken: e.target.value.replace(/[^A-Za-z0-9_]/g, '_')
                          }
                        },
                        'tok'
                      )
                    }
                  />
                </Field>
                <Field label="Costo (poder político)">
                  <NumberField
                    value={c.advisor.cost}
                    min={0}
                    onChange={(v) => set({ advisor: { ...c.advisor, cost: v } })}
                  />
                </Field>
                <label className="flex items-center gap-2 text-xs">
                  <input
                    type="checkbox"
                    checked={c.advisor.canBeFired}
                    onChange={(e) =>
                      set({ advisor: { ...c.advisor, canBeFired: e.target.checked } })
                    }
                  />
                  Se puede despedir
                </label>
                <Field label="Rasgos (de esta ranura)">
                  <TraitPicker
                    value={c.advisor.traits}
                    options={advTraits}
                    onChange={(v) => set({ advisor: { ...c.advisor, traits: v } })}
                  />
                </Field>
                <Field label="allowed (condición)">
                  <BlocklyArea
                    mode="condition"
                    value={c.advisor.allowed}
                    onChange={(v) => set({ advisor: { ...c.advisor, allowed: v } })}
                    height={160}
                  />
                </Field>
              </Card>
            )}
            {mil && (
              <Card title="General / mariscal">
                {(
                  [
                    ['skill', 'Nivel'],
                    ['attack', 'Ataque'],
                    ['defense', 'Defensa'],
                    ['planning', 'Planificación'],
                    ['logistics', 'Logística']
                  ] as const
                ).map(([k, l]) => (
                  <Skill
                    key={k}
                    label={l}
                    value={c.army[k]}
                    onChange={(v) => set({ army: { ...c.army, [k]: v } })}
                  />
                ))}
                <Field label="Rasgos">
                  <TraitPicker
                    value={c.army.traits}
                    options={unitTraits}
                    onChange={(v) => set({ army: { ...c.army, traits: v } })}
                  />
                </Field>
              </Card>
            )}
            {c.roles.includes('navy_leader') && (
              <Card title="Almirante">
                {(
                  [
                    ['skill', 'Nivel'],
                    ['attack', 'Ataque'],
                    ['defense', 'Defensa'],
                    ['maneuvering', 'Maniobra'],
                    ['coordination', 'Coordinación']
                  ] as const
                ).map(([k, l]) => (
                  <Skill
                    key={k}
                    label={l}
                    value={c.navy[k]}
                    onChange={(v) => set({ navy: { ...c.navy, [k]: v } })}
                  />
                ))}
                <Field label="Rasgos">
                  <TraitPicker
                    value={c.navy.traits}
                    options={unitTraits}
                    onChange={(v) => set({ navy: { ...c.navy, traits: v } })}
                  />
                </Field>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Side({ project, uid }: { project: Project; uid: string | null }): JSX.Element {
  const c = (project.characters ?? []).find((x) => x.uid === uid)
  if (!c) {
    const n = project.countries.reduce((a, x) => a + x.leaders.length, 0)
    return (
      <div className="text-xs text-hoi-muted">
        <p>Elige un personaje para ver su script.</p>
        {n > 0 && (
          <Button
            small
            onClick={() => {
              store.updateProject((p) => leadersToCharacters(p))
              store.toast('Líderes del asistente pasados a Personajes.')
            }}
          >
            Traer los {n} líderes del asistente
          </Button>
        )}
      </div>
    )
  }
  const issues = validateCharacters(project, store.catalogGame()).filter((i) => i.uid === c.uid)
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
        {serialize([characterNode(c)])}
      </pre>
      <span className="hidden">{characterFiles(project).length}</span>
    </div>
  )
}

registerSectionScreen('personajes', {
  create: () => {
    let uid = ''
    store.updateProject((p) => {
      const r = createCharacter(p, { roles: ['advisor'] })
      uid = r.character.uid
      return r.project
    })
    return uid
  },
  duplicate: (uid) => {
    let out: string | null = null
    store.updateProject((p) => {
      const r = duplicateCharacter(p, uid)
      out = r?.character.uid ?? null
      return r?.project ?? p
    })
    return out
  },
  remove: (uid) => {
    const p = store.get().project
    const c = p?.characters.find((x) => x.uid === uid)
    if (!c) return
    const u = characterUsage(p!, c)
    if (confirm(`¿Borrar a ${c.name || c.id}?${u.length ? ` (${u.join(', ')})` : ''}`))
      store.updateProject((pr) => deleteCharacter(pr, uid))
  },
  items: (p) =>
    (p.characters ?? []).map((c) => ({
      uid: c.uid,
      id: c.id,
      name: `${c.country || '???'} · ${c.name || c.id} · ${c.roles.map((r) => ROLES.find((x) => x.id === r)?.label).join(', ')}`
    })),
  renderEditor: (p, sel) => {
    const c = (p.characters ?? []).find((x) => x.uid === sel)
    return c ? <Editor project={p} c={c} /> : null
  },
  renderPreview: (p, sel) => <Side project={p} uid={sel} />
})
