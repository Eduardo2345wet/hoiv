// Ventana modal reutilizable con el tema oscuro
import { useEffect, useRef, type ReactNode } from 'react'
import Overlay from './Overlay'

interface Props {
  title: string
  children: ReactNode
  footer?: ReactNode
  width?: number
  onClose: () => void
}

const stack: symbol[] = []

export default function Modal({
  title,
  children,
  footer,
  width = 560,
  onClose
}: Props): JSX.Element {
  // Esc cierra solo la ventana de más arriba (aunque el foco no esté dentro)
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const id = Symbol('modal')
    stack.push(id)
    const key = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape' || stack[stack.length - 1] !== id) return
      e.stopPropagation()
      closeRef.current()
    }
    window.addEventListener('keydown', key)
    return () => {
      window.removeEventListener('keydown', key)
      stack.splice(stack.indexOf(id), 1)
    }
  }, [])
  return (
    <Overlay onBackdrop={onClose}>
      <div
        className="flex max-h-[92vh] flex-col overflow-hidden rounded-lg border border-hoi-border bg-hoi-panel shadow-2xl"
        style={{ width }}
      >
        <h2 className="shrink-0 border-b border-hoi-border px-4 py-3 font-semibold">{title}</h2>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer && (
          <div className="flex shrink-0 justify-end gap-2 border-t border-hoi-border p-3">
            {footer}
          </div>
        )}
      </div>
    </Overlay>
  )
}
