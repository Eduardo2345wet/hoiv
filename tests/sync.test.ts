// Sincronización del mod con la carpeta de mods de HOI4 (con una carpeta de Documentos falsa)
import { describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {
  MANIFEST_NAME,
  findHoi4Documents,
  hoi4DocumentsCandidates,
  isHoi4Running,
  syncMod
} from '../src/main/modSync'
import type { ExportModPayload } from '../src/main/export'

const fakeDocs = (): string => {
  const docs = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi4-docs-'))
  const mods = path.join(docs, 'Paradox Interactive', 'Hearts of Iron IV', 'mod')
  fs.mkdirSync(mods, { recursive: true })
  return mods
}
const payload = (
  mods: string,
  files: [string, string][],
  deps: string[] = []
): ExportModPayload => ({
  exportPath: mods,
  modName: 'Mi Mod',
  tag: '',
  focusTreeScript: '',
  locYaml: 'l_english:\n a:0 "b"\n',
  dependencies: deps,
  files: files.map(([p, t]) => ({ path: p, text: t }))
})
const read = (p: string): string => fs.readFileSync(p, 'utf-8')

describe('sincronizar el mod con el juego (parte 3)', () => {
  it('el primer guardado crea la carpeta, el .mod con ruta absoluta y el manifiesto', () => {
    const mods = fakeDocs()
    const r = syncMod({ payload: payload(mods, [['common/national_focus/NVG_focus.txt', 'x']]) })
    expect(r.status).toBe('ok')
    expect(r.firstTime).toBe(true)
    const folder = path.join(mods, 'mi_mod')
    expect(fs.existsSync(path.join(folder, 'common/national_focus/NVG_focus.txt'))).toBe(true)
    const manifest = JSON.parse(read(path.join(folder, MANIFEST_NAME)))
    expect(Object.keys(manifest.files).sort()).toEqual(
      [
        'common/national_focus/NVG_focus.txt',
        'descriptor.mod',
        'localisation/english/mi_mod_l_english.yml'
      ].sort()
    )
    // .mod de afuera: nombre, path absoluto y descriptor.mod igual y SIN BOM
    const outer = read(path.join(mods, 'mi_mod.mod'))
    expect(outer).toContain('name="Mi Mod"')
    expect(outer).toContain(`path="${folder.replace(/\\/g, '/')}"`)
    const desc = fs.readFileSync(path.join(folder, 'descriptor.mod'))
    expect(desc[0]).not.toBe(0xef) // sin BOM
    expect(outer.startsWith(desc.toString('utf-8'))).toBe(true)
    // el temporal no queda
    expect(fs.readdirSync(mods).filter((n) => n.includes('.sync-'))).toEqual([])
  })

  it('dependencies quedan en el descriptor y en el .mod', () => {
    const mods = fakeDocs()
    syncMod({ payload: payload(mods, [], ['Otro Mod']) })
    expect(read(path.join(mods, 'mi_mod', 'descriptor.mod'))).toContain('"Otro Mod"')
    expect(read(path.join(mods, 'mi_mod.mod'))).toContain('dependencies=')
  })

  it('un archivo que ya no se genera se borra; uno puesto a mano nunca', () => {
    const mods = fakeDocs()
    const folder = path.join(mods, 'mi_mod')
    syncMod({
      payload: payload(mods, [
        ['gfx/interface/goals/mi_mod_a.dds', 'DDS'],
        ['interface/mi_mod_icons.gfx', 'sprites a']
      ])
    })
    fs.mkdirSync(path.join(folder, 'gfx/mio'), { recursive: true })
    fs.writeFileSync(path.join(folder, 'gfx/mio/mio.txt'), 'puesto a mano')
    // Borré el foco: ya no hay .dds ni sprite
    const r = syncMod({ payload: payload(mods, [['interface/mi_mod_icons.gfx', 'sprites sin a']]) })
    expect(r.removed).toEqual(['gfx/interface/goals/mi_mod_a.dds'])
    expect(fs.existsSync(path.join(folder, 'gfx/interface/goals/mi_mod_a.dds'))).toBe(false)
    expect(fs.existsSync(path.join(folder, 'gfx/interface'))).toBe(false) // carpeta vacía también
    expect(read(path.join(folder, 'interface/mi_mod_icons.gfx'))).toBe('sprites sin a')
    expect(read(path.join(folder, 'gfx/mio/mio.txt'))).toBe('puesto a mano')
    expect(r.unknown).toEqual(['gfx/mio/mio.txt']) // se avisa, no se toca
  })

  it('lo que no cambió no se reescribe (misma fecha de modificación)', async () => {
    const mods = fakeDocs()
    const files: [string, string][] = [
      ['a/uno.txt', '1'],
      ['a/dos.txt', '2']
    ]
    syncMod({ payload: payload(mods, files) })
    const f = path.join(mods, 'mi_mod', 'a/uno.txt')
    const t0 = fs.statSync(f).mtimeMs
    await new Promise((r) => setTimeout(r, 30))
    const r = syncMod({
      payload: payload(mods, [
        ['a/uno.txt', '1'],
        ['a/dos.txt', 'cambió']
      ])
    })
    expect(r.written).toEqual(['a/dos.txt'])
    expect(fs.statSync(f).mtimeMs).toBe(t0)
    expect(r.firstTime).toBe(false)
    const again = syncMod({
      payload: payload(mods, [
        ['a/uno.txt', '1'],
        ['a/dos.txt', 'cambió']
      ])
    })
    expect(again.written).toEqual([])
  })

  it('una carpeta ajena (con archivos y sin manifiesto) pide confirmación una vez', () => {
    const mods = fakeDocs()
    const folder = path.join(mods, 'mi_mod')
    fs.mkdirSync(folder, { recursive: true })
    fs.writeFileSync(path.join(folder, 'otro.txt'), 'de otro mod')
    const first = syncMod({ payload: payload(mods, [['a.txt', '1']]) })
    expect(first.status).toBe('needs-confirm')
    expect(fs.existsSync(path.join(folder, 'a.txt'))).toBe(false) // no se tocó nada
    const ok = syncMod({ payload: payload(mods, [['a.txt', '1']]), confirmForeign: true })
    expect(ok.status).toBe('ok')
    expect(read(path.join(folder, 'otro.txt'))).toBe('de otro mod')
    expect(syncMod({ payload: payload(mods, [['a.txt', '1']]) }).status).toBe('ok') // ya tiene manifiesto
  })

  it('una carpeta vacía existente se usa sin preguntar', () => {
    const mods = fakeDocs()
    fs.mkdirSync(path.join(mods, 'mi_mod'))
    expect(syncMod({ payload: payload(mods, [['a.txt', '1']]) }).status).toBe('ok')
  })

  it('si algo falla al preparar, el mod queda como estaba', () => {
    const mods = fakeDocs()
    syncMod({ payload: payload(mods, [['a.txt', 'viejo']]) })
    // una ruta que no se puede escribir (un archivo donde debería ir una carpeta)
    fs.writeFileSync(path.join(mods, '.mi_mod.sync-bloqueo'), 'x')
    const bad = payload(mods, [
      ['a.txt', 'nuevo'],
      ['../fuera.txt', 'x']
    ])
    const r = syncMod({ payload: bad })
    expect(r.status).toBe('error')
    expect(read(path.join(mods, 'mi_mod', 'a.txt'))).toBe('viejo')
  })

  it('nunca escribe dentro de la instalación del juego', () => {
    const r = syncMod({ payload: payload('/x/steamapps/common/Hearts of Iron IV/mod', []) })
    expect(r.status).toBe('error')
  })
})

describe('Documentos de HOI4 y proceso del juego', () => {
  it('considera OneDrive y devuelve la primera carpeta que existe', () => {
    const c = hoi4DocumentsCandidates(
      'C:\\Users\\a\\Documents',
      { OneDrive: 'C:\\Users\\a\\OneDrive' },
      (...p) => p.join('\\')
    )
    expect(c[0]).toBe('C:\\Users\\a\\Documents\\Paradox Interactive\\Hearts of Iron IV')
    expect(c.some((x) => x.includes('OneDrive\\Documents\\Paradox'))).toBe(true)
    expect(findHoi4Documents(c, (p) => p.includes('OneDrive\\Documents'))).toContain('OneDrive')
    expect(findHoi4Documents(c, () => false)).toBeNull()
  })
  it('detecta hoi4.exe abierto', async () => {
    expect(await isHoi4Running(async () => 'hoi4.exe   1234 Console', 'win32')).toBe(true)
    expect(await isHoi4Running(async () => 'INFO: No tasks', 'win32')).toBe(false)
    expect(await isHoi4Running(async () => '', 'linux')).toBe(false)
    expect(await isHoi4Running(async () => '4321\n', 'linux')).toBe(true)
  })
})

import { plannedPaths } from '../src/renderer/src/export/exportMod'
import { createFocus, deleteFocus } from '../src/renderer/src/ui/projectOps'
import { setIconRenderer } from '../src/renderer/src/icons/renderer'
import { emptyProject } from './fixtures'

describe('borrar un foco con ícono propio se refleja en el mod (parte 3)', () => {
  it('el .dds y el sprite del foco desaparecen del mod al guardar de nuevo', () => {
    setIconRenderer(() => 'data:image/png;base64,AAAA')
    let p = { ...emptyProject(), modName: 'Mi Mod' }
    p = createFocus(p, 0, 0, 'Industria', 'arbol_1').project
    p = createFocus(p, 0, 1, 'Ejército', 'arbol_1').project
    const dds = (q: typeof p): string[] => plannedPaths(q).filter((x) => x.endsWith('.dds'))
    expect(dds(p).length).toBe(2)
    const mods = fakeDocs()
    const asFiles = (q: typeof p): [string, string][] =>
      plannedPaths(q).map((x) => [x, `contenido de ${x}`])
    syncMod({
      payload: payload(
        mods,
        asFiles(p).filter(([x]) => x !== 'descriptor.mod' && !x.startsWith('localisation'))
      )
    })
    const folder = path.join(mods, 'mi_mod')
    for (const f of dds(p)) expect(fs.existsSync(path.join(folder, f))).toBe(true)
    fs.writeFileSync(path.join(folder, 'mi_archivo.txt'), 'a mano')
    // Borro el primer foco y guardo de nuevo
    const q = deleteFocus(p, p.focuses[0].uid)
    expect(dds(q).length).toBe(1)
    const r = syncMod({
      payload: payload(
        mods,
        asFiles(q).filter(([x]) => x !== 'descriptor.mod' && !x.startsWith('localisation'))
      )
    })
    const gone = dds(p).filter((f) => !dds(q).includes(f))
    expect(gone.length).toBe(1)
    expect(r.removed).toEqual(expect.arrayContaining(gone))
    expect(fs.existsSync(path.join(folder, gone[0]))).toBe(false)
    expect(fs.existsSync(path.join(folder, dds(q)[0]))).toBe(true)
    expect(read(path.join(folder, 'mi_archivo.txt'))).toBe('a mano')
  })
})
