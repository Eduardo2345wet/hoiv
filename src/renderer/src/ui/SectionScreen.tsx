// Pantalla común de las secciones nuevas: lista con buscador a la izquierda, editor al centro y
// propiedades / vista previa del script a la derecha (plegable). Sin datos de ejemplo.
import { useEffect, useState } from 'react'
import { registerCommands } from './commands'
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
  const items = (screen?.items?.(project) ??
    project[def.collection] ??
    []) as unknown as Record<string, unknown>[]
  const labelOf = (i: Record<string, unknown>): string =>
    screen?.label?.(i) ?? String(i.name ?? i.title ?? i.id ?? i.country ?? i.code ?? '')
  const create = screen?.create
  const [view, setView] = useState<'editor' | 'overview'>('editor')
  // Comandos de la cinta (Editar): duplicar y borrar el elemento elegido
  useEffect(
    () =>
      registerCommands({
        [`section:${def.id}:create`]: () => doCreate(),
        [`section:${def.id}:duplicate`]: () => {
          const uid = selected && screen?.duplicate?.(selected)
          if (uid) setSelected(uid)
        },
        [`section:${def.id}:delete`]: () => {
          if (selected) {
            screen?.remove?.(selected)
            setSelected(null)
          }
        },
        [`section:${def.id}:preview`]: () =>
          setView((v) => (v === 'editor' ? 'overview' : 'editor'))
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [def.id, selected, screen]
  )
  const doCreate = (): void => {
    void Promise.resolve(create?.()).then((uid) => uid && setSelected(uid))
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
              {screen?.templates?.map((t) => (
                <button
                  key={t.id}
                  className="mt-1 w-full text-left text-xs text-hoi-muted underline hover:text-hoi-accent"
                  onClick={() => void Promise.resolve(t.create()).then((u) => u && setSelected(u))}
                >
                  + {t.label}
                </button>
              ))}
            </div>
          }
        />
      }
      center={
        view === 'overview' && screen?.renderOverview ? (
          <div>
            <div className="border-b border-hoi-border p-2 text-xs">
              <button className="btn px-2 py-0.5" onClick={() => setView('editor')}>
                ← Volver al editor
              </button>
            </div>
            {screen.renderOverview(project, selected, (u) => (setSelected(u), setView('editor')))}
          </div>
        ) : selected && screen?.renderEditor ? (
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
