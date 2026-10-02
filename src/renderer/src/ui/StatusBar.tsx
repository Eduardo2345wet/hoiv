// Barra de estado: la instrucción de la herramienta activa (como NX) y lo de siempre
// (mapa, plantilla, zoom, motor).
import { store, useApp } from '../store/appStore'
import { TOOLS } from './map/MapTab'
import { countryLabel, NO_NATION } from '../map/brush'
import { templateInfo, templateOf } from '../templates'

/** Frase de ayuda de cada herramienta del mapa */
export function toolHint(tool: string, countryName: string | null): string {
  const c = countryName ?? 'un país (elígelo en la Paleta)'
  switch (tool) {
    case 'brush':
      return `Haz clic en los estados para pintarlos con ${c}. Clic derecho borra.`
    case 'bucket':
      return `Haz clic para rellenar la región conectada con ${c}.`
    case 'capital':
      return 'Haz clic en un estado para fijar la capital del país activo.'
    case 'core':
      return 'Haz clic en un estado para agregar un core (Shift = quitar).'
    case 'eraser':
      return 'Haz clic en un estado para devolverlo a su dueño original.'
    case 'eyedropper':
      return 'Haz clic en un estado para tomar su país como pincel.'
    default:
      return 'Haz clic en un estado para ver sus datos.'
  }
}

export default function StatusBar(): JSX.Element {
  const project = useApp((s) => s.project)
  const ui = useApp((s) => s.ui)
  const activeTag = useApp((s) => s.activeTag)
  const status = useApp((s) => s.mapStatus)
  const mapKey = useApp((s) => s.mapKey)
  const game = useApp(() => store.catalogGame())
  const hasGame = useApp((s) => !!s.gamePath)
  const pick = useApp((s) => s.pick)
  const focusHint = useApp((s) => s.focusHint)
  const filePath = useApp((s) => s.filePath)

  let hint = project ? 'Listo.' : 'Crea o abre un proyecto para empezar.'
  if (project && pick) hint = 'Haz clic en el elemento que necesitas · Esc para cancelar.'
  else if (project && ui.ribbon === 'mapa') {
    const name =
      activeTag && activeTag !== NO_NATION ? countryLabel(activeTag, project, game) : null
    hint = toolHint(ui.tool, name)
  } else if (project && ui.ribbon === 'focos')
    hint = focusHint
      ? focusHint
      : ui.focusTool === 'select'
        ? 'Doble clic en el lienzo para añadir un foco; arrastra para moverlo.'
        : 'Haz clic en el foco de origen y luego en el de destino.'
  void TOOLS

  const mapLabel = !mapKey
    ? '—'
    : mapKey === 'demo'
      ? hasGame
        ? 'Mapa: demostración'
        : 'Mapa: demostración (sin HOI4)'
      : mapKey === 'game'
        ? 'Mapa: HOI4 real'
        : 'Mapa: HOI4 real + mod'
  return (
    <div className="flex shrink-0 items-center gap-4 border-t border-hoi-border bg-hoi-panel px-3 py-1 text-xs text-hoi-muted">
      <span className="truncate text-hoi-text">{hint}</span>
      <span className="flex-1 truncate">{project && ui.ribbon === 'mapa' ? status.hover : ''}</span>
      {project && (
        <span className="max-w-[320px] truncate" title={filePath ?? 'Sin guardar todavía'}>
          {filePath ?? 'Sin guardar'}
        </span>
      )}
      {project && (
        <span title="La plantilla se elige al crear el proyecto">
          Plantilla: {templateInfo(templateOf(project)).name}
        </span>
      )}
      <span>{mapLabel}</span>
      {project && ui.ribbon === 'mapa' && <span>Zoom {Math.round(status.zoom * 100)} %</span>}
      {project && ui.ribbon === 'mapa' && status.engine && (
        <span title="Motor de dibujo">{status.engine === 'webgl2' ? 'WebGL2' : 'Canvas 2D'}</span>
      )}
    </div>
  )
}
