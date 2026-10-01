// jomini (parser de archivos de Paradox) se inicializa UNA sola vez.
// Se usa la entrada /slim y los bytes del .wasm se leen con fs desde la ruta que da
// require.resolve: así funciona igual en `npm run dev`, en el bundle de electron-vite
// (out/main) y dentro del instalador (app.asar, donde fs también puede leer el archivo).
// La entrada por defecto de jomini busca "../jomini_js_bg.wasm" junto al bundle y falla
// con ENOENT cuando electron-vite la incluye dentro de out/main/index.js.
import fs from 'fs'
import { createRequire } from 'module'
import { Jomini } from 'jomini/slim'
import type { JominiParser } from '../shared/map/stateFile'

export class JominiInitError extends Error {
  constructor(public technical: string) {
    super(
      `No se pudo iniciar jomini, el lector de los archivos de HOI4 (${technical}). ` +
        'Reinstala la aplicación; si sigue igual, avisa del error técnico.'
    )
  }
}

let jominiPromise: Promise<JominiParser> | null = null

export function getJomini(): Promise<JominiParser> {
  jominiPromise ??= (async () => {
    try {
      const req = createRequire(__filename)
      const wasmPath = req.resolve('jomini/jomini.wasm')
      const bytes = fs.readFileSync(wasmPath)
      return (await Jomini.initialize({ wasm: bytes })) as unknown as JominiParser
    } catch (e) {
      jominiPromise = null // permite reintentar
      throw new JominiInitError(e instanceof Error ? e.message : String(e))
    }
  })()
  return jominiPromise
}
