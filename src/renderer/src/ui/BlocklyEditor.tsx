// Editor de bloques (Blockly, estilo Scratch) del foco seleccionado.
// Cada cambio se guarda en el foco: el estado de los bloques + el script generado.
import { useEffect, useRef } from 'react'
import * as Blockly from 'blockly'
import { registerAllBlocks, toolbox } from '../blocks'
import {
  createSlots,
  focusRoot,
  hasOverlap,
  migrateFocusBlocks,
  setFocusRootName,
  tidyLooseBlocks
} from '../blocks/slots'
import { generateSlots } from '../generator/pdx'
import type { Focus, FocusScripts } from '../types'
import { hoiDarkTheme } from './theme'
import { Z } from './layers'
import { store } from '../store/appStore'

/** Avisos de tamaño: Blockly calcula sus barras y controles con el tamaño que tenía el contenedor */
export const blocklyStats: { resizes: number; ws?: Blockly.WorkspaceSvg } = { resizes: 0 }
const resizers = new Set<() => void>()
/** Pide recalcular el tamaño del editor de bloques (cambio de pestaña, panel, ventana cerrada…) */
export function requestBlocklyResize(): void {
  resizers.forEach((f) => f())
}
if (
  typeof window !== 'undefined' &&
  (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV
)
  (window as unknown as { __hoiBlockly: typeof blocklyStats }).__hoiBlockly = blocklyStats

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
        wheel: false,
        startScale: 0.75,
        maxScale: 2,
        minScale: 0.3
      },
      // La rueda y el arrastre del fondo mueven el área (el zoom va con los botones)
      move: { scrollbars: true, drag: true, wheel: true }
    })
    wsRef.current = ws
    blocklyStats.ws = ws
    // Los bloques sueltos (fuera de una ranura) se ven desactivados y no generan código
    ws.addChangeListener(Blockly.Events.disableOrphans)
    // Al soltar un bloque: si algo quedó encima de otra cosa, se ordenan los bloques sueltos
    ws.addChangeListener((e) => {
      if (e.type === Blockly.Events.BLOCK_DRAG && !(e as Blockly.Events.BlockDrag).isStart)
        if (hasOverlap(ws)) tidyLooseBlocks(ws)
    })
    ws.addChangeListener((e) => {
      if (e.isUiEvent || !uidRef.current) return
      const blocks = Blockly.serialization.workspaces.save(ws)
      lastSaved.current = blocks
      onChangeRef.current(uidRef.current, blocks, generateSlots(ws))
    })
    let raf = 0
    const resize = (): void => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => {
        if (!divRef.current?.isConnected) return
        Blockly.svgResize(ws)
        blocklyStats.resizes++
      })
    }
    const ro = new ResizeObserver(resize)
    ro.observe(divRef.current!)
    resizers.add(resize)
    window.addEventListener('resize', resize)
    // Cambio de pestaña de documento o de la cinta: el contenedor pasa de oculto a visible
    let last = `${store.get().activeTabId}|${store.get().ui.ribbon}`
    const off = store.subscribe(() => {
      const k = `${store.get().activeTabId}|${store.get().ui.ribbon}`
      if (k !== last) {
        last = k
        resize()
      }
    })
    resize()
    return () => {
      cancelAnimationFrame(raf)
      resizers.delete(resize)
      window.removeEventListener('resize', resize)
      off()
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
      if (focus) {
        // Los focos guardados con los tres bloques viejos pasan al bloque único
        Blockly.serialization.workspaces.load(migrateFocusBlocks(focus.blocks) as object, ws)
        if (!focusRoot(ws)) {
          ws.clear()
          createSlots(ws)
        }
        setFocusRootName(ws, focus.name)
        tidyLooseBlocks(ws)
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

  // El título del bloque raíz sigue al nombre del foco
  useEffect(() => {
    const ws = wsRef.current
    if (!ws || !focus) return
    Blockly.Events.disable()
    try {
      setFocusRootName(ws, focus.name)
    } finally {
      Blockly.Events.enable()
    }
  }, [focus?.name, focus?.uid]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative h-full w-full" style={{ zIndex: Z.blockly }}>
      <div ref={divRef} className="absolute inset-0" />
      {!focus && (
        <div className="absolute inset-0 flex items-center justify-center bg-hoi-bg/90 text-hoi-muted">
          Selecciona un foco en el árbol para editar sus requisitos y recompensas
        </div>
      )}
    </div>
  )
}
