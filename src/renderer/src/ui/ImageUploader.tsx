// Subir una imagen: ajustar/rellenar al tamaño final con vista previa a 1× y 2×
import { useEffect, useRef, useState } from 'react'
import type { IconAsset, IconTarget } from '../types'
import { newUid } from '../types'
import { ICON_SIZES } from '../icons/sizes'
import { loadImage, resizeImage, type FitMode } from '../export/imageCanvas'
import Modal from './Modal'

const MAX_BYTES = 5 * 1024 * 1024
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp']

interface Props {
  target?: IconTarget
  /** Tamaño final fijo (banderas 82×52, retratos 156×210); si no, el del ícono */
  size?: { w: number; h: number }
  title?: string
  /** Para imágenes que no son íconos de la biblioteca: devuelve el PNG final */
  onAcceptImage?: (png: string, small: boolean) => void
  /** Si se da, se puede cambiar el tipo (biblioteca) */
  allowTargetChange?: boolean
  /** Archivo ya elegido (por ejemplo, soltado sobre la biblioteca) */
  initialFile?: File
  onAccept?: (asset: IconAsset) => void
  onClose: () => void
}

/** Lee un archivo y valida tipo/tamaño; devuelve dataURL o lanza error en español */
export function readImageFile(file: File): Promise<string> {
  if (!ACCEPTED.includes(file.type))
    return Promise.reject(new Error('Formato no válido: usa PNG, JPG o WebP.'))
  if (file.size > MAX_BYTES) return Promise.reject(new Error('La imagen pesa más de 5 MB.'))
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result))
    r.onerror = () => reject(new Error('No se pudo leer el archivo.'))
    r.readAsDataURL(file)
  })
}

export default function ImageUploader({
  target: initialTarget = 'focus',
  size,
  title = 'Subir imagen',
  onAcceptImage,
  allowTargetChange,
  initialFile,
  onAccept,
  onClose
}: Props): JSX.Element {
  const [target, setTarget] = useState<IconTarget>(initialTarget)
  const [img, setImg] = useState<HTMLImageElement | null>(null)
  const [name, setName] = useState('')
  const [mode, setMode] = useState<FitMode>('rellenar')
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [png, setPng] = useState('')
  const [error, setError] = useState<string | null>(null)
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const { w, h } = size ?? ICON_SIZES[target]

  useEffect(() => {
    if (img) setPng(resizeImage(img, w, h, mode, offset).toDataURL('image/png'))
  }, [img, w, h, mode, offset])

  const load = async (file: File | undefined): Promise<void> => {
    if (!file) return
    try {
      const url = await readImageFile(file)
      setImg(await loadImage(url))
      setName(file.name.replace(/\.[^.]+$/, ''))
      setOffset({ x: 0, y: 0 })
      setError(null)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  useEffect(() => {
    if (initialFile) void load(initialFile)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFile])

  const small = !!img && (img.width < w || img.height < h)

  return (
    <Modal
      title={title}
      width={620}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            disabled={!img}
            onClick={() => {
              if (!img) return
              if (onAcceptImage) onAcceptImage(png, small)
              else
                onAccept?.({
                  id: newUid(),
                  name: name || 'imagen',
                  target,
                  png,
                  width: w,
                  height: h,
                  small
                })
            }}
          >
            {onAcceptImage ? 'Usar esta imagen' : 'Guardar ícono'}
          </button>
        </>
      }
    >
      <div
        className="mb-3 flex h-24 cursor-pointer flex-col items-center justify-center rounded border-2 border-dashed border-hoi-border text-sm text-hoi-muted hover:border-hoi-accent"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault()
          void load(e.dataTransfer.files[0])
        }}
        onClick={() => document.getElementById('upload-input')?.click()}
      >
        Arrastra aquí una imagen PNG, JPG o WebP (máx. 5 MB) o haz clic para elegirla
        <input
          id="upload-input"
          type="file"
          accept=".png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(e) => void load(e.target.files?.[0])}
        />
      </div>
      {error && <p className="mb-2 text-sm text-red-400">{error}</p>}

      {img && (
        <div className="flex gap-4">
          <div className="flex-1">
            {allowTargetChange && (
              <>
                <label className="label">Es para</label>
                <select
                  className="input mb-2"
                  value={target}
                  onChange={(e) => setTarget(e.target.value as IconTarget)}
                >
                  <option value="focus">Foco (100×88)</option>
                  <option value="idea">Espíritu nacional (60×68)</option>
                </select>
              </>
            )}
            {!onAcceptImage && (
              <>
                <label className="label">Nombre</label>
                <input
                  className="input mb-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </>
            )}
            <label className="label">Modo</label>
            <div className="mb-2 flex gap-2">
              <button
                className={mode === 'ajustar' ? 'btn-primary' : 'btn'}
                onClick={() => setMode('ajustar')}
              >
                Ajustar
              </button>
              <button
                className={mode === 'rellenar' ? 'btn-primary' : 'btn'}
                onClick={() => setMode('rellenar')}
              >
                Rellenar
              </button>
            </div>
            <p className="text-xs text-hoi-muted">
              {mode === 'ajustar'
                ? 'La imagen entra completa, con bordes transparentes.'
                : 'La imagen cubre todo y se recorta. Arrastra la vista previa grande para centrarla.'}
            </p>
            {small && (
              <p className="mt-2 text-xs text-yellow-400">
                ⚠ La imagen ({img.width}×{img.height}) es más chica que {w}×{h}: se verá borrosa.
              </p>
            )}
          </div>
          <div>
            <div className="label">Vista previa 1× y 2×</div>
            <div className="flex items-end gap-3 rounded bg-[#101013] p-3">
              <img src={png} width={w} height={h} alt="" />
              <img
                src={png}
                width={w * 2}
                height={h * 2}
                alt=""
                draggable={false}
                className={mode === 'rellenar' ? 'cursor-move' : ''}
                onPointerDown={(e) => {
                  ;(e.target as Element).setPointerCapture(e.pointerId)
                  drag.current = {
                    x: e.clientX,
                    y: e.clientY,
                    ox: offset.x,
                    oy: offset.y
                  }
                }}
                onPointerMove={(e) => {
                  const d = drag.current
                  if (!d || mode !== 'rellenar') return
                  const clamp = (v: number): number => Math.max(-1, Math.min(1, v))
                  setOffset({
                    x: clamp(d.ox + (e.clientX - d.x) / w),
                    y: clamp(d.oy + (e.clientY - d.y) / h)
                  })
                }}
                onPointerUp={() => (drag.current = null)}
              />
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}
