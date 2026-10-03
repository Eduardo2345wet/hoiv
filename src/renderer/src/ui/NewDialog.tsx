// Ventana corta "Nuevo …": nombre, grupo (existente o nuevo ahí mismo) y plantilla de la galería.
// Nunca pide un ID: se generan solos.
import { useMemo, useState } from 'react'
import type { Project } from '../types'
import type { NewSpec } from '../sections/ui'
import Modal from './Modal'
import Help from './Help'
import { TemplateGallery } from './SectionParts'

const NEW_GROUP = '__nuevo__'

export default function NewDialog({
  spec,
  project,
  initialTemplate,
  initialGroup,
  onCreated,
  onClose
}: {
  spec: NewSpec
  project: Project
  initialTemplate?: string
  /** Grupo preseleccionado (el que está abierto en la lista) */
  initialGroup?: string | null
  onCreated: (uid: string | null) => void
  onClose: () => void
}): JSX.Element {
  const existing = useMemo(() => spec.groups?.(project) ?? [], [spec, project])
  const [template, setTemplate] = useState(
    initialTemplate ?? spec.defaultTemplate ?? spec.templates[0]?.id ?? ''
  )
  const [name, setName] = useState('')
  const [group, setGroup] = useState<string>(
    initialGroup && existing.some((g) => g.id === initialGroup)
      ? initialGroup
      : (existing[0]?.id ?? (spec.newGroupLabel ? NEW_GROUP : ''))
  )
  const [newGroup, setNewGroup] = useState('')
  const [picked, setPicked] = useState<{ id: string; name: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const askGroup = !!spec.groupLabel && (spec.needsGroup ? spec.needsGroup(template) : true)
  const groupOk =
    !askGroup ||
    (group === NEW_GROUP ? newGroup.trim().length > 0 : group !== '' || !!picked) ||
    !!picked
  const ok = name.trim().length > 0 && groupOk && !busy
  const submit = async (): Promise<void> => {
    if (!ok) return
    setBusy(true)
    const uid = await spec.create({
      name: name.trim(),
      groupId: picked ? picked.id : group === NEW_GROUP || !askGroup ? null : group,
      newGroupName: group === NEW_GROUP && !picked ? newGroup.trim() : '',
      template
    })
    setBusy(false)
    onCreated(uid)
    onClose()
  }
  return (
    <Modal
      title={spec.title}
      width={620}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-primary disabled:opacity-40"
            disabled={!ok}
            onClick={() => void submit()}
          >
            Crear
          </button>
        </>
      }
    >
      <div
        className="space-y-4"
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.target as HTMLElement).tagName === 'INPUT') {
            e.preventDefault()
            void submit()
          }
        }}
      >
        <div>
          <label className="label">{spec.nameLabel ?? 'Nombre'}</label>
          <input
            autoFocus
            data-new-name
            className="input"
            placeholder={spec.namePlaceholder}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        {askGroup && (
          <div>
            <label className="label">
              {spec.groupLabel}
              {spec.groupHelp && <Help id={spec.groupHelp} />}
            </label>
            {picked ? (
              <div className="flex items-center gap-2 text-sm">
                <span>{picked.name}</span>
                <button
                  className="text-xs text-hoi-muted underline"
                  onClick={() => setPicked(null)}
                >
                  Cambiar
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  data-new-group
                  className="input w-auto min-w-[200px]"
                  value={group}
                  onChange={(e) => setGroup(e.target.value)}
                >
                  {existing.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                  {spec.newGroupLabel && <option value={NEW_GROUP}>{spec.newGroupLabel}</option>}
                  {!existing.length && !spec.newGroupLabel && <option value="">Elige uno…</option>}
                </select>
                {spec.pickGroup && (
                  <button
                    className="btn px-2 py-1 text-xs"
                    onClick={() => void spec.pickGroup!.pick().then((g) => g && setPicked(g))}
                  >
                    {spec.pickGroup.label}
                  </button>
                )}
              </div>
            )}
            {group === NEW_GROUP && !picked && (
              <input
                data-new-group-name
                className="input mt-2"
                placeholder="Nombre del grupo nuevo"
                value={newGroup}
                onChange={(e) => setNewGroup(e.target.value)}
              />
            )}
          </div>
        )}
        <div>
          <label className="label">Plantilla</label>
          <TemplateGallery
            templates={spec.templates}
            value={template}
            onChange={setTemplate}
            compact
          />
        </div>
      </div>
    </Modal>
  )
}
