// Editor de bloques (Blockly, estilo Scratch) del foco seleccionado.
// Cada cambio se guarda en el foco: el estado de los bloques + el script generado.
import { useEffect, useRef } from 'react'
import * as Blockly from 'blockly'
import { registerAllBlocks, toolbox } from '../blocks'
import { createSlots, SLOT_TYPES } from '../blocks/slots'
import { generateSlots } from '../generator/pdx'
import type { Focus, FocusScripts } from '../types'
import { hoiDarkTheme } from './theme'

interface Props {
  focus: Focus | null
  onChange: (uid: string, blocks: unknown, scripts: FocusScripts) => void
}

export default function BlocklyEditor({ focus, onChange }: Props): JSX.Element {
  const divRef = useRef<HTMLDivElement>(null)
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null)
  const uidRef = useRef<string | null>(null)
  /** Último estado de bloques que guardamos nosotros (para detectar cambios hechos desde fuera) */
  const lastSaved = useRef<unknown>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Crear el espacio de trabajo una sola vez
  useEffect(() => {
    registerAllBlocks()
    const ws = Blockly.inject(divRef.current!, {
      toolbox,
      renderer: 'zelos',
      theme: hoiDarkTheme,
      sounds: false,
      // Imágenes de Blockly copiadas en src/renderer/public (funciona sin internet)
      media: './blockly-media/',
      trashcan: true,
      grid: { spacing: 24, length: 2, colour: '#2a2a32', snap: true },
      zoom: {
        controls: true,
        wheel: true,
        startScale: 0.75,
        maxScale: 2,
        minScale: 0.3
      },
      move: { scrollbars: true, drag: true, wheel: false }
    })
    wsRef.current = ws
    // Los bloques sueltos (fuera de una ranura) se ven desactivados y no generan código
    ws.addChangeListener(Blockly.Events.disableOrphans)
    ws.addChangeListener((e) => {
      if (e.isUiEvent || !uidRef.current) return
      const blocks = Blockly.serialization.workspaces.save(ws)
      lastSaved.current = blocks
      onChangeRef.current(uidRef.current, blocks, generateSlots(ws))
    })
    const ro = new ResizeObserver(() => Blockly.svgResize(ws))
    ro.observe(divRef.current!)
    return () => {
      ro.disconnect()
      ws.dispose()
      // El próximo espacio de trabajo tiene que volver a cargar el foco
      wsRef.current = null
      uidRef.current = null
      lastSaved.current = null
    }
  }, [])

  // Cargar los bloques cuando cambia el foco seleccionado
  useEffect(() => {
    const ws = wsRef.current
    if (!ws) return
    const uid = focus?.uid ?? null
    // Mismo foco y los bloques son los que guardamos nosotros → nada que recargar.
    // (Si cambiaron desde fuera, por ejemplo al renombrar un foco, se recargan.)
    if (uid === uidRef.current && (!focus || focus.blocks === lastSaved.current || !focus.blocks))
      return
    uidRef.current = null // evita guardar mientras cargamos
    Blockly.Events.disable()
    try {
      ws.clear()
      if (focus?.blocks) Blockly.serialization.workspaces.load(focus.blocks as object, ws)
      // Asegurar que existen las 3 ranuras
      if (
        focus &&
        Object.values(SLOT_TYPES).some((t) => ws.getBlocksByType(t, false).length === 0)
      ) {
        ws.clear()
        createSlots(ws)
      }
    } finally {
      Blockly.Events.enable()
    }
    // El deshacer de Blockly es solo de este foco
    ws.clearUndo()
    if (uid !== uidRef.current) ws.scrollCenter()
    lastSaved.current = focus?.blocks ?? null
    uidRef.current = uid
  }, [focus])

  return (
    <div className="relative h-full w-full">
      <div ref={divRef} className="absolute inset-0" />
      {!focus && (
        <div className="absolute inset-0 flex items-center justify-center bg-hoi-bg/90 text-hoi-muted">
          Selecciona un foco en el árbol para editar sus requisitos y recompensas
        </div>
      )}
    </div>
  )
}
