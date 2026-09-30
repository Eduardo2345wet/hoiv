// Ventana modal sencilla reutilizable.

interface Props {
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  onClose?: () => void
}

export default function Modal({ title, children, footer, onClose }: Props): JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="max-h-[85vh] w-[560px] overflow-hidden rounded-lg border border-hoi-border bg-hoi-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-hoi-border px-4 py-3 text-base font-bold text-hoi-accent">{title}</div>
        <div className="max-h-[60vh] overflow-y-auto px-4 py-3 text-sm">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-hoi-border px-4 py-3">{footer}</div>}
      </div>
    </div>
  )
}

export const primaryButton =
  'rounded bg-hoi-accent px-4 py-2 text-sm font-semibold text-white hover:bg-hoi-accentHover disabled:cursor-not-allowed disabled:opacity-40'
export const secondaryButton = 'rounded bg-hoi-card px-4 py-2 text-sm text-hoi-text hover:bg-hoi-border'
