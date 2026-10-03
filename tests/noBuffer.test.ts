// La interfaz de Electron (sin integración de Node) NO tiene `Buffer`: el código del renderer no puede
// depender de él. Antes, subir un .ogg lo marcaba como inválido y exportar música, sonidos o la
// portada fallaba en la app real (en las pruebas de Node, `Buffer` sí existe y nada lo mostraba).
import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'
import { emptyProjectFor } from '../src/renderer/src/templates'
import { coverBytes, isOgg, musicFiles, newTrack } from '../src/renderer/src/sections/extras'
import { createSuperEvent, isPcmWav } from '../src/renderer/src/sections/superEvents'
import { sectionFiles } from '../src/renderer/src/sections/generators'

const wav = (): string => {
  const h = Buffer.alloc(44)
  h.write('RIFF', 0, 'latin1')
  h.writeUInt32LE(36, 4)
  h.write('WAVE', 8, 'latin1')
  h.write('fmt ', 12, 'latin1')
  h.writeUInt32LE(16, 16)
  h.writeUInt16LE(1, 20) // PCM
  return h.toString('base64')
}
const OGG = Buffer.from('OggS\u0000\u0002\u0000\u0000\u0000\u0000\u0000\u0000', 'latin1').toString(
  'base64'
)
const PNG = `data:image/png;base64,${Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString('base64')}`

describe('el renderer no usa Buffer', () => {
  it('reconoce .ogg y .wav y exporta música, sonido y portada sin Buffer', () => {
    let p = emptyProjectFor('Mi Mod', 'content')
    p = {
      ...p,
      music: [newTrack({ name: 'Marcha', ogg: { name: 'a.ogg', base64: OGG } })],
      cover: PNG
    }
    p = createSuperEvent(p, { title: 'Caída', sound: { name: 's.wav', base64: wav() } }).project
    const w = wav()
    // Sin Buffer SOLO durante este bloque síncrono (el ejecutor de pruebas lo necesita fuera de él)
    const real = globalThis.Buffer
    let out: Record<string, unknown> = {}
    let error: unknown = null
    // @ts-expect-error simula la interfaz de Electron
    delete globalThis.Buffer
    try {
      out = {
        ogg: isOgg(OGG),
        notOgg: isOgg('AAAA'),
        wav: isPcmWav(w),
        notWav: isPcmWav(OGG),
        song: musicFiles(p).some((f) => f.path.endsWith('.ogg') && !!f.data?.length),
        cover: coverBytes(p)?.length,
        wavFile: sectionFiles(p).files.some((f) => f.path.endsWith('.wav'))
      }
    } catch (e) {
      error = e
    } finally {
      globalThis.Buffer = real
    }
    expect(error).toBeNull()
    expect(out).toEqual({
      ogg: true,
      notOgg: false,
      wav: true,
      notWav: false,
      song: true,
      cover: 8,
      wavFile: true
    })
  })
})

describe('guardia estática', () => {
  it('ningún archivo del renderer ni de shared usado por él llama a Buffer', () => {
    const root = path.join(__dirname, '..', 'src', 'renderer', 'src')
    const bad: string[] = []
    const walk = (dir: string): void => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const f = path.join(dir, e.name)
        if (e.isDirectory()) walk(f)
        else if (/\.(ts|tsx)$/.test(e.name))
          fs.readFileSync(f, 'utf-8')
            .split('\n')
            .forEach((l, i) => {
              if (/^\s*(\/\/|\*|\/\*)/.test(l)) return
              if (/\bBuffer\.(from|alloc|concat)\b|new Buffer\(/.test(l))
                bad.push(`${path.relative(root, f)}:${i + 1}`)
            })
      }
    }
    walk(root)
    expect(bad).toEqual([])
  })
})
