// Cinta de opciones tipo Siemens NX: menú Archivo, pestañas y grupos de herramientas con el
// título abajo. Sin proyecto abierto todo se ve pero está en gris (menos Archivo).
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  Box,
  Brush,
  Copy,
  ChevronDown,
  Download,
  FilePlus,
  FolderOpen,
  GitBranch,
  FileCheck,
  Image as ImageIcon,
  LayoutGrid,
  Maximize,
  Plus,
  Redo2,
  RefreshCw,
  Save,
  Search,
  Settings,
  Slash,
  UserPlus,
  Undo2,
  ZoomIn,
  ZoomOut
} from 'lucide-react'
import { store, useApp, type RibbonId } from '../store/appStore'
import { DEFAULT_TREE_SETTINGS } from '../types'
import { VIEW_MODES, type ViewMode } from '../map/colors'
import { LABEL_MODES, type LabelMode } from '../map/labelLayout'
import { TOOLS } from './map/MapTab'
import { noNationActive } from '../map/noNation'
import { runCommand } from './commands'
import { sectionById, screenOf, type SectionDef } from '../sections/ui'

const sectionHas = (id: string, action: string): boolean => {
  const s = screenOf(id)
  if (!s) return false
  if (action === 'create') return !!s.create || !!s.newSpec
  if (action === 'duplicate') return !!s.duplicate
  if (action === 'delete') return !!s.remove
  if (action === 'preview') return !!s.renderOverview
  return false
}
import FileMenu from './FileMenu'
import { Z } from './layers'

export const RIBBON_TABS: [RibbonId, string][] = [
  ['inicio', 'Inicio'],
  ['mapa', 'Mapa'],
  ['focos', 'Focos'],
  ['paises', 'Países'],
  ['ideologias', 'Ideologías'],
  ['ideas', 'Espíritus'],
  ['eventos', 'Eventos'],
  ['supereventos', 'Súper eventos'],
  ['decisiones', 'Decisiones'],
  ['personajes', 'Personajes'],
  ['ejercito', 'Ejército'],
  ['tecnologias', 'Tecnologías'],
  ['iconos', 'Íconos'],
  ['extras', 'Extras'],
  ['exportar', 'Exportar']
]

/** Botón grande (ícono + texto) o pequeño de la cinta */
export function RBtn({
  icon,
  label,
  onClick,
  disabled,
  active,
  small,
  title
}: {
  icon: ReactNode
  label: string
  onClick?: () => void
  disabled?: boolean
  active?: boolean
  small?: boolean
  title?: string
}): JSX.Element {
  return (
    <button
      title={title ?? label}
      disabled={disabled}
      onClick={onClick}
      className={`flex items-center rounded text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-35 ${
        small ? 'flex-row gap-1.5 px-2 py-1' : 'min-w-[56px] flex-col gap-1 px-2 py-1.5'
      } ${active ? 'bg-hoi-card text-hoi-text ring-1 ring-hoi-accent' : 'text-hoi-text hover:bg-hoi-card'}`}
    >
      {icon}
      <span className={small ? '' : 'max-w-[84px] text-center leading-tight'}>{label}</span>
    </button>
  )
}

const TAB_CLASS = (selected: boolean): string =>
  `shrink-0 whitespace-nowrap px-2 py-1.5 text-sm ${selected ? 'border-b-2 border-hoi-accent text-hoi-text' : 'text-hoi-muted hover:text-hoi-text'}`

/**
 * Pestañas de la cinta en UNA línea: las que no caben van a un menú "Más" (la pestaña activa
 * siempre queda a la vista).
 */
function TabStrip({
  tabs,
  active,
  onPick
}: {
  tabs: [RibbonId, string][]
  active: RibbonId
  onPick: (id: RibbonId) => void
}): JSX.Element {
  const wrap = useRef<HTMLDivElement>(null)
  const meter = useRef<HTMLDivElement>(null)
  const [fit, setFit] = useState(tabs.length)
  const [open, setOpen] = useState(false)
  useLayoutEffect(() => {
    const calc = (): void => {
      const w = wrap.current?.clientWidth ?? 0
      const kids = meter.current ? [...meter.current.children] : []
      if (!w || kids.length < tabs.length + 1) return
      const widths = kids.map((k) => (k as HTMLElement).offsetWidth)
      const more = widths[tabs.length]
      const total = widths.slice(0, tabs.length).reduce((a, b) => a + b, 0)
      if (total <= w) return setFit(tabs.length)
      let used = more
      let n = 0
      for (let i = 0; i < tabs.length; i++) {
        used += widths[i]
        if (used > w) break
        n++
      }
      setFit(Math.max(1, n))
    }
    calc()
    const ro = new ResizeObserver(calc)
    if (wrap.current) ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [tabs])
  useEffect(() => {
    if (!open) return
    const close = (): void => setOpen(false)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [open])
  let shown = tabs.slice(0, fit)
  // La pestaña activa nunca se esconde: toma el lugar de la última visible
  if (fit < tabs.length && !shown.some(([id]) => id === active)) {
    const cur = tabs.find(([id]) => id === active)
    if (cur) shown = [...shown.slice(0, Math.max(0, fit - 1)), cur]
  }
  const rest = tabs.filter(([id]) => !shown.some(([s]) => s === id))
  return (
    <div ref={wrap} className="relative flex min-w-0 flex-1 items-center overflow-visible">
      {/* Medidor invisible con todas las pestañas y el botón "Más" */}
      <div
        ref={meter}
        aria-hidden
        className="pointer-events-none invisible absolute left-0 top-0 flex h-0 overflow-hidden"
      >
        {tabs.map(([id, label]) => (
          <span key={id} className={TAB_CLASS(false)}>
            {label}
          </span>
        ))}
        <span className={TAB_CLASS(false)}>Más</span>
      </div>
      {shown.map(([id, label]) => (
        <button key={id} onClick={() => onPick(id)} className={TAB_CLASS(active === id)}>
          {label}
        </button>
      ))}
      {rest.length > 0 && (
        <div className="relative shrink-0">
          <button
            className={`${TAB_CLASS(false)} flex items-center gap-1`}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={() => setOpen((o) => !o)}
          >
            Más <ChevronDown size={12} />
          </button>
          {open && (
            <div
              className="absolute left-0 top-full z-50 min-w-[160px] rounded border border-hoi-border bg-hoi-panel py-1 shadow-lg"
              onPointerDown={(e) => e.stopPropagation()}
            >
              {rest.map(([id, label]) => (
                <button
                  key={id}
                  className="block w-full whitespace-nowrap px-3 py-1.5 text-left text-sm text-hoi-text hover:bg-hoi-card"
                  onClick={() => {
                    setOpen(false)
                    onPick(id)
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }): JSX.Element {
  return (
    <div className="flex flex-col border-r border-hoi-border px-2 last:border-r-0">
      <div className="flex min-h-[64px] flex-1 items-center gap-0.5">{children}</div>
      <div className="pb-0.5 text-center text-[10px] uppercase tracking-wide text-hoi-muted">
        {title}
      </div>
    </div>
  )
}

const Col = ({ children }: { children: ReactNode }): JSX.Element => (
  <div className="flex flex-col justify-center">{children}</div>
)

export default function Ribbon(): JSX.Element {
  const project = useApp((s) => s.project)
  const ui = useApp((s) => s.ui)
  const canUndo = useApp((s) => s.past.length > 0)
  const canRedo = useApp((s) => s.future.length > 0)
  const activeTag = useApp((s) => s.activeTag)
  const pendingView = useApp((s) => s.pendingView)
  const [menu, setMenu] = useState(false)
  const [preview, setPreview] = useState<RibbonId>('mapa')
  const on = !!project
  const tab: RibbonId = on ? ui.ribbon : preview
  const off = !on
  const sectionSel = useApp((s) => s.sectionSel)
  const noNation = project ? noNationActive(project) : false
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent): void => {
      const t = e.target as Element
      if (!menuRef.current?.contains(t) && !t.closest?.('[data-menu]')) setMenu(false)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [menu])

  const chk = (
    label: string,
    value: boolean,
    set: (v: boolean) => void,
    title?: string
  ): JSX.Element => (
    <label className="flex items-center gap-1 px-1 text-xs" title={title}>
      <input
        type="checkbox"
        disabled={off}
        checked={value}
        onChange={(e) => set(e.target.checked)}
      />
      {label}
    </label>
  )
  const sel = (
    value: string,
    set: (v: string) => void,
    options: [string, string][]
  ): JSX.Element => (
    <select
      disabled={off}
      className="rounded border border-hoi-border bg-hoi-card px-1 py-0.5 text-xs disabled:opacity-40"
      value={value}
      onChange={(e) => set(e.target.value)}
    >
      {options.map(([v, l]) => (
        <option key={v} value={v}>
          {l}
        </option>
      ))}
    </select>
  )

  const history = (
    <Group title="Historial">
      <RBtn
        icon={<Undo2 size={20} />}
        label="Deshacer"
        disabled={off || !canUndo}
        onClick={() => store.undo()}
        title="Deshacer (Ctrl+Z)"
      />
      <RBtn
        icon={<Redo2 size={20} />}
        label="Rehacer"
        disabled={off || !canRedo}
        onClick={() => store.redo()}
        title="Rehacer (Ctrl+Y)"
      />
    </Group>
  )

  // Pestañas de las secciones nuevas: mismos grupos (Crear · Editar · Ver · Probar) en todas
  const sectionTab = (def: SectionDef): JSX.Element => (
    <>
      {def.groups
        .map((g) => ({
          ...g,
          // Si la función no existe en esta sección, el botón no se muestra
          actions: g.actions.filter((a) => a.id === 'validate' || sectionHas(def.id, a.id))
        }))
        .filter((g) => g.actions.length)
        .map((g) => (
          <Group key={g.title} title={g.title}>
            {g.actions.map((a) => {
              const needsSel = a.id === 'duplicate' || a.id === 'delete'
              const why = off
                ? 'Abre un proyecto primero'
                : needsSel && !sectionSel
                  ? 'Elige un elemento de la lista'
                  : undefined
              return (
                <RBtn
                  key={a.id}
                  icon={g.title === 'Crear' ? <Plus size={20} /> : <FileCheck size={20} />}
                  label={g.title === 'Crear' ? def.createLabel : a.label}
                  disabled={!!why}
                  title={why}
                  onClick={() =>
                    runCommand(a.id === 'validate' ? 'validate' : `section:${def.id}:${a.id}`)
                  }
                />
              )
            })}
          </Group>
        ))}
    </>
  )
  const content: Record<RibbonId, JSX.Element> = {
    ideologias: sectionTab(sectionById('ideologias')!),
    ideas: sectionTab(sectionById('ideas')!),
    eventos: sectionTab(sectionById('eventos')!),
    supereventos: sectionTab(sectionById('supereventos')!),
    decisiones: sectionTab(sectionById('decisiones')!),
    personajes: sectionTab(sectionById('personajes')!),
    ejercito: sectionTab(sectionById('ejercito')!),
    tecnologias: sectionTab(sectionById('tecnologias')!),
    extras: sectionTab(sectionById('extras')!),
    inicio: (
      <>
        <Group title="Proyecto">
          <RBtn
            icon={<FilePlus size={20} />}
            label="Nuevo"
            onClick={() => store.set({ newProjectDialog: { name: '' } })}
            title="Nuevo proyecto (Ctrl+N)"
          />
          <RBtn
            icon={<FolderOpen size={20} />}
            label="Abrir"
            onClick={() => runCommand('fileOpen')}
            title="Abrir (Ctrl+O)"
          />
          <RBtn
            icon={<Save size={20} />}
            label="Guardar"
            disabled={off}
            onClick={() => runCommand('fileSave')}
            title="Guardar (Ctrl+S)"
          />
        </Group>
        {history}
        <Group title="Aplicación">
          <RBtn
            icon={<Settings size={20} />}
            label="Ajustes"
            onClick={() => store.set({ settingsDialog: true })}
          />
        </Group>
      </>
    ),
    mapa: (
      <>
        <Group title="Herramientas">
          {TOOLS.map((t) => (
            <RBtn
              key={t.id}
              icon={t.icon}
              label={t.label.split(' (')[0]}
              disabled={off}
              active={on && ui.tool === t.id}
              title={`${t.label} (${t.key})`}
              onClick={() => store.setUi({ tool: t.id })}
            />
          ))}
          {ui.tool === 'brush' && (
            <Col>
              {chk('Dar core al pintar', ui.brushOpts.giveCore, (v) =>
                store.setUi({ brushOpts: { ...ui.brushOpts, giveCore: v } })
              )}
              {chk('Quitar cores del dueño anterior', ui.brushOpts.removePreviousCores, (v) =>
                store.setUi({ brushOpts: { ...ui.brushOpts, removePreviousCores: v } })
              )}
            </Col>
          )}
        </Group>
        <Group title="Vista">
          <RBtn
            icon={<ZoomIn size={20} />}
            label="Zoom +"
            disabled={off}
            onClick={() => runCommand('mapZoomIn')}
            title="Acercar (+)"
          />
          <RBtn
            icon={<ZoomOut size={20} />}
            label="Zoom −"
            disabled={off}
            onClick={() => runCommand('mapZoomOut')}
            title="Alejar (-)"
          />
          <RBtn
            icon={<Maximize size={20} />}
            label="Ajustar"
            disabled={off}
            onClick={() => runCommand('mapFit')}
            title="Ajustar al mapa (F)"
          />
          <Col>
            {sel(
              ui.mapMode,
              (v) => store.setUi({ mapMode: v as ViewMode }),
              VIEW_MODES.map(([m, l]) => [m, `Vista: ${l}`])
            )}
          </Col>
        </Group>
        <Group title="Etiquetas">
          <Col>
            {sel(
              ui.labels,
              (v) => store.setUi({ labels: v as LabelMode }),
              LABEL_MODES.map(([m, l]) => [m, `Etiquetas: ${l}`])
            )}
            {chk(
              'Capitales',
              ui.capitals,
              (v) => store.setUi({ capitals: v }),
              'Nombre del país con ★ en su capital'
            )}
            {chk('Fronteras de provincia', ui.provinceBorders, (v) =>
              store.setUi({ provinceBorders: v })
            )}
            {chk(
              'Colores como en el juego',
              ui.gameColors,
              (v) => store.setUi({ gameColors: v }),
              'Saturación ×0.6 y valor ×0.8'
            )}
          </Col>
        </Group>
        <Group title="Mapa">
          {noNation && (
            <RBtn
              icon={<Box size={20} />}
              label="Sin nación"
              disabled={off}
              onClick={() => runCommand('mapNoNation')}
              title="Nombre, tag y cores del país técnico"
            />
          )}
          {noNation && (
            <RBtn
              icon={<Brush size={20} />}
              label="Ver pendientes"
              disabled={off}
              active={pendingView}
              onClick={() => store.set({ pendingView: !pendingView })}
            />
          )}
          <RBtn
            icon={<ImageIcon size={20} />}
            label="Exportar imagen PNG"
            disabled={off}
            onClick={() => runCommand('mapExportPng')}
          />
          <RBtn
            icon={<Copy size={20} />}
            label="Nuevo proyecto con otra plantilla…"
            disabled={off}
            onClick={() =>
              project && store.set({ newProjectDialog: { name: `${project.modName} (2)` } })
            }
            title="Abre una PESTAÑA nueva; nunca copia los estados pintados"
          />
          <RBtn
            icon={<RefreshCw size={20} />}
            label="Recargar mapa"
            disabled={off}
            onClick={() => runCommand('mapReload')}
          />
        </Group>
      </>
    ),
    focos: (
      <>
        <Group title="Árbol">
          <RBtn
            icon={<Plus size={20} />}
            label="Añadir foco"
            disabled={off}
            onClick={() => runCommand('focusAdd')}
          />
          <RBtn
            icon={<LayoutGrid size={20} />}
            label="Ordenar árbol"
            disabled={off}
            onClick={() => runCommand('focusArrange')}
            title="Ordena el árbol por capas, como en el juego (un paso de deshacer)"
          />
          <RBtn
            icon={<LayoutGrid size={20} />}
            label="Orden automático"
            disabled={off}
            active={on && project?.treeSettings?.autoArrange !== false}
            onClick={() =>
              store.updateProject((p) => ({
                ...p,
                treeSettings: {
                  ...DEFAULT_TREE_SETTINGS,
                  ...p.treeSettings,
                  autoArrange: p.treeSettings?.autoArrange === false
                }
              }))
            }
            title="Ordenar automáticamente al crear y conectar focos"
          />
        </Group>
        <Group title="Herramientas">
          <RBtn
            icon={<GitBranch size={20} />}
            label="Mover"
            disabled={off}
            active={on && ui.focusTool === 'select'}
            onClick={() => store.setUi({ focusTool: 'select' })}
            title="Seleccionar y arrastrar focos"
          />
          <RBtn
            icon={<GitBranch size={20} />}
            label="Prerrequisito"
            disabled={off}
            active={on && ui.focusTool === 'prereq'}
            onClick={() => store.setUi({ focusTool: 'prereq' })}
            title="Conectar: padre → hijo (línea normal)"
          />
          <RBtn
            icon={<Slash size={20} />}
            label="Excluyente"
            disabled={off}
            active={on && ui.focusTool === 'exclusive'}
            onClick={() => store.setUi({ focusTool: 'exclusive' })}
            title="Conectar focos mutuamente excluyentes (línea roja)"
          />
        </Group>
      </>
    ),
    paises: (
      <>
        <Group title="Países">
          <RBtn
            icon={<UserPlus size={20} />}
            label="Crear país"
            disabled={off}
            onClick={() => runCommand('countryNew')}
          />
          <RBtn
            icon={<Plus size={20} />}
            label="País rápido"
            disabled={off}
            onClick={() => runCommand('countryQuick')}
            title="Solo nombre y color"
          />
        </Group>
      </>
    ),
    iconos: (
      <>
        <Group title="Biblioteca">
          <RBtn
            icon={<ImageIcon size={20} />}
            label="Ver íconos"
            disabled={off}
            onClick={() => store.setUi({ ribbon: 'iconos' })}
          />
        </Group>
      </>
    ),
    exportar: (
      <>
        <Group title="Mod">
          <RBtn
            icon={<Download size={20} />}
            label="Exportar mod…"
            disabled={off}
            onClick={() => runCommand('exportMod')}
          />
          <RBtn
            icon={<Search size={20} />}
            label="Revisar mod instalado"
            disabled={off}
            onClick={() => runCommand('reviewInstalled')}
          />
        </Group>
        <Group title="Mapa">
          <RBtn
            icon={<ImageIcon size={20} />}
            label="Imagen del mapa PNG"
            disabled={off}
            onClick={() => {
              store.setUi({ ribbon: 'mapa' })
              setTimeout(() => runCommand('mapExportPng'), 50)
            }}
          />
        </Group>
      </>
    )
  }
  void activeTag

  return (
    <div
      className="relative shrink-0 border-b border-hoi-border bg-hoi-panel"
      style={{ zIndex: Z.ribbon }}
    >
      <div className="flex items-center border-b border-hoi-border/60 px-1">
        <div className="relative" ref={menuRef}>
          <button
            className={`shrink-0 rounded-t px-3 py-1.5 text-sm font-medium ${menu ? 'bg-hoi-card text-hoi-text' : 'text-hoi-text hover:bg-hoi-card'}`}
            onClick={() => setMenu((m) => !m)}
          >
            Archivo
          </button>
          {menu && (
            <FileMenu
              onClose={() => setMenu(false)}
              anchor={menuRef.current?.getBoundingClientRect() ?? null}
            />
          )}
        </div>
        <TabStrip
          tabs={RIBBON_TABS}
          active={tab}
          onPick={(id) => (on ? store.setUi({ ribbon: id }) : setPreview(id))}
        />
        <button
          title="Deshacer (Ctrl+Z)"
          disabled={off || !canUndo}
          className="rounded p-1.5 hover:bg-hoi-card disabled:opacity-35"
          onClick={() => store.undo()}
        >
          <Undo2 size={16} />
        </button>
        <button
          title="Rehacer (Ctrl+Y)"
          disabled={off || !canRedo}
          className="rounded p-1.5 hover:bg-hoi-card disabled:opacity-35"
          onClick={() => store.redo()}
        >
          <Redo2 size={16} />
        </button>
        <span className="hidden shrink-0 px-3 text-xs 2xl:block text-hoi-muted">
          HOI4 Mod Studio
        </span>
      </div>
      <div className="flex min-h-[84px] items-stretch overflow-x-auto px-1 py-1">
        {content[tab]}
      </div>
    </div>
  )
}
