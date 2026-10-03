// Avisos pequeños abajo al centro: se cierran solos y pueden tener "Deshacer"
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Z } from './layers'
import { store, useApp } from '../store/appStore'

export default function ToastHost(): JSX.Element {
  const toasts = useApp((s) => s.toasts)
  return createPortal(
    <div
      className="pointer-events-none fixed bottom-10 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2"
      style={{ zIndex: Z.toast }}
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`pointer-events-auto flex items-center gap-3 rounded-lg border px-4 py-2 text-sm shadow-xl ${
            t.kind === 'error'
              ? 'border-red-500/70 bg-red-950/95 text-red-100'
              : 'border-hoi-border bg-hoi-panel/95'
          }`}
        >
          <span className="max-w-[520px] break-words">{t.message}</span>
          {t.action && (
            <button
              className="font-medium text-hoi-text underline"
              onClick={() => {
                t.action!.run()
                store.dismissToast(t.id)
              }}
            >
              {t.action.label}
            </button>
          )}
          {t.undo && (
            <button
              className="font-medium text-hoi-text underline"
              onClick={() => {
                store.undo()
                store.dismissToast(t.id)
              }}
            >
              Deshacer
            </button>
          )}
          <button
            className="text-hoi-muted hover:text-white"
            title="Cerrar"
            onClick={() => store.dismissToast(t.id)}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>,
    document.body
  )
}
