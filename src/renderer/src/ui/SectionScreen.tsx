// Esqueleto común de TODAS las secciones: lista por grupos a la izquierda, editor en tarjetas al
// centro y vista previa visual a la derecha ("Ver código" plegado al final). Sin datos de ejemplo.
import { useEffect, useMemo, useState } from 'react'
import { Plus } from 'lucide-react'
import { registerCommands } from './commands'
import { store, useApp } from '../store/appStore'
import type { Project } from '../types'
import { screenOf, type GroupNode, type SectionDef } from '../sections/ui'
import { SplitPane } from './kit'
import NewDialog from './NewDialog'
import { CodeView, GroupTree, TemplateGallery } from './SectionParts'

export default function SectionScreen({
  def,
  project
}: {
  def: SectionDef
  project: Project
}): JSX.Element {
  const screen = screenOf(def.id)
  const [selected, setSelected] = useState<string | null>(null)
  const [view, setView] = useState<'editor' | 'overview'>('editor')
  const [dialog, setDialog] = useState<{ template?: string } | null>(null)

  // Un espíritu recién copiado del juego se abre para editarlo
  const toSelect = useApp((st) => (def.id === 'ideas' ? st.ideaToSelect : null))
  useEffect(() => {
    if (!toSelect) return
    setSelected(toSelect)
    store.set({ ideaToSelect: null })
  }, [toSelect])

  const groups: GroupNode[] = useMemo(() => {
    if (screen?.groups) return screen.groups(project)
    const items = (screen?.items?.(project) ?? project[def.collection] ?? []) as unknown as Record<
      string,
      unknown
    >[]
    return [
      {
        id: '_',
        title: '',
        items: items.map((i) => ({
          uid: String(i.uid ?? i.id ?? ''),
          title:
            screen?.label?.(i) ?? String(i.name ?? i.title ?? i.id ?? i.country ?? i.code ?? ''),
          subtitle: undefined
        }))
      }
    ]
  }, [screen, project, def.collection])
  const total = groups.reduce((a, g) => a + g.items.length, 0)
  const spec = screen?.newSpec
  const create = screen?.create
  const canCreate = !!spec || !!create

  const doCreate = (template?: string): void => {
    if (spec) {
      if (template && spec.direct?.(template)) return
      return setDialog({ template })
    }
    void Promise.resolve(create?.()).then((uid) => uid && setSelected(uid))
  }

  useEffect(() => {
    store.set({ sectionSel: selected })
    return () => store.set({ sectionSel: null })
  }, [selected])

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

  const empty = total === 0 && !screen?.renderEditor?.length
  const center =
    view === 'overview' && screen?.renderOverview ? (
      <div>
        <div className="border-b border-hoi-border p-2 text-xs">
          <button className="btn px-2 py-0.5" onClick={() => setView('editor')}>
            Volver al editor
          </button>
        </div>
        {screen.renderOverview(project, selected, (u) => (setSelected(u), setView('editor')))}
      </div>
    ) : selected && screen?.renderEditor ? (
      screen.renderEditor(project, selected, (u) => setSelected(u))
    ) : (
      <div data-empty className="mx-auto flex max-w-2xl flex-col gap-5 p-8">
        <div>
          <h2 className="text-lg font-medium text-hoi-text">{def.label}</h2>
          <p className="mt-1 text-sm text-hoi-muted">{screen?.intro ?? def.empty}</p>
        </div>
        {spec && (total === 0 || !selected) && (
          <div>
            <div className="mb-2 text-xs text-hoi-muted">
              {total === 0 ? 'Empieza con una plantilla' : 'Crear a partir de una plantilla'}
            </div>
            <TemplateGallery templates={spec.templates} onPick={(id) => doCreate(id)} />
          </div>
        )}
        {canCreate && (
          <div>
            <button className="btn-primary" onClick={() => doCreate()}>
              {def.createLabel}
            </button>
          </div>
        )}
        {total > 0 && !selected && (
          <p className="text-xs text-hoi-muted">
            O elige algo de la lista de la izquierda para editarlo.
          </p>
        )}
      </div>
    )
  void empty

  const code = screen?.code?.(project, selected)
  const preview = selected ? screen?.renderPreview?.(project, selected) : null
  const hasRight = !!preview || !!code
  return (
    <>
      <SplitPane
        left={
          <GroupTree
            groups={groups}
            selected={selected}
            onSelect={(u) => {
              setSelected(u)
              setView('editor')
            }}
            header={
              <div className="border-b border-hoi-border p-2">
                {canCreate && (
                  <button
                    className="btn-primary w-full justify-center"
                    data-create
                    onClick={() => doCreate()}
                  >
                    <Plus size={14} /> {def.createLabel}
                  </button>
                )}
                {screen?.renderHeader?.(project)}
              </div>
            }
          />
        }
        center={center}
        right={
          hasRight ? (
            <div>
              {preview}
              <CodeView code={code} />
            </div>
          ) : (
            <p className="text-xs text-hoi-muted">Elige algo para ver cómo se verá.</p>
          )
        }
      />
      {dialog && spec && (
        <NewDialog
          spec={spec}
          project={project}
          initialTemplate={dialog.template}
          onCreated={(uid) => uid && setSelected(uid)}
          onClose={() => setDialog(null)}
        />
      )}
    </>
  )
}
