// Asistente "Crear país" paso a paso. "Editar país" usa los mismos formularios en pestañas.
// El borrador vive aquí mientras el asistente esté abierto; al guardar se aplica al
// proyecto en UN solo paso de deshacer.
import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import { IDEOLOGIES, IDEOLOGY_LABELS, type Country, type Project } from '../../types'
import { store, useApp } from '../../store/appStore'
import {
  addCountry,
  assignTree,
  createTreeForCountry,
  newCountry,
  newLeader,
  replaceCountry,
  rulingLeader
} from '../../countries/countryOps'
import { suggestTag } from '../../countries/tags'
import { mapColor, toHex } from '../../countries/color'
import { STEPS, validateCountry } from '../../countries/validateCountry'
import Modal from '../Modal'
import { flagSrc } from '../FlagThumb'
import { renderPortraitPlaceholder } from '../../icons/renderer'
import {
  CapitalStep,
  FlagStep,
  IdentityStep,
  LeaderStep,
  PoliticsStep,
  takenTags,
  type StepProps
} from './steps'

interface Props {
  project: Project
  /** Si se da, se edita ese país (pestañas); si no, se crea uno nuevo (pasos) */
  countryUid?: string
  initialStep?: number
  onClose: () => void
}

/** Árbol para el país: ninguno, uno nuevo vacío o uno existente */
type TreeChoice = 'none' | 'new' | string

export default function CountryWizard({
  project,
  countryUid,
  initialStep = 0,
  onClose
}: Props): JSX.Element {
  const game = useApp(() => store.catalogGame())
  const editing = project.countries.find((c) => c.uid === countryUid)
  const initial = useMemo<Country>(() => {
    if (editing) return structuredClone(editing)
    const c = newCountry({
      mode: 'nuevo',
      tag: suggestTag('Nuevo', takenTags(project, game)),
      name: ''
    })
    c.leaders = [newLeader('', c.politics.ruling)]
    return c
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [draft, setDraft] = useState<Country>(initial)
  const [step, setStep] = useState(initialStep)
  const [tagTouched, setTagTouched] = useState(!!editing)
  const [treeChoice, setTreeChoice] = useState<TreeChoice>(editing?.focusTreeId ?? 'new')

  const dirty = JSON.stringify(draft) !== JSON.stringify(initial)
  const issues = validateCountry(
    draft,
    { ...project, countries: editing ? project.countries : [...project.countries, draft] },
    game
  )
  const stepErrors = issues.filter((i) => i.severity === 'error' && i.step === step)
  const allErrors = issues.filter((i) => i.severity === 'error')

  /** Cambiar el borrador. En un país existente, tocar política/capital/líder = cambiar su historia */
  const set = (patch: Partial<Country>): void =>
    setDraft((d) => {
      const next = { ...d, ...patch }
      // Líderes: solo cuentan como cambio de historia si hay historia del juego para reclutarlos
      const touches =
        'politics' in patch ||
        'capital' in patch ||
        ('leaders' in patch && !!d.existing.historyText)
      if (d.mode === 'existente' && touches)
        next.existing = { ...next.existing, historyEdited: true }
      return next
    })

  const close = (): void => {
    if (!dirty || confirm('Hay cambios sin guardar en el asistente. ¿Cerrar igualmente?')) onClose()
  }

  const save = (): void => {
    if (allErrors.length) return
    store.updateProject((p) => {
      let next = editing
        ? replaceCountry(p, { ...draft, light: false })
        : addCountry(p, { ...draft, focusTreeId: null })
      if (treeChoice === 'new') next = createTreeForCountry(next, draft.uid).project
      else next = assignTree(next, draft.uid, treeChoice === 'none' ? null : treeChoice)
      return next
    })
    onClose()
  }

  const next = (): void => {
    if (stepErrors.length) return
    if (step < STEPS.length - 1) setStep(step + 1)
    else save()
  }

  // ¿Hay otra ventana (subir imagen) abierta encima del asistente?
  const nestedOpen = (): boolean => document.querySelectorAll('[data-modal]').length > 1

  // Enter avanza (salvo en textos largos, botones o con otra ventana encima)
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const t = e.target as HTMLElement
      if (store.get().pick) return
      if (
        e.key === 'Enter' &&
        !editing &&
        !nestedOpen() &&
        t.tagName !== 'TEXTAREA' &&
        t.tagName !== 'BUTTON'
      ) {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  /** Cambiar el borrador sin marcar "historia cambiada" (datos leídos del juego) */
  const replaceDraft = (fn: (d: Country) => Country): void => setDraft(fn)
  const props: StepProps = { draft, set, replaceDraft, project, game, tagTouched, setTagTouched }
  const body = [
    <IdentityStep key="0" {...props} />,
    <PoliticsStep key="1" {...props} />,
    <CapitalStep key="2" {...props} />,
    <FlagStep key="3" {...props} />,
    <LeaderStep key="4" {...props} />,
    <SummaryStep
      key="5"
      {...props}
      treeChoice={treeChoice}
      setTreeChoice={setTreeChoice}
      goTo={setStep}
      issues={issues}
    />
  ][step]

  // Mientras se elige la capital en el mapa, el asistente se oculta (conserva el borrador)
  const pickingState = useApp((s) => s.pick?.kind === 'state')
  return (
    <div
      className={pickingState ? 'hidden' : ''}
      // Esc: pregunta antes de cerrar si hay cambios (si hay otra ventana encima, la cierra ella)
      onKeyDownCapture={(e) => {
        if (e.key !== 'Escape' || nestedOpen()) return
        e.stopPropagation()
        close()
      }}
    >
      <Modal
        title={editing ? `Editar país: ${editing.names.name || editing.tag}` : 'Crear país'}
        width={860}
        onClose={close}
        footer={
          <>
            {stepErrors[0] && (
              <span
                className="mr-auto max-w-[480px] truncate text-xs text-red-400"
                title={stepErrors[0].message}
              >
                ✖ {stepErrors[0].message}
              </span>
            )}
            <button className="btn" onClick={close}>
              Cancelar
            </button>
            {editing ? (
              <button
                className="btn-primary disabled:opacity-40"
                disabled={allErrors.length > 0}
                title={allErrors[0]?.message}
                onClick={save}
              >
                Guardar cambios
              </button>
            ) : (
              <>
                <button
                  className="btn disabled:opacity-40"
                  disabled={step === 0}
                  onClick={() => setStep(step - 1)}
                >
                  Atrás
                </button>
                <button
                  className="btn-primary disabled:opacity-40"
                  disabled={
                    step === STEPS.length - 1 ? allErrors.length > 0 : stepErrors.length > 0
                  }
                  onClick={next}
                >
                  {step === STEPS.length - 1 ? 'Crear país' : 'Siguiente'}
                </button>
              </>
            )}
          </>
        }
      >
        {/* Barra de progreso (asistente) o pestañas (editar) */}
        <div className="mb-4 flex gap-1">
          {STEPS.map((name, n) => {
            const hasErr = issues.some((i) => i.severity === 'error' && i.step === n)
            return (
              <button
                key={name}
                disabled={!editing && n > step}
                onClick={() => setStep(n)}
                className={`flex-1 rounded px-2 py-1.5 text-xs ${
                  n === step
                    ? 'bg-hoi-accent font-semibold text-black'
                    : n < step || editing
                      ? 'bg-hoi-card'
                      : 'bg-hoi-bg text-hoi-muted'
                }`}
              >
                {n + 1}. {name} {hasErr && (n < step || editing) ? '⚠' : ''}
              </button>
            )
          })}
        </div>
        {body}
      </Modal>
    </div>
  )
}

// ======================= Paso 6: Resumen =======================
function SummaryStep({
  draft,
  project,
  treeChoice,
  setTreeChoice,
  goTo,
  issues
}: StepProps & {
  treeChoice: TreeChoice
  setTreeChoice: (t: TreeChoice) => void
  goTo: (step: number) => void
  issues: ReturnType<typeof validateCountry>
}): JSX.Element {
  const ruler = rulingLeader(draft)
  const ownerOf = (treeId: string): string | undefined =>
    project.countries.find((c) => c.focusTreeId === treeId && c.uid !== draft.uid)?.tag
  return (
    <div className="flex gap-6">
      <div className="w-72 shrink-0 rounded border border-hoi-border bg-hoi-bg p-4">
        <img
          src={flagSrc(draft)}
          width={164}
          height={104}
          alt=""
          className="mb-2 ring-1 ring-black"
        />
        <div className="text-lg font-semibold">{draft.names.name || '(sin nombre)'}</div>
        <div className="mb-2 font-mono text-xs text-hoi-muted">
          {draft.tag} · {draft.mode === 'nuevo' ? 'país nuevo' : 'existente'}
        </div>
        <div className="mb-2 flex items-center gap-2 text-xs">
          <span className="h-4 w-8 rounded" style={{ background: toHex(draft.color) }} /> original
          <span
            className="h-4 w-8 rounded"
            style={{ background: toHex(mapColor(draft.color)) }}
          />{' '}
          mapa
        </div>
        <div className="text-sm">Gobierno: {IDEOLOGY_LABELS[draft.politics.ruling]}</div>
        <div className="mb-2 text-xs text-hoi-muted">
          {IDEOLOGIES.map((i) => `${IDEOLOGY_LABELS[i]} ${draft.politics.popularities[i]}%`).join(
            ' · '
          )}
        </div>
        <div className="text-sm">Capital: {draft.capital ?? '—'}</div>
        <div className="mt-2 text-sm">Líderes:</div>
        {draft.leaders.map((l) => (
          <div key={l.uid} className="flex items-center gap-2 text-xs">
            <img
              src={l.portrait ?? renderPortraitPlaceholder(l.name)}
              width={26}
              height={35}
              alt=""
            />
            {l.name || '(sin nombre)'} · {l.subideology || '—'} {l === ruler && '★'}
          </div>
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <label className="label">Árbol de focos</label>
        <select
          className="input mb-4"
          value={treeChoice}
          onChange={(e) => setTreeChoice(e.target.value)}
        >
          <option value="new">Crear un árbol vacío</option>
          <option value="none">Ninguno (usa el genérico del juego)</option>
          {project.focusTrees.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
              {ownerOf(t.id) ? ` (ahora de ${ownerOf(t.id)})` : ''}
            </option>
          ))}
        </select>
        <div className="label">Revisión</div>
        {!issues.length && (
          <p className="flex items-center gap-2 text-sm text-emerald-400">
            <CheckCircle2 size={16} /> Todo en orden
          </p>
        )}
        <ul className="flex flex-col gap-1">
          {issues.map((i, n) => (
            <li key={n} className="flex items-start gap-2 text-sm">
              {i.severity === 'error' ? (
                <XCircle size={16} className="mt-0.5 shrink-0 text-red-400" />
              ) : (
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-yellow-400" />
              )}
              <span className="flex-1">{i.message}</span>
              {i.step !== undefined && i.step !== STEPS.length - 1 && (
                <button className="btn px-2 py-0.5 text-xs" onClick={() => goTo(i.step!)}>
                  Ir
                </button>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
