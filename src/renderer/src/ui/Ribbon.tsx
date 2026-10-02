// Cinta de opciones tipo Siemens NX: menú Archivo, pestañas y grupos de herramientas con el
// título abajo. Sin proyecto abierto todo se ve pero está en gris (menos Archivo).
import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Box,
  Brush,
  Copy,
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
import { SECTIONS, screenOf } from '../sections/ui'

const sectionHas = (id: string, action: string): boolean => {
  const s = screenOf(id)
  if (!s) return false
  if (action === 'create') return !!s.create
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
      } ${active ? 'bg-hoi-accent text-black' : 'text-hoi-text hover:bg-hoi-card'}`}
    >
      {icon}
      <span className={small ? '' : 'max-w-[84px] text-center leading-tight'}>{label}</span>
    </button>
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
  const sectionTab = (def: (typeof SECTIONS)[number]): JSX.Element => (
    <>
      {def.groups.map((g) => (
        <Group key={g.title} title={g.title}>
          {g.actions.map((a) => (
            <RBtn
              key={a.id}
              icon={g.title === 'Crear' ? <Plus size={20} /> : <FileCheck size={20} />}
              label={g.title === 'Crear' ? def.createLabel : a.label}
              disabled={off || (a.id !== 'validate' && !sectionHas(def.id, a.id))}
              title={
                sectionHas(def.id, a.id) || a.id === 'validate'
                  ? undefined
                  : 'Disponible cuando se construya esta sección'
              }
              onClick={() =>
                runCommand(a.id === 'validate' ? 'validate' : `section:${def.id}:${a.id}`)
              }
            />
          ))}
        </Group>
      ))}
    </>
  )
  const content: Record<RibbonId, JSX.Element> = {
    eventos: sectionTab(SECTIONS[0]),
    supereventos: sectionTab(SECTIONS[1]),
    decisiones: sectionTab(SECTIONS[2]),
    personajes: sectionTab(SECTIONS[3]),
    ejercito: sectionTab(SECTIONS[4]),
    tecnologias: sectionTab(SECTIONS[5]),
    extras: sectionTab(SECTIONS[6]),
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
    ideas: (
      <>
        <Group title="Espíritus">
          <RBtn
            icon={<Plus size={20} />}
            label="Nuevo espíritu"
            disabled={off}
            onClick={() => runCommand('ideaNew')}
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
            className={`rounded-t px-3 py-1.5 text-sm font-semibold ${menu ? 'bg-hoi-accent text-black' : 'bg-hoi-accent/90 text-black hover:bg-hoi-accent'}`}
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
        {RIBBON_TABS.map(([id, label]) => (
          <button
            key={id}
            onClick={() => (on ? store.setUi({ ribbon: id }) : setPreview(id))}
            className={`px-3 py-1.5 text-sm ${tab === id ? 'border-b-2 border-hoi-accent text-hoi-accent' : 'text-hoi-muted hover:text-hoi-text'}`}
          >
            {label}
          </button>
        ))}
        <div className="flex-1" />
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
        <span className="px-3 text-xs font-semibold text-hoi-accent">HOI4 Mod Studio</span>
      </div>
      <div className="flex min-h-[84px] items-stretch overflow-x-auto px-1 py-1">
        {content[tab]}
      </div>
    </div>
  )
}
