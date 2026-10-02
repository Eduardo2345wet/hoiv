// Ranura de bloques reutilizable (efectos o condiciones) para cualquier sección: misma caja de
// herramientas que los focos, filtrada por contexto, y el mismo generador PDX.
import { useEffect, useRef } from 'react'
import * as Blockly from 'blockly'
import { registerAllBlocks } from '../blocks'
import {
  areaRoot,
  areaRootType,
  areaToolbox,
  generateArea,
  registerAreaBlocks,
  type AreaMode,
  type AreaScope
} from '../blocks/area'
import type { BlockScript } from '../sections/types'
import { hoiDarkTheme } from './theme'

interface Props {
  value: BlockScript
  onChange: (v: BlockScript) => void
  mode?: AreaMode
  scope?: AreaScope
  height?: number
}

export default function BlocklyArea({
  value,
  onChange,
  mode = 'effect',
  scope = 'country',
  height = 260
}: Props): JSX.Element {
  const divRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null)
  const last = useRef<unknown>(null)
  const cb = useRef(onChange)
  cb.current = onChange

  useEffect(() => {
    registerAllBlocks()
    registerAreaBlocks()
    const ws = Blockly.inject(divRef.current!, {
      toolbox: areaToolbox(mode, scope),
      renderer: 'zelos',
      theme: hoiDarkTheme,
      sounds: false,
      media: './blockly-media/',
      trashcan: true,
      grid: { spacing: 24, length: 2, colour: '#2a2a32', snap: true },
      zoom: { controls: true, wheel: false, startScale: 0.75, maxScale: 2, minScale: 0.3 },
      move: { scrollbars: true, drag: true, wheel: true }
    })
    wsRef.current = ws
    ws.addChangeListener(Blockly.Events.disableOrphans)
    ws.addChangeListener((e) => {
      if (e.isUiEvent) return
      const blocks = Blockly.serialization.workspaces.save(ws)
      last.current = blocks
      cb.current({ blocks, code: generateArea(ws) })
    })
    const ro = new ResizeObserver(() => divRef.current?.isConnected && Blockly.svgResize(ws))
    ro.observe(divRef.current!)
    return () => {
      ro.disconnect()
      ws.dispose()
      wsRef.current = null
    }
  }, [mode, scope])

  // Cargar el valor (y recargar si cambió desde fuera, por ejemplo al cambiar de opción)
  useEffect(() => {
    const ws = wsRef.current
    if (!ws || value.blocks === last.current) return
    Blockly.Events.disable()
    try {
      ws.clear()
      if (value.blocks) Blockly.serialization.workspaces.load(value.blocks as object, ws)
      if (!areaRoot(ws)) {
        const b = ws.newBlock(areaRootType(mode, scope))
        b.initSvg()
        b.render()
        b.moveBy(20, 20)
      }
    } finally {
      Blockly.Events.enable()
    }
    ws.clearUndo()
    last.current = value.blocks
  }, [value, mode, scope])

  return (
    <div className="relative w-full rounded border border-hoi-border" style={{ height }}>
      <div ref={divRef} className="absolute inset-0" />
    </div>
  )
}
