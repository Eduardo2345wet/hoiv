// Editor de bloques (Blockly) del foco seleccionado.
// Tiene 3 ranuras fijas: Requisitos, Saltar si y Recompensa.

import { useEffect, useRef } from 'react'
import * as Blockly from 'blockly/core'
import * as Es from 'blockly/msg/es'
import { registerBlocks, SLOT_AVAILABLE, SLOT_BYPASS, SLOT_REWARD } from '../blocks/definitions'
import { hoiDarkTheme } from '../blocks/theme'
import { TOOLBOX } from '../blocks/toolbox'
import type { BlocklyState, Focus } from '../model/project'

// Textos internos de Blockly (menús, "Eliminar bloque"...) en español.
Blockly.setLocale(Es as unknown as { [key: string]: string })

// Posición inicial de cada ranura en el área de trabajo.
const SLOT_POSITIONS: [string, number, number][] = [
  [SLOT_AVAILABLE, 20, 20],
  [SLOT_BYPASS, 20, 280],
  [SLOT_REWARD, 480, 20]
]

/** Crea las ranuras que falten (proyectos nuevos o bloques borrados de un archivo). */
function ensureSlots(workspace: Blockly.WorkspaceSvg): void {
  for (const [type, x, y] of SLOT_POSITIONS) {
    if (workspace.getBlocksByType(type, false).length > 0) continue
    const block = workspace.newBlock(type)
    block.initSvg()
    block.render()
    block.moveBy(x, y)
  }
}

interface Props {
  focus: Focus
  onChange: (uid: string, state: BlocklyState) => void
}

export default function BlocklyEditor({ focus, onChange }: Props): JSX.Element {
  const containerRef = useRef<HTMLDivElement>(null)
  const workspaceRef = useRef<Blockly.WorkspaceSvg | null>(null)
  const uidRef = useRef(focus.uid)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Crear el área de trabajo una sola vez.
  useEffect(() => {
    if (!containerRef.current) return
    registerBlocks()
    const workspace = Blockly.inject(containerRef.current, {
      toolbox: TOOLBOX,
      // Imágenes de Blockly servidas desde la propia app (sin internet).
      media: './blockly-media/',
      renderer: 'zelos',
      theme: hoiDarkTheme,
      sounds: false,
      trashcan: true,
      grid: { spacing: 24, length: 2, colour: '#2a2a32', snap: false },
      zoom: { controls: true, wheel: true, startScale: 0.75, minScale: 0.3, maxScale: 2 },
      move: { scrollbars: true, drag: true, wheel: false },
      maxInstances: { [SLOT_AVAILABLE]: 1, [SLOT_BYPASS]: 1, [SLOT_REWARD]: 1 }
    })
    workspaceRef.current = workspace

    // Cada cambio real (no de interfaz) se guarda en el proyecto.
    workspace.addChangeListener((event) => {
      if (event.isUiEvent || workspace.isDragging()) return
      onChangeRef.current(uidRef.current, Blockly.serialization.workspaces.save(workspace))
    })

    // Blockly necesita saber cuándo cambia el tamaño del panel.
    const observer = new ResizeObserver(() => Blockly.svgResize(workspace))
    observer.observe(containerRef.current)

    return () => {
      observer.disconnect()
      workspace.dispose()
      workspaceRef.current = null
    }
  }, [])

  // Cargar los bloques del foco cuando se selecciona otro.
  useEffect(() => {
    const workspace = workspaceRef.current
    if (!workspace) return
    uidRef.current = focus.uid
    Blockly.Events.disable()
    try {
      workspace.clear()
      if (focus.blocks) Blockly.serialization.workspaces.load(focus.blocks, workspace)
      ensureSlots(workspace)
    } finally {
      Blockly.Events.enable()
    }
    workspace.scrollCenter()
    // Solo recargamos al cambiar de foco; los cambios propios ya están en el área de trabajo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus.uid])

  return <div ref={containerRef} className="h-full w-full" />
}
