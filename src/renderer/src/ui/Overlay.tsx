// Capa de ventana: portal en document.body (capa Z.window), fondo oscuro y bloqueo del resto.
// Mientras hay una ventana abierta: se cierra todo lo flotante de Blockly, la app de atrás queda
// inerte (sin clics ni teclado) y al cerrar se restaura y se devuelve el foco a donde estaba.
import { useEffect, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import * as Blockly from 'blockly'
import { Z } from './layers'

let open = 0
let returnFocus: HTMLElement | null = null

/** Cierra flyout, menús desplegables, widgets y tooltips de Blockly */
export function closeBlocklyFloating(): void {
  try {
    for (const ws of Blockly.Workspace.getAll()) (ws as Blockly.WorkspaceSvg).hideChaff?.()
    Blockly.hideChaff()
    Blockly.WidgetDiv.hide()
    Blockly.DropDownDiv.hideWithoutAnimation()
    Blockly.Tooltip.hide()
  } catch {
    // Blockly todavía no está listo: no hay nada que cerrar
  }
}

function lock(): void {
  if (open++ > 0) return
  returnFocus = document.activeElement as HTMLElement | null
  closeBlocklyFloating()
  document.getElementById('root')?.setAttribute('inert', '')
}
function unlock(): void {
  if (--open > 0) return
  open = 0
  document.getElementById('root')?.removeAttribute('inert')
  const f = returnFocus
  returnFocus = null
  if (f && document.contains(f)) f.focus()
}

export default function Overlay({
  children,
  onBackdrop
}: {
  children: ReactNode
  /** Clic en el fondo oscuro */
  onBackdrop?: () => void
}): JSX.Element {
  useEffect(() => {
    lock()
    return unlock
  }, [])
  return createPortal(
    <div data-modal>
      <div
        className="fixed inset-0 bg-black/60"
        style={{ zIndex: Z.backdrop }}
        onPointerDown={(e) => e.target === e.currentTarget && onBackdrop?.()}
      />
      <div
        data-window
        className="pointer-events-none fixed inset-0 flex items-center justify-center"
        style={{ zIndex: Z.window }}
      >
        <div className="pointer-events-auto max-h-[92vh]">{children}</div>
      </div>
    </div>,
    document.body
  )
}
