import React, { useRef } from 'react'
import { Image, Eye, EyeOff, X } from 'lucide-react'

export interface ReferenceImageState {
  dataUrl: string | null
  opacity: number
  visible: boolean
}

interface ReferenceImageControlProps {
  refImg: ReferenceImageState
  setRefImg: React.Dispatch<React.SetStateAction<ReferenceImageState>>
}

export default function ReferenceImageControl({
  refImg,
  setRefImg
}: ReferenceImageControlProps): JSX.Element {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (evt) => {
      const res = evt.target?.result as string
      if (res) {
        setRefImg({
          dataUrl: res,
          opacity: 0.5,
          visible: true
        })
      }
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="absolute right-4 top-4 z-10 rounded-lg border border-hoi-border bg-hoi-panel/90 p-2 text-xs shadow-lg backdrop-blur-sm text-hoi-text">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/png, image/jpeg"
        className="hidden"
      />

      {refImg.dataUrl ? (
        <div className="flex items-center gap-2">
          <button
            onClick={() => setRefImg((prev) => ({ ...prev, visible: !prev.visible }))}
            className="btn p-1"
            title={refImg.visible ? 'Ocultar imagen de referencia' : 'Mostrar imagen de referencia'}
          >
            {refImg.visible ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>

          <span className="text-hoi-muted">Opacidad:</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={refImg.opacity}
            onChange={(e) =>
              setRefImg((prev) => ({ ...prev, opacity: parseFloat(e.target.value) }))
            }
            className="w-20 accent-hoi-accent cursor-pointer"
          />
          <span className="font-mono text-[10px] w-7">{Math.round(refImg.opacity * 100)}%</span>

          <button
            onClick={() => setRefImg({ dataUrl: null, opacity: 0.5, visible: false })}
            className="btn p-1 text-hoi-muted hover:text-hoi-text"
            title="Quitar imagen"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileInputRef.current?.click()}
          className="btn flex items-center gap-1.5"
          title="Subir imagen PNG/JPG de referencia para sobreponer al mapa"
        >
          <Image size={14} />
          <span>Imagen de referencia</span>
        </button>
      )}
    </div>
  )
}
