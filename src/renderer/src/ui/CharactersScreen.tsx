// Pestaña Personajes: líderes, consejeros, generales, mariscales y almirantes de cualquier país.
import { useState } from 'react'
import { Crown, Medal, Anchor, Briefcase, User } from 'lucide-react'
import type { Project } from '../types'
import { store, useApp } from '../store/appStore'
import { registerSectionScreen, type GroupNode, type TemplateCard } from '../sections/ui'
import {
  ADVISOR_SLOTS,
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
import { chooseCountryTag, nameOfTag } from './countryFlow'
import BlocklyArea from './BlocklyArea'
import { flagForTag } from './FlagThumb'
import { Button, Card, Field, NumberField, Select, type CardNote } from './kit'

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
    <Field label={label} help="Se ajusta al tamaño de los retratos del juego al exportar.">
      <div className="flex items-center gap-2">
        {value ? (
          <img src={value} alt="" className="h-16 rounded" />
        ) : (
          <span className="text-xs text-hoi-muted">Sin retrato</span>
        )}
        <label className="btn cursor-pointer px-2 py-0.5 text-xs">
          Subir imagen
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
          Fuera de {SKILL_RANGE.min} a {SKILL_RANGE.max}
        </span>
      )}
    </div>
  )
}

/** Texto corto de un aviso del validador, en lenguaje claro */
function noteOf(i: { severity: 'error' | 'aviso'; message: string }): CardNote {
  const t = i.message
    .replace(/^Personaje [^:]+: /, '')
    .replace(/idea_token/g, 'identificador del cargo')
    .replace(/on_actions/g, 'un evento automático')
    .replace(/^el ID /, 'El identificador ')
    .replace(/ ID repetido/, ' identificador repetido')
  return {
    severity: i.severity === 'error' ? 'error' : 'aviso',
    text: t.charAt(0).toUpperCase() + t.slice(1)
  }
}

const roleLabel = (r: CharacterRole): string => ROLES.find((x) => x.id === r)?.label ?? r
const rolesText = (c: Character): string =>
  c.roles.length ? c.roles.map(roleLabel).join(', ') : 'Sin papel'

function Editor({ project, c }: { project: Project; c: Character }): JSX.Element {
  const game = useApp(() => store.catalogGame())
  const set = (p: Partial<Character>, g?: string): void => patch(c.uid, p, g)
  const toggle = (r: CharacterRole): void =>
    set({ roles: c.roles.includes(r) ? c.roles.filter((x) => x !== r) : [...c.roles, r] })
  const lt = game?.leaderTraits
  const advTraits = lt ? lt.filter((t) => t.slot === c.advisor.slot).map((t) => t.id) : null
  const leaderTraits = lt ? lt.filter((t) => !t.slot).map((t) => t.id) : null
  const unitTraits = game?.unitTraits ? game.unitTraits.map((t) => t.id) : null
  const usage = characterUsage(project, c)
  const mil = c.roles.some((r) => r === 'corps_commander' || r === 'field_marshal')
  const notes = validateCharacters(project, game)
    .filter((i) => i.uid === c.uid)
    .map(noteOf)
  const civil = c.roles.some((r) => r === 'country_leader' || r === 'advisor') || !c.roles.length
  const subs = [...new Set(Object.values(game?.subideologies ?? {}).flat())]
  return (
    <div className="mx-auto max-w-3xl p-5" data-character-editor>
      <Card title="Básico" notes={notes}>
        <Field label="Nombre">
          <input
            className="input"
            value={c.name}
            onChange={(e) => set({ name: e.target.value }, 'name')}
          />
        </Field>
        <Field label="País">
          <div className="flex items-center gap-2">
            {c.country ? (
              <>
                <img
                  src={flagForTag(
                    c.country,
                    project.countries.find((x) => x.tag === c.country)
                  )}
                  alt=""
                  className="h-4"
                />
                <span className="text-sm">{nameOfTag(c.country)}</span>
              </>
            ) : (
              <span className="text-sm text-hoi-muted">Sin elegir</span>
            )}
            <Button
              small
              onClick={() =>
                void chooseCountryTag('País del personaje').then((t) => t && set({ country: t }))
              }
            >
              {c.country ? 'Cambiar' : 'Elegir'}
            </Button>
          </div>
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={c.recruit}
            onChange={(e) => set({ recruit: e.target.checked })}
          />
          Aparece al empezar la partida
        </label>
        <p className="mt-1 text-xs text-hoi-muted">
          Sin esto el personaje no aparece nunca en el juego.
        </p>
        {usage.length > 0 && (
          <p className="mt-1 text-xs text-hoi-muted">Uso: {usage.join(', ')}.</p>
        )}
      </Card>

      <Card title="Qué papel tiene">
        <div className="flex flex-wrap gap-2" data-roles>
          {ROLES.map((r) => {
            const on = c.roles.includes(r.id)
            return (
              <button
                key={r.id}
                data-role={r.id}
                aria-pressed={on}
                onClick={() => toggle(r.id)}
                className={`rounded-full border px-3 py-1 text-xs ${on ? 'border-hoi-accent bg-hoi-accent/15 text-hoi-text' : 'border-hoi-border text-hoi-muted hover:bg-hoi-card'}`}
              >
                {r.label}
              </button>
            )
          })}
        </div>
      </Card>

      {c.roles.includes('country_leader') && (
        <Card title="Líder del país">
          <Field label="Ideología">
            <input
              className="input"
              list="subideologias-juego"
              value={c.leader.ideology}
              onChange={(e) => set({ leader: { ...c.leader, ideology: e.target.value } }, 'ideo')}
            />
            <datalist id="subideologias-juego">
              {subs.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
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
          <Field label="Puesto">
            <Select
              value={c.advisor.slot}
              options={ADVISOR_SLOTS.map((s) => ({ value: s.id, label: s.label }))}
              onChange={(v) => set({ advisor: { ...c.advisor, slot: v as AdvisorSlot } })}
            />
          </Field>
          <Field label="Costo en poder político">
            <NumberField
              value={c.advisor.cost}
              min={0}
              onChange={(v) => set({ advisor: { ...c.advisor, cost: v } })}
            />
          </Field>
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={c.advisor.canBeFired}
              onChange={(e) => set({ advisor: { ...c.advisor, canBeFired: e.target.checked } })}
            />
            Se puede despedir
          </label>
          <Field label="Rasgos de este puesto">
            <TraitPicker
              value={c.advisor.traits}
              options={advTraits}
              onChange={(v) => set({ advisor: { ...c.advisor, traits: v } })}
            />
          </Field>
        </Card>
      )}

      {mil && (
        <Card title="General o mariscal">
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
          <div className="mt-3">
            <Field label="Rasgos">
              <TraitPicker
                value={c.army.traits}
                options={unitTraits}
                onChange={(v) => set({ army: { ...c.army, traits: v } })}
              />
            </Field>
          </div>
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
          <div className="mt-3">
            <Field label="Rasgos">
              <TraitPicker
                value={c.navy.traits}
                options={unitTraits}
                onChange={(v) => set({ navy: { ...c.navy, traits: v } })}
              />
            </Field>
          </div>
        </Card>
      )}

      <Card title="Retratos">
        {civil && (
          <Portrait
            label="Retrato civil (líder o consejero)"
            value={c.portraits.civilian}
            onChange={(v) => set({ portraits: { ...c.portraits, civilian: v } })}
          />
        )}
        {mil && (
          <Portrait
            label="Retrato del ejército"
            value={c.portraits.army}
            onChange={(v) => set({ portraits: { ...c.portraits, army: v } })}
          />
        )}
        {c.roles.includes('navy_leader') && (
          <Portrait
            label="Retrato de la armada"
            value={c.portraits.navy}
            onChange={(v) => set({ portraits: { ...c.portraits, navy: v } })}
          />
        )}
      </Card>

      <Card title="Opciones avanzadas" collapsible defaultOpen={false}>
        <Field label="Identificador" help="Se genera solo a partir del nombre.">
          <input
            className="input font-mono"
            value={c.id}
            onChange={(e) => set({ id: e.target.value.replace(/[^A-Za-z0-9_]/g, '_') }, 'id')}
          />
        </Field>
        {c.roles.includes('advisor') && (
          <>
            <Field label="Identificador del cargo" help="Debe ser único entre los consejeros.">
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
            <Field label="Condición para poder tenerlo">
              <BlocklyArea
                mode="condition"
                value={c.advisor.allowed}
                onChange={(v) => set({ advisor: { ...c.advisor, allowed: v } })}
                height={160}
              />
            </Field>
          </>
        )}
      </Card>
    </div>
  )
}

/** El personaje como una tarjeta: retrato, nombre, papel y lo más importante de su ficha */
function CharacterPreview({ project, c }: { project: Project; c: Character }): JSX.Element {
  const portrait = c.roles.includes('navy_leader')
    ? (c.portraits.navy ?? c.portraits.civilian)
    : c.roles.some((r) => r === 'corps_commander' || r === 'field_marshal')
      ? (c.portraits.army ?? c.portraits.civilian)
      : c.portraits.civilian
  const mil = c.roles.some((r) => r === 'corps_commander' || r === 'field_marshal')
  const slot = ADVISOR_SLOTS.find((s) => s.id === c.advisor.slot)?.label
  return (
    <div
      data-character-preview
      className="mx-auto w-full max-w-[320px] rounded-sm border-2 border-[#8c7b4f] bg-[#232b36] p-3"
    >
      <div className="flex gap-3">
        <div className="flex h-[105px] w-[78px] shrink-0 items-center justify-center overflow-hidden rounded-sm bg-black/30">
          {portrait ? (
            <img src={portrait} alt="" className="h-full w-full object-cover" />
          ) : (
            <User size={32} className="text-hoi-muted" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div data-preview-name className="truncate text-sm font-semibold text-hoi-text">
            {c.name || 'Personaje sin nombre'}
          </div>
          <div className="mt-0.5 flex items-center gap-1 text-[11px] text-hoi-muted">
            {c.country && (
              <img
                src={flagForTag(
                  c.country,
                  project.countries.find((x) => x.tag === c.country)
                )}
                alt=""
                className="h-3"
              />
            )}
            {c.country ? nameOfTag(c.country) : 'Sin país'}
          </div>
          <div className="mt-1 text-[11px] text-hoi-muted">{rolesText(c)}</div>
          {c.roles.includes('advisor') && (
            <div className="mt-1 text-[11px] text-hoi-text">
              {slot} · {c.advisor.cost} de poder político
            </div>
          )}
          {mil && (
            <div className="mt-1 text-[11px] text-hoi-text">
              Nivel {c.army.skill} · ataque {c.army.attack} · defensa {c.army.defense}
            </div>
          )}
          {c.roles.includes('navy_leader') && (
            <div className="mt-1 text-[11px] text-hoi-text">
              Nivel {c.navy.skill} · ataque {c.navy.attack} · defensa {c.navy.defense}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const ROLE_CARDS: (TemplateCard & { roles: CharacterRole[] })[] = [
  {
    id: 'country_leader',
    label: 'Líder del país',
    description: 'Gobierna el país con la ideología que elijas.',
    thumb: <Crown size={20} />,
    roles: ['country_leader']
  },
  {
    id: 'advisor',
    label: 'Consejero',
    description: 'Ocupa un puesto del gobierno y da ventajas.',
    thumb: <Briefcase size={20} />,
    roles: ['advisor']
  },
  {
    id: 'corps_commander',
    label: 'General',
    description: 'Manda divisiones con su nivel y sus rasgos.',
    thumb: <Medal size={20} />,
    roles: ['corps_commander']
  },
  {
    id: 'field_marshal',
    label: 'Mariscal',
    description: 'Un general de rango más alto que manda ejércitos.',
    thumb: <Medal size={20} />,
    roles: ['field_marshal']
  },
  {
    id: 'navy_leader',
    label: 'Almirante',
    description: 'Manda flotas y tiene su propia ficha.',
    thumb: <Anchor size={20} />,
    roles: ['navy_leader']
  }
]

registerSectionScreen('personajes', {
  intro:
    'Líderes, consejeros, generales, mariscales y almirantes de cualquier país, con su retrato y sus rasgos.',
  newSpec: {
    title: 'Nuevo personaje',
    nameLabel: 'Nombre del personaje',
    namePlaceholder: 'Por ejemplo: Ana Torres',
    groupLabel: 'País',
    groups: (p) => {
      const tags = new Set<string>([
        ...p.countries.filter((c) => !c.technical).map((c) => c.tag),
        ...(p.characters ?? []).map((c) => c.country).filter(Boolean)
      ])
      return [...tags].map((t) => ({ id: t, name: `${nameOfTag(t)} (${t})` }))
    },
    pickGroup: {
      label: 'Elegir otro país…',
      pick: async () => {
        const tag = await chooseCountryTag('País del personaje')
        return tag ? { id: tag, name: `${nameOfTag(tag)} (${tag})` } : null
      }
    },
    defaultTemplate: 'advisor',
    templates: ROLE_CARDS.map((x) => ({
      id: x.id,
      label: x.label,
      description: x.description,
      thumb: x.thumb
    })),
    create: ({ name, groupId, template }) => {
      let uid = ''
      store.updateProject((p) => {
        const r = createCharacter(p, {
          name,
          country: groupId ?? '',
          roles: ROLE_CARDS.find((x) => x.id === template)?.roles ?? ['advisor']
        })
        uid = r.character.uid
        return r.project
      })
      return uid
    }
  },
  groups: (p): GroupNode[] => {
    const byCountry = new Map<string, Character[]>()
    for (const c of p.characters ?? [])
      byCountry.set(c.country, [...(byCountry.get(c.country) ?? []), c])
    return [...byCountry.entries()].map(([tag, list]) => ({
      id: tag || '_sin_pais',
      title: tag ? nameOfTag(tag) : 'Sin país',
      thumb: tag ? (
        <img
          src={flagForTag(
            tag,
            p.countries.find((x) => x.tag === tag)
          )}
          alt=""
          className="h-3"
        />
      ) : undefined,
      items: list.map((c) => ({
        uid: c.uid,
        title: c.name,
        subtitle: rolesText(c),
        thumb: <User size={16} className="text-hoi-muted" />
      }))
    }))
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
  renderHeader: (p) => {
    const n = p.countries.reduce((a, x) => a + x.leaders.length, 0)
    return n > 0 ? (
      <button
        className="mt-2 text-left text-xs text-hoi-muted underline hover:text-hoi-text"
        onClick={() => {
          store.updateProject((pr) => leadersToCharacters(pr))
          store.toast('Líderes del asistente pasados a Personajes.')
        }}
      >
        Traer los {n} líderes del asistente
      </button>
    ) : null
  },
  renderEditor: (p, sel) => {
    const c = (p.characters ?? []).find((x) => x.uid === sel)
    return c ? <Editor project={p} c={c} /> : null
  },
  renderPreview: (p, sel) => {
    const c = (p.characters ?? []).find((x) => x.uid === sel)
    return c ? <CharacterPreview project={p} c={c} /> : null
  },
  code: (p, sel) => {
    const c = (p.characters ?? []).find((x) => x.uid === sel)
    return c ? serialize([characterNode(c)]) : null
  }
})
