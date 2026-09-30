// Ventana modal reutilizable con el tema oscuro
import type { ReactNode } from 'react'

interface Props {
  title: string
  children: ReactNode
  footer?: ReactNode
  width?: number
  onClose: () => void
}

export default function Modal({
  title,
  children,
  footer,
  width = 560,
  onClose
}: Props): JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onPointerDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
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
    </div>
  )
}
