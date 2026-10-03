// Panel "Estado" (S6): población, categoría, recursos, edificios, puntos de victoria y edificios por
// provincia. Cada cambio se guarda en stateEdits (solo si difiere del original) y se exporta con el
// parche mínimo del archivo del estado.
import type { Project } from '../../types'
import type { MapState } from '../../../../shared/map/types'
import { store, useApp } from '../../store/appStore'
import {
  BUILTIN_CATEGORIES,
  COASTAL_ONLY,
  RESOURCES,
  RESOURCE_LABELS,
  buildingInfo,
  buildingsOf,
  categoryOf,
  manpowerOf,
  provinceBuildingsOf,
  resourcesOf,
  setStateProps,
  victoryPointsOf
} from '../../map/stateProps'
import { validateStateData } from '../../map/validateStateData'

const num = (v: string): number => (v === '' ? 0 : Math.max(0, Math.floor(Number(v)) || 0))

/** Registro final menos lo que ya es igual al original (así el edit queda mínimo) */
function diff(orig: Record<string, number>, cur: Record<string, number>): Record<string, number> {
  const out: Record<string, number> = {}
  for (const [k, v] of Object.entries(cur)) if ((orig[k] ?? 0) !== v) out[k] = v
  return out
}

function NumInput({
  value,
  onChange,
  max,
  disabled,
  title
}: {
  value: number
  onChange: (v: number) => void
  max?: number
  disabled?: boolean
  title?: string
}): JSX.Element {
  return (
    <input
      type="number"
      className="input w-20 text-right"
      min={0}
      value={value}
      disabled={disabled}
      title={title}
      onChange={(e) => onChange(num(e.target.value))}
      style={max !== undefined && value > max ? { borderColor: '#f87171' } : undefined}
    />
  )
}

const Sec = ({ title, children }: { title: string; children: React.ReactNode }): JSX.Element => (
  <div className="mt-3 border-t border-hoi-border pt-2">
    <div className="mb-1 text-xs font-semibold uppercase text-hoi-muted">{title}</div>
    {children}
  </div>
)

export default function StateDataPanel({
  state,
  project
}: {
  state: MapState
  project: Project
}): JSX.Element {
  const game = useApp(() => store.catalogGame())
  const map = useApp((s) => s.map)
  const province = useApp((s) => s.selectedProvince)
  const info = buildingInfo(game)
  const edit = project.stateEdits[state.id]
  const patch = (p: Parameters<typeof setStateProps>[2], group?: string): void =>
    store.updateProject(
      (pr) => setStateProps(pr, state.id, p),
      group ? { group: `estado:${state.id}:${group}` } : undefined
    )

  const manpower = manpowerOf(state, project)
  const categories = game?.stateCategories ?? BUILTIN_CATEGORIES
  const category = categoryOf(state, project)
  const resources = resourcesOf(state, project)
  const buildings = buildingsOf(state, project)
  const provBuildings = provinceBuildingsOf(state, project)
  const vps = victoryPointsOf(state, project)
  const stateWide = Object.keys(info).filter((k) => !info[k].provincial)
  const provincial = Object.keys(info).filter((k) => info[k].provincial)
  const selProv = province !== null && state.provinces.includes(province) ? province : null
  const coastal = selProv !== null && !!map?.provinceCoastal[selProv]
  const issues = map
    ? validateStateData(project, map, game).filter((i) => i.stateId === state.id)
    : []

  const setRecord = (
    key: 'resources' | 'buildings',
    name: string,
    v: number,
    cur: Record<string, number>,
    orig: Record<string, number>
  ): void => patch({ [key]: diff(orig, { ...cur, [name]: v }) }, `${key}:${name}`)

  const setProvBuilding = (kind: string, v: number): void => {
    if (selProv === null) return
    const mine = { ...(edit?.provinceBuildings ?? {}) }
    const origProv = state.provinceBuildings?.[selProv] ?? {}
    const next = diff(origProv, { ...(provBuildings[selProv] ?? {}), [kind]: v })
    if (Object.keys(next).length) mine[String(selProv)] = next
    else delete mine[String(selProv)]
    patch({ provinceBuildings: mine }, `pb:${selProv}:${kind}`)
  }
  const setVp = (prov: number, v: number): void => {
    const mine = { ...(edit?.victoryPoints ?? {}) }
    const orig = state.victoryPoints.find((x) => x[0] === prov)?.[1] ?? 0
    if (v === orig) delete mine[String(prov)]
    else mine[String(prov)] = v
    patch({ victoryPoints: mine }, `vp:${prov}`)
  }

  return (
    <div data-testid="state-data">
      <Sec title="Población">
        <div className="flex items-center gap-2 text-sm">
          <input
            type="number"
            className="input w-32 text-right"
            min={1}
            value={manpower}
            onChange={(e) =>
              patch(
                {
                  manpower:
                    num(e.target.value) === (state.manpower ?? 0) ? undefined : num(e.target.value)
                },
                'manpower'
              )
            }
          />
          <span className="text-xs text-hoi-muted">{manpower.toLocaleString('es')} habitantes</span>
        </div>
      </Sec>
      <Sec title="Categoría">
        <select
          className="input"
          value={category}
          onChange={(e) =>
            patch({ category: e.target.value === state.category ? undefined : e.target.value })
          }
        >
          {!categories.includes(category) && <option value={category}>{category || '—'}</option>}
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Sec>
      <Sec title="Recursos">
        <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-sm">
          {RESOURCES.map((r) => (
            <label key={r} className="flex items-center justify-between gap-1">
              {RESOURCE_LABELS[r]}
              <NumInput
                value={resources[r] ?? 0}
                onChange={(v) => setRecord('resources', r, v, resources, state.resources ?? {})}
              />
            </label>
          ))}
        </div>
      </Sec>
      <Sec title="Edificios del estado">
        <div className="grid grid-cols-1 gap-1 text-sm">
          {stateWide.map((b) => (
            <label key={b} className="flex items-center justify-between gap-1">
              <span>
                {b} <span className="text-xs text-hoi-muted">(máx. {info[b].max})</span>
              </span>
              <NumInput
                value={buildings[b] ?? 0}
                max={info[b].max}
                onChange={(v) => setRecord('buildings', b, v, buildings, state.buildings ?? {})}
              />
            </label>
          ))}
        </div>
      </Sec>
      <Sec title="Puntos de victoria">
        {vps.map(([prov, v]) => (
          <label key={prov} className="flex items-center justify-between gap-1 text-sm">
            Provincia {prov}
            <NumInput value={v} onChange={(x) => setVp(prov, x)} />
          </label>
        ))}
        {!vps.length && <div className="text-xs text-hoi-muted">Ninguno.</div>}
        {selProv !== null && !vps.some((x) => x[0] === selProv) && (
          <button
            className="btn mt-1 w-full justify-center text-xs"
            onClick={() => setVp(selProv, 1)}
          >
            + Punto de victoria en la provincia {selProv}
          </button>
        )}
      </Sec>
      <Sec title="Edificios de la provincia">
        {selProv === null ? (
          <div className="text-xs text-hoi-muted">
            Con la herramienta Seleccionar, haz clic en una provincia de este estado.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-1 text-sm">
            <div className="text-xs text-hoi-muted">
              Provincia {selProv} {coastal ? '(costera)' : '(interior)'}
            </div>
            {provincial.map((b) => {
              const blocked = COASTAL_ONLY.includes(b) && !coastal
              return (
                <label key={b} className="flex items-center justify-between gap-1">
                  <span>
                    {b} <span className="text-xs text-hoi-muted">(máx. {info[b].max})</span>
                  </span>
                  <NumInput
                    value={provBuildings[selProv]?.[b] ?? 0}
                    max={info[b].max}
                    disabled={blocked}
                    title={blocked ? 'Solo en provincias costeras' : undefined}
                    onChange={(v) => setProvBuilding(b, v)}
                  />
                </label>
              )
            })}
          </div>
        )}
      </Sec>
      {issues.map((i, n) => (
        <p
          key={n}
          className={`mt-2 text-xs ${i.severity === 'error' ? 'text-red-400' : 'text-yellow-400'}`}
        >
          {i.message}
        </p>
      ))}
      {edit &&
        (edit.manpower !== undefined ||
          edit.category ||
          edit.resources ||
          edit.buildings ||
          edit.provinceBuildings ||
          edit.victoryPoints) && (
          <button
            className="btn mt-3 w-full justify-center text-xs"
            onClick={() =>
              patch({
                manpower: undefined,
                category: undefined,
                resources: undefined,
                buildings: undefined,
                provinceBuildings: undefined,
                victoryPoints: undefined
              })
            }
          >
            Restablecer datos de este estado
          </button>
        )}
    </div>
  )
}
