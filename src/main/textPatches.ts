// Parches mínimos de archivos de texto del juego (tecnologías e ideologías): se parte SIEMPRE de los
// bytes originales del archivo del usuario, se insertan solo las líneas necesarias y se comprueba el
// resultado con jomini antes de exportarlo. Nunca se inventa un archivo.
import fs from 'fs'
import path from 'path'
import { patchIdeologyTypes, patchTechLinks, type IdeologyAdd } from '../shared/textPatch'
import { getJomini } from './mapLoader'
import { resolveGameFile, type ModLayer } from './mods'

export type TextPatchRequest =
  | { kind: 'tech'; file: string; links: { from: string; to: string }[] }
  | { kind: 'ideology'; file: string; adds: IdeologyAdd[] }

export interface TextPatchResult {
  files: { path: string; data: Uint8Array }[]
  errors: { file: string; message: string }[]
}

const FOLDER = { tech: 'common/technologies', ideology: 'common/ideologies' } as const

export async function planTextPatches(
  gamePath: string,
  requests: TextPatchRequest[],
  mod: ModLayer | null = null
): Promise<TextPatchResult> {
  const out: TextPatchResult = { files: [], errors: [] }
  const parser = await getJomini()
  for (const req of requests) {
    const err = (message: string): number => out.errors.push({ file: req.file, message })
    if (req.file !== path.basename(req.file) || !req.file.endsWith('.txt')) {
      err('Nombre de archivo no válido.')
      continue
    }
    const rel = `${FOLDER[req.kind]}/${req.file}`
    const src = resolveGameFile(gamePath, mod, rel)
    let bytes: Buffer
    try {
      if (!src) throw new Error()
      bytes = fs.readFileSync(src)
    } catch {
      err(`No se encontró ${rel} en la carpeta del juego${mod ? ' ni en el mod' : ''}.`)
      continue
    }
    const text = bytes.toString('latin1')
    const res =
      req.kind === 'tech' ? patchTechLinks(text, req.links) : patchIdeologyTypes(text, req.adds)
    if (res.errors.length) {
      for (const m of res.errors) err(m)
      continue
    }
    const data = Buffer.from(res.text, 'latin1')
    try {
      parser.parseText(new Uint8Array(data))
    } catch (e) {
      err(`El archivo parchado no se puede leer: ${e instanceof Error ? e.message : e}`)
      continue
    }
    out.files.push({ path: rel, data: new Uint8Array(data) })
  }
  return out
}
