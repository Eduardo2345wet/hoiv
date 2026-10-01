// Ajustes del mapa para el país técnico "Sin nación": nombre, tag y cores del juego
import { useState } from 'react'
import { Lock } from 'lucide-react'
import type { Project } from '../../types'
import { store, useApp } from '../../store/appStore'
import { getCatalogOptions } from '../../catalog/catalog'
import { validateTag } from '../../export/validator'
import { proposeNoNationTag } from '../../map/noNation'
import Modal from '../Modal'
import { setMapSettings } from '../../map/resetMap'

export default function NoNationSettings({
  project,
  onClose
}: {
  project: Project
  onClose: () => void
}): JSX.Element {
  const map = useApp((s) => s.map)
  const game = useApp(() => store.catalogGame())
  const nn = project.mapSettings.noNation
  const [name, setName] = useState(nn.name)
  const [tag, setTag] = useState(nn.tag)
  const [keep, setKeep] = useState(nn.keepGameCores)
  const taken = new Set([
    ...getCatalogOptions('country', null, game).map((o) => o.id),
    ...project.countries.filter((c) => !c.technical).map((c) => c.tag),
    ...(map?.states.map((s) => s.owner) ?? [])
  ])
  const error =
    validateTag(tag) ?? (taken.has(tag) ? `El tag ${tag} ya existe en el juego o en tu mod.` : null)

  return (
    <Modal
      title="Ajustes del mapa: Sin nación"
      width={480}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-primary disabled:opacity-40"
            disabled={!!error || !name.trim()}
            onClick={() => {
              setMapSettings({ noNation: { name: name.trim(), tag, keepGameCores: keep } })
              onClose()
            }}
          >
            Guardar
          </button>
        </>
      }
    >
      <p className="mb-3 flex items-start gap-2 text-xs text-hoi-muted">
        <Lock size={14} className="mt-0.5 shrink-0" />
        País TÉCNICO de relleno: es el dueño de todo lo que todavía no pintas. Gris, neutral, sin
        elecciones, sin árbol de focos ni espíritus. No es un país de lore.
      </p>
      <label className="label">Nombre</label>
      <input className="input mb-3" value={name} onChange={(e) => setName(e.target.value)} />
      <label className="label">Tag</label>
      <div className="mb-1 flex gap-2">
        <input
          className="input w-24 font-mono uppercase"
          maxLength={3}
          value={tag}
          onChange={(e) => setTag(e.target.value.toUpperCase())}
        />
        <button
          className="btn text-xs"
          onClick={() => setTag(proposeNoNationTag(project, game, map))}
        >
          Proponer uno libre
        </button>
      </div>
      {error && <p className="mb-2 text-xs text-red-400">{error}</p>}
      <label className="mt-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
        Conservar cores del juego en los estados pendientes
      </label>
    </Modal>
  )
}
