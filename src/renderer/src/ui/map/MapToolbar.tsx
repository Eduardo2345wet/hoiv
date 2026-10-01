import React from 'react'
import {
  MousePointer2,
  Paintbrush,
  PaintBucket,
  Landmark,
  Shield,
  Eraser,
  Pipette,
  ZoomIn,
  ZoomOut,
  Maximize,
  Undo2,
  Redo2
} from 'lucide-react'

export type MapTool =
  | 'select'
  | 'brush'
  | 'bucket'
  | 'capital'
  | 'core'
  | 'eraser'
  | 'eyedropper'

export interface BrushOptions {
  giveCoreOnPaint: boolean
  removePreviousCores: boolean
}

interface MapToolbarProps {
  tool: MapTool
  setTool: (t: MapTool) => void
  brushOpts: BrushOptions
  setBrushOpts: React.Dispatch<React.SetStateAction<BrushOptions>>
  onZoomIn: () => void
  onZoomOut: () => void
  onFitMap: () => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
}

export default function MapToolbar({
  tool,
  setTool,
  brushOpts,
  setBrushOpts,
  onZoomIn,
  onZoomOut,
  onFitMap,
  canUndo,
  canRedo,
  onUndo,
  onRedo
}: MapToolbarProps): JSX.Element {
  const toolBtn = (
    t: MapTool,
    label: string,
    shortcut: string,
    icon: JSX.Element,
    tooltip: string
  ): JSX.Element => (
    <button
      title={`${tooltip} (${shortcut})`}
      onClick={() => setTool(t)}
      className={`btn flex items-center gap-1.5 text-xs ${
        tool === t ? 'bg-hoi-accent text-black font-semibold' : ''
      }`}
    >
      {icon}
      <span>{label}</span>
      <span className="text-[10px] opacity-60">({shortcut})</span>
    </button>
  )

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-hoi-border bg-hoi-panel px-3 py-1.5 text-hoi-text">
      {toolBtn('select', 'Seleccionar', 'V', <MousePointer2 size={15} />, 'Seleccionar estado')}
      {toolBtn('brush', 'Pincel', 'B', <Paintbrush size={15} />, 'Pintar estados')}
      {toolBtn('bucket', 'Cubeta', 'G', <PaintBucket size={15} />, 'Rellenar estados conectados')}
      {toolBtn('capital', 'Fijar capital', 'C', <Landmark size={15} />, 'Fijar capital del país activo')}
      {toolBtn('core', 'Core', 'K', <Shield size={15} />, 'Agregar o quitar core (Shift+clic para quitar)')}
      {toolBtn('eraser', 'Borrador', 'E', <Eraser size={15} />, 'Devolver estado a original')}
      {toolBtn('eyedropper', 'Cuentagotas', 'I', <Pipette size={15} />, 'Tomar dueño como país activo')}

      <div className="mx-1 h-5 w-px bg-hoi-border" />

      {/* Opción adicional para Pincel */}
      {tool === 'brush' && (
        <div className="flex items-center gap-3 text-xs bg-hoi-bg/50 px-2 py-1 rounded border border-hoi-border/50">
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={brushOpts.giveCoreOnPaint}
              onChange={(e) =>
                setBrushOpts((prev) => ({ ...prev, giveCoreOnPaint: e.target.checked }))
              }
              className="rounded accent-hoi-accent"
            />
            <span>Dar core al pintar</span>
          </label>
          <label className="flex items-center gap-1 cursor-pointer">
            <input
              type="checkbox"
              checked={brushOpts.removePreviousCores}
              onChange={(e) =>
                setBrushOpts((prev) => ({ ...prev, removePreviousCores: e.target.checked }))
              }
              className="rounded accent-hoi-accent"
            />
            <span>Quitar cores de dueño anterior</span>
          </label>
        </div>
      )}

      <div className="flex-1" />

      {/* Botones Zoom y Ajustar */}
      <button title="Acercar (+)" onClick={onZoomIn} className="btn p-1.5">
        <ZoomIn size={15} />
      </button>
      <button title="Alejar (-)" onClick={onZoomOut} className="btn p-1.5">
        <ZoomOut size={15} />
      </button>
      <button title="Ajustar al mapa (F)" onClick={onFitMap} className="btn p-1.5">
        <Maximize size={15} />
      </button>

      <div className="mx-1 h-5 w-px bg-hoi-border" />

      {/* Historial Deshacer/Rehacer */}
      <button
        title="Deshacer (Ctrl+Z)"
        disabled={!canUndo}
        onClick={onUndo}
        className="btn p-1.5 disabled:opacity-40"
      >
        <Undo2 size={15} />
      </button>
      <button
        title="Rehacer (Ctrl+Y)"
        disabled={!canRedo}
        onClick={onRedo}
        className="btn p-1.5 disabled:opacity-40"
      >
        <Redo2 size={15} />
      </button>
    </div>
  )
}
