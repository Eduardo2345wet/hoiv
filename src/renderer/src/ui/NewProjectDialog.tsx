// Archivo → Nuevo proyecto (como Archivo → Nuevo de NX): categorías y tarjetas con miniatura,
// vista previa y detalles a la derecha; abajo el nombre y la carpeta.
import { validateProjectName } from '../../../shared/names'
import { useEffect, useMemo, useState } from 'react'
import { store, useApp } from '../store/appStore'
import {
  CATEGORIES,
  TEMPLATES,
  emptyProjectFor,
  templateInfo,
  type TemplateCategory
} from '../templates'
import type { MapModRef, TemplateId } from '../types'
import { templateThumb } from '../map/templateThumbs'
import { rememberRecent } from './fileOps'
import Modal from './Modal'

interface InstalledMod extends MapModRef {
  source: 'documentos' | 'workshop'
  hasMap: boolean
  hasStates: boolean
}

export default function NewProjectDialog({ initialName }: { initialName: string }): JSX.Element {
  const map = useApp((s) => s.map)
  const mapKey = useApp((s) => s.mapKey)
  const loading = useApp((s) => s.mapLoading)
  const gamePath = useApp((s) => s.gamePath)
  const game = useApp(() => store.catalogGame())
  const [category, setCategory] = useState<TemplateCategory>('mapa')
  const [selected, setSelected] = useState<TemplateId>('blank')
  const [name, setName] = useState(initialName)
  const [folder, setFolder] = useState('')
  const [mods, setMods] = useState<InstalledMod[] | null>(null)
  const [mod, setMod] = useState<MapModRef | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const info = templateInfo(selected)

  useEffect(() => {
    void window.electronAPI?.getProjectsDir().then(setFolder)
    // Las miniaturas salen de datos reales: carga el mapa (una sola vez, compartido)
    void store.ensureMap()
  }, [])
  useEffect(() => {
    if (selected !== 'mod' || !gamePath || !window.electronAPI) return
    void window.electronAPI.listMods(gamePath).then(setMods)
  }, [selected, gamePath])

  const thumb = (t: TemplateId, w: number, h: number): string | null => {
    if (!map || !mapKey) return null
    try {
      return templateThumb(map, mapKey, t, game, w, h)
    } catch {
      return null // sin WebGL2 no hay miniatura: la tarjeta queda sin imagen
    }
  }
  const small = useMemo(
    () => Object.fromEntries(TEMPLATES.map((t) => [t.id, thumb(t.id, 160, 58)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, mapKey, game]
  )
  const big = useMemo(
    () => thumb(selected, 480, 174),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [map, mapKey, game, selected]
  )

  const accept = async (): Promise<void> => {
    const bad = validateProjectName(name)
    if (bad) return setError(bad)
    if (selected === 'mod' && !mod) return setError('Elige el mod que usarás como base del mapa.')
    setBusy(true)
    setError(null)
    const project = emptyProjectFor(name.trim(), selected, mod)
    const api = window.electronAPI
    let path: string | null = null
    if (api) {
      const r = await api.createProject(folder, name.trim(), JSON.stringify(project, null, 2))
      if (!r.ok) {
        setBusy(false)
        return setError(r.error)
      }
      path = r.path
    }
    store.set({ newProjectDialog: null })
    store.openInNewTab(project, path, info.opensIn)
    if (path) void rememberRecent(project, path)
    if (mod) store.toast(`Tu mod necesitará "${mod.name}" activado y cargado antes`)
  }
  const close = (): void => store.set({ newProjectDialog: null })

  return (
    <Modal
      title="Nuevo proyecto"
      width={980}
      onClose={() => !busy && close()}
      footer={
        <>
          <button className="btn" disabled={busy} onClick={close}>
            Cancelar
          </button>
          <button
            className="btn-primary disabled:opacity-40"
            disabled={busy || !!validateProjectName(name)}
            title={validateProjectName(name) ?? undefined}
            onClick={() => void accept()}
          >
            Aceptar
          </button>
        </>
      }
    >
      <div className="flex gap-4">
        {/* Izquierda: categorías y tarjetas */}
        <div className="flex w-[340px] shrink-0 flex-col">
          <div className="mb-2 flex border-b border-hoi-border">
            {CATEGORIES.map(([id, label]) => (
              <button
                key={id}
                onClick={() => {
                  setCategory(id)
                  const first = TEMPLATES.find((t) => t.category === id)
                  if (first && templateInfo(selected).category !== id) setSelected(first.id)
                }}
                className={`px-3 py-1.5 text-sm ${category === id ? 'border-b-2 border-hoi-accent text-hoi-accent' : 'text-hoi-muted hover:text-hoi-text'}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="flex max-h-[330px] flex-col gap-2 overflow-y-auto pr-1">
            {TEMPLATES.filter((t) => t.category === category).map((t) => (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                className={`flex gap-3 rounded border-2 p-2 text-left ${selected === t.id ? 'border-hoi-accent bg-hoi-accent/10' : 'border-hoi-border hover:border-hoi-muted'}`}
              >
                <div className="flex h-[58px] w-[160px] shrink-0 items-center justify-center overflow-hidden rounded bg-[#446BA3]">
                  {small[t.id] ? (
                    <img src={small[t.id]!} alt="" className="h-full w-full object-contain" />
                  ) : (
                    <span className="text-[10px] text-white/70">
                      {loading ? `${loading.pct} %` : '…'}
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-xs text-hoi-muted">{t.description}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Derecha: vista previa y detalles */}
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-[174px] items-center justify-center overflow-hidden rounded border border-hoi-border bg-[#446BA3]">
            {big ? (
              <img src={big} alt="" className="h-full w-full object-contain" />
            ) : loading ? (
              <div className="w-64 text-center text-xs text-white/80">
                {loading.message}
                <div className="mt-1 h-2 overflow-hidden rounded bg-black/30">
                  <div className="h-full bg-hoi-accent" style={{ width: `${loading.pct}%` }} />
                </div>
              </div>
            ) : (
              <span className="text-xs text-white/70">Sin vista previa</span>
            )}
          </div>
          <h3 className="mt-3 text-base font-semibold">{info.name}</h3>
          <ul className="mt-1 list-disc pl-5 text-sm text-hoi-muted">
            {info.details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
          {selected === 'mod' && (
            <div className="mt-2">
              <div className="rounded border border-hoi-border">
                {mods === null && <p className="p-2 text-xs text-hoi-muted">Buscando mods…</p>}
                {mods?.length === 0 && (
                  <p className="p-2 text-xs text-hoi-muted">
                    No se encontraron mods instalados (Documentos/Paradox Interactive/Hearts of Iron
                    IV/mod o el Workshop).
                  </p>
                )}
                <div className="max-h-28 overflow-y-auto">
                  {(mods ?? []).map((m) => (
                    <button
                      key={m.path}
                      onClick={() =>
                        setMod({ path: m.path, name: m.name, replacePaths: m.replacePaths })
                      }
                      className={`flex w-full flex-col px-2 py-1 text-left text-xs hover:bg-hoi-card ${mod?.path === m.path ? 'bg-hoi-accent/20' : ''}`}
                      title={m.path}
                    >
                      <span className="font-medium">{m.name}</span>
                      <span className="text-[10px] text-hoi-muted">
                        {m.source === 'workshop' ? 'Workshop' : 'Documentos'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
              {mod && (
                <p className="mt-1 rounded bg-yellow-500/15 p-2 text-[11px] text-yellow-200">
                  ⚠ Mod base: "{mod.name}". Tu mod necesitará "{mod.name}" activado y cargado antes
                  (dependencia).
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Abajo: nombre y carpeta */}
      <div className="mt-4 grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 border-t border-hoi-border pt-3">
        <label className="text-sm">Nombre del proyecto</label>
        <input
          className="input"
          autoFocus
          value={name}
          placeholder="Mi mod de México"
          onChange={(e) => setName(e.target.value)}
        />
        {name.length > 0 && validateProjectName(name) && (
          <p className="col-span-2 text-xs text-red-400">{validateProjectName(name)}</p>
        )}
        <label className="text-sm">Carpeta</label>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            value={folder}
            onChange={(e) => setFolder(e.target.value)}
          />
          <button
            className="btn"
            onClick={async () => {
              const d = await window.electronAPI?.selectFolder()
              if (d) setFolder(d)
            }}
          >
            Elegir…
          </button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </Modal>
  )
}
