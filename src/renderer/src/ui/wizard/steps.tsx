// Formularios de cada paso del asistente "Crear país".
// Los mismos formularios se usan en "Editar país" (como pestañas).
import { useMemo, useState } from 'react'
import { Download, Plus, Trash2, Upload, X } from 'lucide-react'
import {
  IDEOLOGIES,
  IDEOLOGY_LABELS,
  type Country,
  type Ideology,
  type Leader,
  type Project
} from '../../types'
import type { GameCatalog } from '../../catalog/catalog'
import { store, useApp } from '../../store/appStore'
import { applyParsedHistory, parseHistory } from '../../countries/history'
import { getCatalogOptions } from '../../catalog/catalog'
import {
  fromHex,
  mapColor,
  toHex,
  colorDistance,
  SIMILAR_COLOR_DISTANCE
} from '../../countries/color'
import { balancePopularities, sumPopularities } from '../../countries/politics'
import { suggestTag } from '../../countries/tags'
import { newLeader, rulingLeader } from '../../countries/countryOps'
import {
  BUILTIN_GRAPHICAL_CULTURES,
  BUILTIN_GRAPHICAL_CULTURES_2D,
  BUILTIN_SUBIDEOLOGIES
} from '../../countries/gameData'
import { FLAG_SIZE, PORTRAIT_SIZE } from '../../countries/placeholders'
import { renderFlagPlaceholder, renderPortraitPlaceholder } from '../../icons/renderer'
import {
  resetFlagVariant,
  variantImage,
  type FlagVariant,
  type VariantImage
} from '../../countries/gameFlags'
import { downloadPng } from '../downloadPng'
import ImageUploader from '../ImageUploader'

export interface StepProps {
  draft: Country
  set: (patch: Partial<Country>) => void
  /** Cambiar el borrador sin marcar "historia cambiada" (datos leídos del juego) */
  replaceDraft: (fn: (d: Country) => Country) => void
  project: Project
  game: GameCatalog | null
  /** El tag lo escribió el usuario (no se vuelve a proponer solo) */
  tagTouched: boolean
  setTagTouched: (v: boolean) => void
}

/** País existente sin historia del juego: no se pueden cambiar política ni capital */
export function historyLocked(c: Country): boolean {
  return c.mode === 'existente' && !c.existing.historyText
}

export function HistoryNotice({ draft }: { draft: Country }): JSX.Element | null {
  if (!historyLocked(draft)) return null
  return (
    <div className="mb-3 rounded border border-sky-600/60 bg-sky-500/10 p-3 text-sm text-sky-200">
      ℹ Para cambiar la política o el líder de un país existente, configura la carpeta de HOI4 en
      Ajustes. Sin ella no se exporta la historia del país (se conserva la del juego).
    </div>
  )
}

const Field = ({
  label,
  children,
  hint
}: {
  label: string
  children: React.ReactNode
  hint?: string
}): JSX.Element => (
  <div>
    <label className="label">{label}</label>
    {children}
    {hint && <p className="mt-1 text-[11px] text-hoi-muted">{hint}</p>}
  </div>
)

/** Tags ya usados: juego (o lista integrada) + otros países del mod */
export function takenTags(
  project: Project,
  game: GameCatalog | null,
  exceptUid?: string
): string[] {
  return [
    ...getCatalogOptions('country', null, game).map((o) => o.id),
    ...project.countries.filter((c) => c.uid !== exceptUid).map((c) => c.tag)
  ]
}

// ======================= Paso 1: Identidad =======================
export function IdentityStep({
  draft,
  set,
  replaceDraft,
  project,
  game,
  tagTouched,
  setTagTouched
}: StepProps): JSX.Element {
  const [query, setQuery] = useState('')
  const gamePath = useApp((s) => s.gamePath)

  /** Elegir un país del juego: si hay carpeta, lee su historia y precarga sus valores */
  const pickGameCountry = async (tag: string, label: string): Promise<void> => {
    setTagTouched(true)
    replaceDraft((d) => ({
      ...d,
      tag,
      names: { name: label, def: label, adj: d.names.adj },
      existing: { ...d.existing, historyFile: null, historyText: null, historyEdited: false }
    }))
    const file = game?.historyFiles?.[tag]
    if (!file || !gamePath || !window.electronAPI) return
    const h = await window.electronAPI.readCountryHistory(gamePath, file)
    if (!h) return
    replaceDraft((d) =>
      d.tag !== tag
        ? d
        : applyParsedHistory(
            {
              ...d,
              existing: {
                ...d.existing,
                historyFile: h.fileName,
                historyText: h.text,
                historyEdited: false
              }
            },
            parseHistory(h.text)
          )
    )
  }
  const gameCountries = useMemo(
    () => getCatalogOptions('country', null, game).filter((o) => o.origen === 'juego'),
    [game]
  )
  const results = gameCountries
    .filter((o) => `${o.id} ${o.etiqueta}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 40)
  const similar = project.countries.find(
    (o) => o.uid !== draft.uid && colorDistance(o.color, draft.color) < SIMILAR_COLOR_DISTANCE
  )

  const setName = (name: string): void => {
    const patch: Partial<Country> = { names: { ...draft.names, name } }
    // El nombre con artículo sigue al nombre mientras no lo cambie a mano
    if (!draft.names.def || draft.names.def === draft.names.name) patch.names!.def = name
    if (draft.mode === 'nuevo' && !tagTouched && name.trim())
      patch.tag = suggestTag(name, takenTags(project, game, draft.uid))
    set(patch)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        {(['nuevo', 'existente'] as const).map((m) => (
          <button
            key={m}
            className={draft.mode === m ? 'btn-primary' : 'btn'}
            // Al pasar a "existente" se quitan los líderes de ejemplo (se añaden a mano)
            onClick={() =>
              replaceDraft((d) => ({ ...d, mode: m, leaders: m === 'existente' ? [] : d.leaders }))
            }
          >
            {m === 'nuevo' ? 'País nuevo' : 'Modificar uno existente'}
          </button>
        ))}
      </div>

      {draft.mode === 'existente' && (
        <Field
          label="País del juego"
          hint="Solo se exporta lo que cambies. Nunca se tocan country_tags ni common/countries."
        >
          <input
            className="input mb-1"
            placeholder="Buscar: México, GER…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="max-h-36 overflow-y-auto rounded border border-hoi-border">
            {results.map((o) => (
              <button
                key={o.id}
                onClick={() => void pickGameCountry(o.id, o.etiqueta)}
                className={`flex w-full gap-2 px-2 py-1 text-left text-sm hover:bg-hoi-card ${draft.tag === o.id ? 'bg-hoi-accent/20' : ''}`}
              >
                <span className="w-10 font-mono text-hoi-muted">{o.id}</span>
                {o.etiqueta}
              </button>
            ))}
          </div>
        </Field>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field
          label="Nombre"
          hint={
            draft.mode === 'existente'
              ? 'Para cambiarlo en el juego, marca la casilla de abajo.'
              : undefined
          }
        >
          <input
            className="input"
            autoFocus
            value={draft.names.name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nueva Granada"
          />
        </Field>
        <Field label="Tag (3 caracteres)" hint="Una letra mayúscula y 2 letras o números.">
          <div className="flex gap-1">
            <input
              className="input font-mono uppercase"
              maxLength={3}
              value={draft.tag}
              disabled={draft.mode === 'existente'}
              onChange={(e) => {
                setTagTouched(true)
                set({ tag: e.target.value.toUpperCase() })
              }}
            />
            {draft.mode === 'nuevo' && (
              <button
                className="btn px-2 text-xs"
                title="Proponer un tag libre a partir del nombre"
                onClick={() => {
                  setTagTouched(false)
                  set({
                    tag: suggestTag(draft.names.name || 'X', takenTags(project, game, draft.uid))
                  })
                }}
              >
                Proponer
              </button>
            )}
          </div>
        </Field>
        <Field label='Nombre con artículo (ej. "la República de X")'>
          <input
            className="input"
            value={draft.names.def}
            onChange={(e) => set({ names: { ...draft.names, def: e.target.value } })}
          />
        </Field>
        <Field label='Adjetivo (ej. "mexicano")'>
          <input
            className="input"
            value={draft.names.adj}
            onChange={(e) => set({ names: { ...draft.names, adj: e.target.value } })}
          />
        </Field>
      </div>

      {draft.mode === 'existente' && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={draft.existing.renameInGame}
            onChange={(e) =>
              set({ existing: { ...draft.existing, renameInGame: e.target.checked } })
            }
          />
          Cambiar el nombre del país en el juego (localización en replace/)
        </label>
      )}

      <Field label="Color del país">
        <div className="flex items-center gap-4">
          <input
            type="color"
            className="h-10 w-16 cursor-pointer rounded border border-hoi-border bg-transparent"
            value={toHex(draft.color)}
            onChange={(e) => set({ color: fromHex(e.target.value) })}
          />
          <div className="text-center text-[11px]">
            <div
              className="h-10 w-20 rounded ring-1 ring-hoi-border"
              style={{ background: toHex(draft.color) }}
            />
            Tu color
          </div>
          <div className="text-center text-[11px]">
            <div
              className="h-10 w-20 rounded ring-1 ring-hoi-border"
              style={{ background: toHex(mapColor(draft.color)) }}
            />
            Cómo se verá en el mapa
          </div>
        </div>
        {similar && (
          <p className="mt-1 text-xs text-yellow-400">
            ⚠ Es casi igual al color de {similar.names.name || similar.tag}: costará distinguirlos
            en el mapa.
          </p>
        )}
      </Field>

      {draft.mode === 'nuevo' && (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Estilo gráfico (unidades)">
            <select
              className="input"
              value={draft.graphicalCulture}
              onChange={(e) => set({ graphicalCulture: e.target.value })}
            >
              {(game?.graphicalCultures?.length
                ? game.graphicalCultures
                : BUILTIN_GRAPHICAL_CULTURES
              ).map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </Field>
          <Field label="Estilo gráfico 2D (retratos genéricos)">
            <select
              className="input"
              value={draft.graphicalCulture2d}
              onChange={(e) => set({ graphicalCulture2d: e.target.value })}
            >
              {(game?.graphicalCultures2d?.length
                ? game.graphicalCultures2d
                : BUILTIN_GRAPHICAL_CULTURES_2D
              ).map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </Field>
        </div>
      )}
    </div>
  )
}

// ======================= Paso 2: Política =======================
export function PoliticsStep(props: StepProps): JSX.Element {
  return (
    <>
      <HistoryNotice draft={props.draft} />
      <fieldset disabled={historyLocked(props.draft)} className="disabled:opacity-50">
        <PoliticsForm {...props} />
      </fieldset>
    </>
  )
}

function PoliticsForm({ draft, set }: StepProps): JSX.Element {
  const [lastMoved, setLastMoved] = useState<Ideology>(draft.politics.ruling)
  const [showNames, setShowNames] = useState(false)
  const pol = draft.politics
  const sum = sumPopularities(pol.popularities)
  const setPol = (patch: Partial<Country['politics']>): void =>
    set({ politics: { ...pol, ...patch } })
  const setPop = (i: Ideology, v: number): void => {
    setLastMoved(i)
    setPol({
      popularities: { ...pol.popularities, [i]: Math.max(0, Math.min(100, Math.round(v || 0))) }
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <Field label="Ideología gobernante">
        <div className="flex flex-wrap gap-2">
          {IDEOLOGIES.map((i) => (
            <button
              key={i}
              className={pol.ruling === i ? 'btn-primary' : 'btn'}
              onClick={() => setPol({ ruling: i })}
            >
              {IDEOLOGY_LABELS[i]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Popularidades (%)">
        {IDEOLOGIES.map((i) => (
          <div key={i} className="mb-1 flex items-center gap-3">
            <span className="w-28 text-sm">{IDEOLOGY_LABELS[i]}</span>
            <input
              type="range"
              min={0}
              max={100}
              value={pol.popularities[i]}
              className="flex-1 accent-orange-500"
              onChange={(e) => setPop(i, Number(e.target.value))}
            />
            <input
              type="number"
              min={0}
              max={100}
              className="input w-20"
              value={pol.popularities[i]}
              onChange={(e) => setPop(i, Number(e.target.value))}
            />
          </div>
        ))}
        <div className="mt-1 flex items-center gap-3">
          <span
            className={`text-sm font-semibold ${sum === 100 ? 'text-emerald-400' : 'text-red-400'}`}
          >
            Suma: {sum} %
          </span>
          <button
            className="btn text-xs"
            onClick={() =>
              setPol({ popularities: balancePopularities(pol.popularities, lastMoved) })
            }
            title={`Reparte la diferencia entre las otras 3 sin tocar ${IDEOLOGY_LABELS[lastMoved]}`}
          >
            Balancear
          </button>
        </div>
      </Field>

      <Field label="Elecciones">
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={pol.electionsAllowed}
              onChange={(e) => setPol({ electionsAllowed: e.target.checked })}
            />
            Permitidas
          </label>
          {pol.electionsAllowed && (
            <>
              <span>cada</span>
              <input
                type="number"
                min={1}
                className="input w-20"
                value={pol.electionFrequency}
                onChange={(e) =>
                  setPol({ electionFrequency: Math.max(1, Math.round(Number(e.target.value))) })
                }
              />
              <span>meses · última:</span>
              <input
                className="input w-28 font-mono"
                value={pol.lastElection}
                onChange={(e) => setPol({ lastElection: e.target.value })}
              />
            </>
          )}
        </div>
      </Field>

      <Field label="Partidos (nombre corto y largo)">
        {IDEOLOGIES.map((i) => (
          <div key={i} className="mb-1 flex items-center gap-2">
            <span className="w-28 text-sm">{IDEOLOGY_LABELS[i]}</span>
            <input
              className="input w-40"
              value={pol.parties[i].short}
              onChange={(e) =>
                setPol({
                  parties: { ...pol.parties, [i]: { ...pol.parties[i], short: e.target.value } }
                })
              }
            />
            <input
              className="input flex-1"
              value={pol.parties[i].long}
              onChange={(e) =>
                setPol({
                  parties: { ...pol.parties, [i]: { ...pol.parties[i], long: e.target.value } }
                })
              }
            />
          </div>
        ))}
      </Field>

      <div>
        <button
          className="text-sm text-hoi-accent underline"
          onClick={() => setShowNames(!showNames)}
        >
          {showNames ? '▾' : '▸'} Nombre del país por ideología (opcional)
        </button>
        {showNames &&
          IDEOLOGIES.map((i) => (
            <div key={i} className="mt-1 flex items-center gap-2">
              <span className="w-28 text-sm">{IDEOLOGY_LABELS[i]}</span>
              {(['name', 'def', 'adj'] as const).map((k) => (
                <input
                  key={k}
                  className="input flex-1"
                  placeholder={k === 'name' ? 'Nombre' : k === 'def' ? 'Con artículo' : 'Adjetivo'}
                  value={draft.ideologyNames[i][k]}
                  onChange={(e) =>
                    set({
                      ideologyNames: {
                        ...draft.ideologyNames,
                        [i]: { ...draft.ideologyNames[i], [k]: e.target.value }
                      }
                    })
                  }
                />
              ))}
            </div>
          ))}
      </div>
    </div>
  )
}

// ======================= Paso 3: Capital =======================
export function CapitalStep({ draft, set, game }: StepProps): JSX.Element {
  const state = game?.states?.find((s) => s.id === draft.capital)
  return (
    <fieldset disabled={historyLocked(draft)} className="flex flex-col gap-4 disabled:opacity-60">
      <HistoryNotice draft={draft} />
      <Field
        label="Capital (ID de estado)"
        hint="Es el número del estado en el juego. Más adelante se podrá elegir en el mapa."
      >
        <input
          type="number"
          min={1}
          list="estados-juego"
          className="input w-40"
          value={draft.capital ?? ''}
          onChange={(e) => {
            const n = Math.round(Number(e.target.value))
            set({ capital: n >= 1 ? n : null })
          }}
        />
        <button
          type="button"
          className="btn ml-2 text-xs"
          title="Abre la pestaña Mapa: haz clic en el estado y vuelves aquí"
          onClick={() =>
            store.startPick({
              kind: 'state',
              exclude: [],
              onPick: (id) => set({ capital: Number(id) })
            })
          }
        >
          🗺 Elegir en el mapa…
        </button>
        <datalist id="estados-juego">
          {game?.states?.slice(0, 2000).map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.owner})
            </option>
          ))}
        </datalist>
      </Field>
      {game?.states?.length ? (
        draft.capital ? (
          state ? (
            <p className="text-sm">
              Estado <b>{state.name}</b> · dueño actual:{' '}
              <span className="font-mono">{state.owner || '—'}</span>
              {state.owner && state.owner !== draft.tag && (
                <span className="text-yellow-400"> (no es de este país)</span>
              )}
            </p>
          ) : (
            <p className="text-sm text-yellow-400">⚠ Ese estado no existe en el juego.</p>
          )
        ) : null
      ) : (
        <p className="text-xs text-hoi-muted">
          Configura la carpeta del juego en Ajustes para ver el nombre y el dueño del estado.
        </p>
      )}
      {draft.mode === 'nuevo' && (
        <div className="rounded border border-yellow-600/60 bg-yellow-500/10 p-3 text-sm text-yellow-200">
          ⚠ Un país NUEVO no aparece en la partida si no es dueño de ningún estado. Asignarle
          estados llegará con el editor de mapa; mientras tanto puedes liberarlo con un foco o
          evento de otro país.
        </div>
      )}
    </fieldset>
  )
}

// ======================= Paso 4: Bandera =======================
const FLAG_SIZES = [
  [82, 52],
  [41, 26],
  [10, 7]
]
const VARIANT_LABEL: Record<FlagVariant, string> = {
  main: 'Principal',
  ...IDEOLOGY_LABELS
}

export function FlagStep({ draft, set }: StepProps): JSX.Element {
  const [upload, setUpload] = useState<FlagVariant | null>(null)
  const gameFlags = useApp((s) => s.gameFlags)
  const existing = draft.mode === 'existente'
  const img = (v: FlagVariant): VariantImage =>
    variantImage(draft, v, gameFlags, () => renderFlagPlaceholder(draft.tag, draft.color))
  const main = img('main')
  const edit = (_v: FlagVariant, c: Country): void => set({ flags: c.flags })
  return (
    <div className="flex flex-col gap-4">
      {existing && (
        <p className="rounded border border-hoi-border bg-hoi-card p-2 text-xs text-hoi-muted">
          {gameFlags?.[draft.tag]
            ? 'Estas son las banderas REALES del juego. Reemplaza las que quieras; al exportar solo se incluyen las que personalices, con los mismos nombres del juego.'
            : 'No se encontraron las banderas de este país en el juego (o no hay carpeta del juego); se muestra la de relleno.'}
        </p>
      )}
      <div className="flex items-start gap-6">
        <div>
          <div className="label">
            Bandera principal (
            {main.source === 'personalizada'
              ? 'personalizada'
              : main.source === 'juego'
                ? 'del juego'
                : 'de relleno'}
            )
          </div>
          <div className="flex gap-2">
            <button className="btn" onClick={() => setUpload('main')}>
              <Upload size={14} /> Subir imagen
            </button>
            <button className="btn" onClick={() => void downloadPng(main.src, `${draft.tag}.png`)}>
              <Download size={14} /> Descargar PNG
            </button>
            {draft.flags.main && (
              <button
                className="btn text-xs"
                onClick={() => edit('main', resetFlagVariant(draft, 'main'))}
              >
                {existing ? 'Volver a la del juego' : 'Usar la de relleno'}
              </button>
            )}
          </div>
          {draft.flags.mainSmall && (
            <p className="mt-1 text-xs text-yellow-400">
              ⚠ Imagen más chica que 82×52: se verá borrosa.
            </p>
          )}
        </div>
        <div>
          <div className="label">Tamaños reales</div>
          <div className="flex items-end gap-3 rounded bg-[#101013] p-3">
            {FLAG_SIZES.map(([w, h]) => (
              <div key={w} className="text-center text-[10px] text-hoi-muted">
                <img src={main.src} width={w} height={h} alt="" />
                {w}×{h}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="label">Fondo claro y oscuro</div>
          <div className="flex overflow-hidden rounded">
            <div className="bg-[#e8e4d8] p-3">
              <img src={main.src} width={82} height={52} alt="" />
            </div>
            <div className="bg-[#111] p-3">
              <img src={main.src} width={82} height={52} alt="" />
            </div>
          </div>
        </div>
      </div>

      <div>
        <div className="label">
          Bandera por ideología{' '}
          {existing
            ? '(las del juego; reemplaza solo las que quieras)'
            : '(opcional; las vacías usan la principal)'}
        </div>
        <div className="grid grid-cols-4 gap-2">
          {IDEOLOGIES.map((i) => {
            const v = img(i)
            return (
              <div
                key={i}
                className="flex flex-col items-center gap-1 rounded border border-hoi-border p-2 text-xs"
              >
                {VARIANT_LABEL[i]}
                <img
                  src={v.src}
                  width={82}
                  height={52}
                  alt=""
                  className={v.source === 'relleno' ? 'opacity-50' : ''}
                />
                <div className="flex items-end gap-2">
                  {FLAG_SIZES.slice(1).map(([w, h]) => (
                    <img key={w} src={v.src} width={w} height={h} alt="" title={`${w}×${h}`} />
                  ))}
                </div>
                <span
                  className={`text-[10px] ${v.source === 'personalizada' ? 'text-hoi-accent' : 'text-hoi-muted'}`}
                >
                  {v.source === 'personalizada'
                    ? 'personalizada'
                    : v.source === 'juego'
                      ? 'del juego'
                      : 'de relleno'}
                </span>
                <div className="flex flex-wrap justify-center gap-1">
                  <button className="btn px-2 py-0.5 text-[11px]" onClick={() => setUpload(i)}>
                    Subir
                  </button>
                  <button
                    className="btn px-2 py-0.5 text-[11px]"
                    title="Descargar PNG"
                    onClick={() => void downloadPng(v.src, `${draft.tag}_${i}.png`)}
                  >
                    <Download size={12} />
                  </button>
                  {draft.flags.byIdeology[i] && (
                    <button
                      className="btn px-2 py-0.5 text-[11px]"
                      title={existing ? 'Volver a la del juego' : 'Quitar'}
                      onClick={() => edit(i, resetFlagVariant(draft, i))}
                    >
                      {existing ? 'Volver a la del juego' : <X size={12} />}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {upload && (
        <ImageUploader
          title={
            upload === 'main'
              ? 'Bandera principal (82×52)'
              : `Bandera: ${VARIANT_LABEL[upload]} (82×52)`
          }
          size={FLAG_SIZE}
          onAcceptImage={(png, small) => {
            if (upload === 'main') set({ flags: { ...draft.flags, main: png, mainSmall: small } })
            else
              set({
                flags: { ...draft.flags, byIdeology: { ...draft.flags.byIdeology, [upload]: png } }
              })
            setUpload(null)
          }}
          onClose={() => setUpload(null)}
        />
      )}
    </div>
  )
}

// ======================= Paso 5: Líder =======================
export function LeaderStep({ draft, set, game }: StepProps): JSX.Element {
  const [photoFor, setPhotoFor] = useState<string | null>(null)
  const subs = (i: Ideology): string[] =>
    game?.subideologies?.[i]?.length ? game.subideologies[i] : BUILTIN_SUBIDEOLOGIES[i]
  const setLeader = (uid: string, patch: Partial<Leader>): void =>
    set({ leaders: draft.leaders.map((l) => (l.uid === uid ? { ...l, ...patch } : l)) })
  const ruler = rulingLeader(draft)

  const add = (): void => {
    const used = new Set(draft.leaders.map((l) => l.ideology))
    const ideology = !used.has(draft.politics.ruling)
      ? draft.politics.ruling
      : (IDEOLOGIES.find((i) => !used.has(i)) ?? draft.politics.ruling)
    set({
      leaders: [
        ...draft.leaders,
        newLeader(
          'Nuevo líder',
          ideology,
          draft.leaders.map((l) => l.id)
        )
      ]
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {historyLocked(draft) && (
        <p className="rounded border border-sky-600/60 bg-sky-500/10 p-2 text-xs text-sky-200">
          ℹ Sin la carpeta de HOI4, los líderes que añadas se exportan como personajes pero no se
          reclutan (hace falta la historia del país). Configúrala en Ajustes.
        </p>
      )}
      {!draft.leaders.length && (
        <p className="text-sm text-hoi-muted">Sin líderes: el juego usará uno genérico.</p>
      )}
      {draft.leaders.map((l) => (
        <div
          key={l.uid}
          className={`flex gap-4 rounded border p-3 ${l === ruler ? 'border-hoi-accent' : 'border-hoi-border'}`}
        >
          <div className="flex flex-col items-center gap-1">
            {/* Marco del retrato */}
            <div className="rounded-sm border-4 border-[#6b5a3a] bg-black p-0.5 shadow-lg">
              <img
                src={l.portrait ?? renderPortraitPlaceholder(l.name)}
                width={78}
                height={105}
                alt=""
              />
            </div>
            <button className="btn px-2 py-0.5 text-[11px]" onClick={() => setPhotoFor(l.uid)}>
              <Upload size={12} /> Foto
            </button>
            {l.portrait && (
              <button
                className="text-[10px] text-hoi-muted underline"
                onClick={() => setLeader(l.uid, { portrait: null, portraitSmall: false })}
              >
                usar relleno
              </button>
            )}
          </div>
          <div className="grid flex-1 grid-cols-2 gap-2">
            <Field label="Nombre">
              <input
                className="input"
                value={l.name}
                onChange={(e) => {
                  const others = draft.leaders.filter((x) => x.uid !== l.uid).map((x) => x.id)
                  setLeader(l.uid, {
                    name: e.target.value,
                    id: newLeader(e.target.value, l.ideology, others).id
                  })
                }}
              />
            </Field>
            <Field label="ID del personaje">
              <input className="input font-mono" value={`${draft.tag}_${l.id}`} disabled />
            </Field>
            <Field label="Ideología">
              <select
                className="input"
                value={l.ideology}
                onChange={(e) => {
                  const ideology = e.target.value as Ideology
                  setLeader(l.uid, { ideology, subideology: subs(ideology)[0] ?? '' })
                }}
              >
                {IDEOLOGIES.map((i) => (
                  <option key={i} value={i}>
                    {IDEOLOGY_LABELS[i]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Subideología">
              <select
                className="input"
                value={l.subideology}
                onChange={(e) => setLeader(l.uid, { subideology: e.target.value })}
              >
                <option value="">— elige —</option>
                {subs(l.ideology).map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <div className="col-span-2 flex items-center justify-between text-xs">
              <span className={l === ruler ? 'text-hoi-accent' : 'text-hoi-muted'}>
                {l === ruler
                  ? '★ Se recluta como líder del país (ideología gobernante)'
                  : 'Líder de reserva para otra ideología'}
              </span>
              <button
                className="text-red-400"
                onClick={() => set({ leaders: draft.leaders.filter((x) => x.uid !== l.uid) })}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        </div>
      ))}
      <button className="btn w-fit" onClick={add}>
        <Plus size={14} /> Añadir líder
      </button>
      {photoFor && (
        <ImageUploader
          title="Foto del líder (156×210)"
          size={PORTRAIT_SIZE}
          onAcceptImage={(png, small) => {
            setLeader(photoFor, { portrait: png, portraitSmall: small })
            setPhotoFor(null)
          }}
          onClose={() => setPhotoFor(null)}
        />
      )}
    </div>
  )
}
