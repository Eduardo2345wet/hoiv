// "Base del mapa": punto de partida (lienzo en blanco, mapa del juego o mapa de un mod).
// Se pregunta UNA vez al abrir el mapa por primera vez; se puede cambiar después
// (los estados pintados se conservan).
import { useEffect, useState } from 'react'
import type { MapBaseKind, MapModRef, MapSettings, Project } from '../../types'
import { store, useApp } from '../../store/appStore'
import Modal from '../Modal'

interface InstalledMod extends MapModRef {
  source: 'documentos' | 'workshop'
  hasMap: boolean
  hasStates: boolean
}

interface Props {
  project: Project
  onClose: () => void
}

export function setMapSettings(patch: Partial<MapSettings>): void {
  store.updateProject((p) => ({ ...p, mapSettings: { ...p.mapSettings, ...patch } }))
}

export default function MapBaseDialog({ project, onClose }: Props): JSX.Element {
  const gamePath = useApp((s) => s.gamePath)
  const ms = project.mapSettings
  const [base, setBase] = useState<MapBaseKind>(ms.base ?? 'blank')
  const [mod, setMod] = useState<MapModRef | null>(ms.mod)
  const [mods, setMods] = useState<InstalledMod[] | null>(null)
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!gamePath || !window.electronAPI) return setMods([])
    void window.electronAPI.listMods(gamePath).then(setMods)
  }, [gamePath])

  const apply = (): void => {
    setMapSettings({ base, mod: base === 'mod' ? mod : null })
    if (base === 'mod' && mod)
      store.toast(`Tu mod necesitará "${mod.name}" activado y cargado antes`)
    onClose()
    void store.ensureMap()
  }

  const card = (
    k: MapBaseKind,
    title: string,
    desc: string,
    extra?: JSX.Element,
    disabled = false
  ): JSX.Element => (
    <div
      onClick={() => !disabled && setBase(k)}
      className={`flex flex-1 cursor-pointer flex-col gap-2 rounded-lg border-2 p-4 ${
        disabled ? 'cursor-not-allowed opacity-50' : ''
      } ${base === k ? 'border-hoi-accent bg-hoi-accent/10' : 'border-hoi-border hover:border-hoi-muted'}`}
    >
      <div className="text-base font-semibold">{title}</div>
      <p className="text-xs text-hoi-muted">{desc}</p>
      {extra}
    </div>
  )

  const filtered = (mods ?? []).filter((m) => m.name.toLowerCase().includes(query.toLowerCase()))
  return (
    <Modal
      title="Base del mapa"
      width={940}
      onClose={() => {
        // Si nunca eligió, se queda con el mapa del juego y ya no se vuelve a preguntar
        if (!ms.base) setMapSettings({ base: 'game' })
        onClose()
      }}
      footer={
        <>
          <span className="mr-auto text-xs text-hoi-muted">
            Puedes cambiarla después con el botón "Base del mapa"; tus estados pintados se
            conservan.
          </span>
          <button
            className="btn-primary disabled:opacity-40"
            disabled={base === 'mod' && !mod}
            onClick={apply}
          >
            Usar esta base
          </button>
        </>
      }
    >
      <div className="flex gap-3">
        {card(
          'blank',
          '⬜ Lienzo en blanco',
          'Los estados sin pintar se ven en blanco y solo ves en color lo que pintes. Ideal para empezar un mundo desde cero.'
        )}
        {card(
          'game',
          '🌍 Mapa del juego',
          gamePath
            ? 'Todos los países del juego con sus colores reales. Pintas encima de la situación de 1936.'
            : 'Sin carpeta del juego se usa el mapa de demostración.'
        )}
        {card(
          'mod',
          '🧩 Mapa de un mod',
          'Usa el mapa y los estados de otro mod instalado (se cargan encima del juego). Tu mod dependerá de él.',
          base === 'mod' ? (
            <div className="mt-1 flex flex-col gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                className="input text-xs"
                placeholder="Buscar mod…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <div className="max-h-48 overflow-y-auto rounded border border-hoi-border">
                {mods === null && <p className="p-2 text-xs text-hoi-muted">Buscando mods…</p>}
                {mods?.length === 0 && (
                  <p className="p-2 text-xs text-hoi-muted">
                    No se encontraron mods en Documentos/Paradox Interactive/Hearts of Iron IV/mod
                    ni en el Workshop.
                  </p>
                )}
                {filtered.map((m) => (
                  <button
                    key={m.path}
                    onClick={() =>
                      setMod({ path: m.path, name: m.name, replacePaths: m.replacePaths })
                    }
                    className={`flex w-full flex-col px-2 py-1 text-left text-xs hover:bg-hoi-card ${
                      mod?.path === m.path ? 'bg-hoi-accent/20' : ''
                    }`}
                    title={m.path}
                  >
                    <span className="font-medium">{m.name}</span>
                    <span className="text-[10px] text-hoi-muted">
                      {m.source === 'workshop' ? 'Workshop' : 'Documentos'} ·{' '}
                      {m.hasMap ? 'mapa propio' : 'mapa del juego'} ·{' '}
                      {m.hasStates ? 'estados propios' : 'estados del juego'}
                    </span>
                  </button>
                ))}
              </div>
              {mod && (
                <p className="rounded bg-yellow-500/15 p-2 text-[11px] text-yellow-200">
                  ⚠ Tu mod necesitará "{mod.name}" activado y cargado antes.
                </p>
              )}
            </div>
          ) : undefined,
          !gamePath
        )}
      </div>
    </Modal>
  )
}
