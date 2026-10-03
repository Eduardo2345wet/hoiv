// Regresión del rediseño de la interfaz: para el MISMO contenido, los archivos exportados de cada
// sección deben salir idénticos antes y después (la interfaz no cambia el formato de los scripts).
import { describe, expect, it } from 'vitest'
import { sectionFiles } from '../src/renderer/src/sections/generators'
import { sample } from './sampleProject'

describe('regresión del rediseño de la interfaz', () => {
  it('los archivos exportados de cada sección son idénticos al formato original', () => {
    const files = sectionFiles(sample()).files
    const out = Object.fromEntries(
      files.map((f) => [f.path, f.text ?? `[binario ${f.data?.length ?? 0} bytes]`])
    )
    expect(out).toMatchSnapshot()
  })
})
