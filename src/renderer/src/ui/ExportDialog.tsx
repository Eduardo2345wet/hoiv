// Diálogo "Exportar mod": primero valida, luego pide la carpeta y escribe los archivos.

import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'
import type { ExportModResult } from '../../../shared/exportTypes'
import { validateProject } from '../export/validator'
import type { Project } from '../model/project'
import Modal, { primaryButton, secondaryButton } from './Modal'

interface Props {
  project: Project
  focusBlocks: Map<string, string>
  fileScript: string
  localisation: string
  onSelectFocus: (uid: string) => void
  onClose: () => void
}

export default function ExportDialog(props: Props): JSX.Element {
  const { project, focusBlocks, fileScript, localisation, onClose } = props
  const issues = useMemo(
    () => validateProject(project, focusBlocks, fileScript),
    [project, focusBlocks, fileScript]
  )
  const errors = issues.filter((i) => i.level === 'error')
  const warnings = issues.filter((i) => i.level === 'warning')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<ExportModResult | null>(null)
  const [defaultPath, setDefaultPath] = useState('')

  useEffect(() => {
    window.electronAPI?.getDefaultModPath().then(setDefaultPath)
  }, [])

  const doExport = async (): Promise<void> => {
    const api = window.electronAPI
    if (!api) {
      setResult({ success: false, error: 'Exportar solo funciona dentro de la app de escritorio.' })
      return
    }
    const folder = await api.selectFolder()
    if (!folder) return
    setBusy(true)
    try {
      setResult(
        await api.exportMod({
          exportPath: folder,
          modName: project.modName,
          tag: project.tag,
          focusTreeScript: fileScript,
          locYaml: localisation
        })
      )
    } finally {
      setBusy(false)
    }
  }

  // Resultado final
  if (result) {
    return (
      <Modal
        title={result.success ? 'Mod exportado' : 'No se pudo exportar'}
        onClose={onClose}
        footer={
          <button className={primaryButton} onClick={onClose}>
            Cerrar
          </button>
        }
      >
        {result.success ? (
          <>
            <p className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 size={18} /> Archivos creados:
            </p>
            <ul className="mt-2 space-y-1 font-mono text-xs text-hoi-muted">
              {result.files?.map((f) => (
                <li key={f} className="select-text break-all">
                  {f}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-hoi-text">
              Abre el lanzador de Hearts of Iron IV → «Todos los mods» → activa «{project.modName}» en un
              conjunto de reproducción y juega con {project.tag}.
            </p>
          </>
        ) : (
          <p className="flex items-center gap-2 text-red-400">
            <XCircle size={18} /> {result.error}
          </p>
        )}
      </Modal>
    )
  }

  return (
    <Modal
      title="Exportar mod"
      onClose={onClose}
      footer={
        <>
          <button className={secondaryButton} onClick={onClose}>
            {errors.length ? 'Volver y corregir' : 'Cancelar'}
          </button>
          {errors.length === 0 && (
            <button className={primaryButton} disabled={busy} onClick={doExport}>
              {warnings.length ? 'Exportar igualmente' : 'Elegir carpeta y exportar'}
            </button>
          )}
        </>
      }
    >
      {issues.length === 0 && (
        <p className="flex items-center gap-2 text-emerald-400">
          <CheckCircle2 size={18} /> Todo correcto, no se encontraron problemas.
        </p>
      )}
      {errors.length > 0 && (
        <p className="mb-2 text-red-400">Corrige estos errores antes de exportar:</p>
      )}
      <ul className="space-y-1">
        {issues.map((issue, i) => (
          <li
            key={i}
            onClick={() => {
              if (issue.focusUid) {
                props.onSelectFocus(issue.focusUid)
                onClose()
              }
            }}
            className={
              'flex items-start gap-2 rounded px-2 py-1 ' +
              (issue.focusUid ? 'cursor-pointer hover:bg-hoi-card ' : '') +
              (issue.level === 'error' ? 'text-red-300' : 'text-yellow-300')
            }
          >
            {issue.level === 'error' ? (
              <XCircle size={16} className="mt-0.5 shrink-0" />
            ) : (
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            )}
            {issue.message}
          </li>
        ))}
      </ul>
      {errors.length === 0 && (
        <p className="mt-4 text-xs text-hoi-muted">
          Elige la carpeta <b>mod</b> de Hearts of Iron IV
          {defaultPath && (
            <>
              : <span className="select-text break-all font-mono">{defaultPath}</span>
            </>
          )}
          . Nunca elijas la carpeta donde está instalado el juego.
        </p>
      )}
    </Modal>
  )
}
