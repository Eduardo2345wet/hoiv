// Pantalla común de las secciones nuevas: lista con buscador a la izquierda, editor al centro y
// propiedades / vista previa del script a la derecha (plegable). Sin datos de ejemplo.
import { useState } from 'react'
import type { Project } from '../types'
import { screenOf, type SectionDef } from '../sections/ui'
import { EmptyState, ListPanel, SplitPane } from './kit'

export default function SectionScreen({
  def,
  project
}: {
  def: SectionDef
  project: Project
}): JSX.Element {
  const screen = screenOf(def.id)
  const [selected, setSelected] = useState<string | null>(null)
  const items = (project[def.collection] ?? []) as unknown as Record<string, unknown>[]
  const labelOf = (i: Record<string, unknown>): string =>
    screen?.label?.(i) ?? String(i.name ?? i.title ?? i.id ?? i.country ?? i.code ?? '')
  const create = screen?.create
  const doCreate = (): void => {
    const uid = create?.()
    if (uid) setSelected(uid)
  }
  return (
    <SplitPane
      left={
        <ListPanel
          items={items as { uid?: string; id?: string }[]}
          label={(i) => labelOf(i as Record<string, unknown>)}
          selected={selected}
          onSelect={setSelected}
          header={
            <div className="border-b border-hoi-border p-2">
              <button
                className="btn-primary w-full justify-center disabled:opacity-40"
                disabled={!create}
                title={create ? undefined : 'Disponible cuando se construya esta sección'}
                onClick={doCreate}
              >
                {def.createLabel}
              </button>
            </div>
          }
        />
      }
      center={
        selected && screen?.renderEditor ? (
          screen.renderEditor(project, selected)
        ) : (
          <EmptyState
            text={def.empty}
            action={{
              label: def.createLabel,
              onClick: doCreate,
              disabled: !create,
              title: create ? undefined : 'Disponible cuando se construya esta sección'
            }}
          />
        )
      }
      right={
        screen?.renderPreview?.(project, selected) ?? (
          <p className="text-xs text-hoi-muted">
            La vista previa del script generado aparece aquí.
          </p>
        )
      }
    />
  )
}
