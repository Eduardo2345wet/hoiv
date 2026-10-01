// Navegador del proyecto (como el Assembly Navigator de NX): árbol plegable con los países,
// los árboles de focos, los espíritus y los íconos. En la vista Mapa la Paleta es una sección más.
import { useState, type ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Project } from '../types'
import { store, useApp } from '../store/appStore'
import { setBrush } from '../map/brush'
import { treeCountry } from '../countries/countryOps'
import FlagThumb from './FlagThumb'
import PalettePanel from './map/PalettePanel'

function Section({
  title,
  count,
  open,
  onToggle,
  children,
  grow
}: {
  title: string
  count?: number
  open: boolean
  onToggle: () => void
  children?: ReactNode
  grow?: boolean
}): JSX.Element {
  return (
    <div
      className={`flex min-h-0 flex-col border-b border-hoi-border ${grow && open ? 'flex-1' : ''}`}
    >
      <button
        onClick={onToggle}
        className="flex items-center gap-1 px-2 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-hoi-muted hover:text-hoi-text"
      >
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        {title}
        {count !== undefined && <span className="ml-auto font-normal">{count}</span>}
      </button>
      {open && children}
    </div>
  )
}

export default function Navigator({ project }: { project: Project }): JSX.Element {
  const ribbon = useApp((s) => s.ui.ribbon)
  const gameColors = useApp((s) => s.ui.gameColors)
  const activeTree = useApp((s) => s.activeTreeId)
  const activeTag = useApp((s) => s.activeTag)
  const [collapsed, setCollapsed] = useState(false)
  const [open, setOpen] = useState({
    paises: true,
    usados: true,
    arboles: true,
    ideas: false,
    iconos: false,
    paleta: true
  })
  const toggle = (k: keyof typeof open): void => setOpen({ ...open, [k]: !open[k] })

  if (collapsed)
    return (
      <div className="flex w-8 shrink-0 flex-col items-center border-r border-hoi-border bg-hoi-panel py-2">
        <button title="Mostrar el navegador" onClick={() => setCollapsed(false)}>
          <ChevronRight size={16} />
        </button>
        <span className="mt-4 rotate-180 text-xs text-hoi-muted [writing-mode:vertical-rl]">
          Navegador del proyecto
        </span>
      </div>
    )

  const row = (
    key: string,
    active: boolean,
    onClick: () => void,
    onDouble: (() => void) | null,
    children: ReactNode
  ): JSX.Element => (
    <div
      key={key}
      onClick={onClick}
      onDoubleClick={onDouble ?? undefined}
      className={`flex cursor-pointer items-center gap-2 truncate px-4 py-1 text-sm hover:bg-hoi-card ${active ? 'bg-hoi-accent/15 text-hoi-accent' : ''}`}
    >
      {children}
    </div>
  )

  return (
    <aside className="flex w-64 shrink-0 flex-col border-r border-hoi-border bg-hoi-panel">
      <div className="flex items-center justify-between border-b border-hoi-border px-3 py-1.5">
        <span className="text-sm font-semibold text-hoi-accent">Navegador del proyecto</span>
        <button title="Plegar" onClick={() => setCollapsed(true)}>
          <ChevronLeft size={16} />
        </button>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Section
          title="Países"
          count={project.countries.filter((c) => !c.technical && !c.light).length}
          open={open.paises}
          onToggle={() => toggle('paises')}
        >
          {project.countries.filter((c) => !c.light).length === 0 && (
            <p className="px-4 pb-2 text-xs text-hoi-muted">
              Aún no hay países. Crea uno con "País rápido" o el asistente.
            </p>
          )}
          {project.countries
            .filter((c) => !c.light)
            .map((c) =>
              row(
                c.uid,
                activeTag === c.tag,
                () => (ribbon === 'mapa' ? setBrush(c.tag) : store.setUi({ ribbon: 'paises' })),
                () => store.set({ wizardRequest: { uid: c.uid, n: Date.now() } }),
                <>
                  <FlagThumb country={c} height={14} />
                  <span className="truncate">{c.names.name}</span>
                  <span className="ml-auto font-mono text-[10px] text-hoi-muted">{c.tag}</span>
                </>
              )
            )}
        </Section>
        {project.countries.some((c) => c.light) && (
          <Section
            title="Países del juego usados"
            count={project.countries.filter((c) => c.light).length}
            open={open.usados}
            onToggle={() => toggle('usados')}
          >
            {project.countries
              .filter((c) => c.light)
              .map((c) =>
                row(
                  c.uid,
                  activeTag === c.tag,
                  () => (ribbon === 'mapa' ? setBrush(c.tag) : store.setUi({ ribbon: 'focos' })),
                  () => store.set({ wizardRequest: { uid: c.uid, n: Date.now() } }),
                  <>
                    <FlagThumb country={c} height={14} />
                    <span className="truncate">{c.names.name}</span>
                    <span className="ml-auto font-mono text-[10px] text-hoi-muted">{c.tag}</span>
                  </>
                )
              )}
          </Section>
        )}
        <Section
          title="Árboles de focos"
          count={project.focusTrees.length}
          open={open.arboles}
          onToggle={() => toggle('arboles')}
        >
          {project.focusTrees.length === 0 && (
            <p className="px-4 pb-2 text-xs text-hoi-muted">
              Ningún árbol todavía. Se pregunta el país al crear el primero.
            </p>
          )}
          {project.focusTrees.map((t) =>
            row(
              t.id,
              activeTree === t.id,
              () => {
                store.set({ activeTreeId: t.id, selectedUid: null })
                store.setUi({ ribbon: 'focos' })
              },
              null,
              <>
                <span className="truncate">{t.name}</span>
                <span className="ml-auto text-[10px] text-hoi-muted">
                  {treeCountry(project, t.id)?.tag ?? ''}
                </span>
              </>
            )
          )}
        </Section>
        <Section
          title="Espíritus nacionales"
          count={project.ideas.length}
          open={open.ideas}
          onToggle={() => toggle('ideas')}
        >
          {project.ideas.map((i) =>
            row(
              i.uid,
              false,
              () => store.setUi({ ribbon: 'ideas' }),
              null,
              <span className="truncate">{i.name}</span>
            )
          )}
        </Section>
        <Section
          title="Íconos"
          count={project.icons.length}
          open={open.iconos}
          onToggle={() => {
            toggle('iconos')
            store.setUi({ ribbon: 'iconos' })
          }}
        />
        {ribbon === 'mapa' && (
          <Section title="Paleta" open={open.paleta} onToggle={() => toggle('paleta')} grow>
            <PalettePanel
              embedded
              project={project}
              gameColors={gameColors}
              onOpenWizard={(uid, step) =>
                store.set({ wizardRequest: { uid, step, n: Date.now() } })
              }
            />
          </Section>
        )}
      </div>
    </aside>
  )
}
