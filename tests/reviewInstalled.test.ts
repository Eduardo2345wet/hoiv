// "Revisar mod instalado": solo lectura, compara la copia del juego con la última exportación
import { describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { handleExportMod } from '../src/main/export'
import { reviewInstalled } from '../src/main/reviewInstalled'

const tmp = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'hoi-rev-'))
const MODS = 'C:/Users/yo/Documents/Paradox Interactive/Hearts of Iron IV/mod'

async function exported(): Promise<{
  dir: string
  manifest: NonNullable<Awaited<ReturnType<typeof handleExportMod>>['manifest']>
}> {
  const dir = tmp()
  const r = await handleExportMod({
    exportPath: dir,
    modName: 'Mi Mod',
    tag: '',
    focusTreeScript: '',
    locYaml: 'l_english:\n A:0 "a"\n',
    files: [
      { path: 'common/ideas/x.txt', text: 'ideas = { }\n' },
      { path: 'history/states/1-A.txt', text: 'state = { }\n' }
    ],
    gameModsDir: MODS,
    supportedVersion: '1.19.*'
  })
  expect(r.success).toBe(true)
  return { dir, manifest: r.manifest! }
}
/** Copia lo exportado a una "carpeta de mods del juego" de mentira */
function install(dir: string): string {
  const mods = tmp()
  fs.cpSync(path.join(dir, 'mi_mod'), path.join(mods, 'mi_mod'), { recursive: true })
  fs.copyFileSync(path.join(dir, 'mi_mod.mod'), path.join(mods, 'mi_mod.mod'))
  return mods
}
const snapshot = (d: string): string =>
  fs
    .readdirSync(d, { recursive: true })
    .map(String)
    .sort()
    .map((f) => {
      const full = path.join(d, f)
      const st = fs.statSync(full)
      return `${f}:${st.isFile() ? fs.readFileSync(full).toString('base64') : 'dir'}:${st.mtimeMs}`
    })
    .join('|')

describe('revisar mod instalado', () => {
  it('una copia igual dice "Al día"', async () => {
    const { dir, manifest } = await exported()
    const mods = install(dir)
    // el .mod exportado apunta a la ruta final del juego, no a la carpeta temporal
    expect(reviewInstalled(mods, manifest)).toEqual({ status: 'ok' })
  })
  it('una copia vieja (manifiesto viejo, versión "1.*", archivo distinto y faltante) muestra las diferencias', async () => {
    const { dir, manifest } = await exported()
    const mods = install(dir)
    fs.writeFileSync(path.join(mods, 'mi_mod', '.hoi4modstudio.json'), '{}')
    fs.writeFileSync(path.join(mods, 'mi_mod', 'common/ideas/x.txt'), 'ideas = { viejo = yes }\n')
    fs.rmSync(path.join(mods, 'mi_mod', 'history/states/1-A.txt'))
    fs.writeFileSync(
      path.join(mods, 'mi_mod.mod'),
      'version="1.0"\nname="Mi Mod"\nsupported_version="1.*"\npath="C:/otro/lugar/mi_mod"\n'
    )
    const before = snapshot(mods)
    const r = reviewInstalled(mods, manifest)
    expect(snapshot(mods)).toBe(before) // no escribió nada
    expect(r.status).toBe('diff')
    if (r.status !== 'diff') return
    expect(r.extra).toEqual(['.hoi4modstudio.json'])
    expect(r.missing).toEqual(['history/states/1-A.txt'])
    expect(r.different).toEqual(['common/ideas/x.txt'])
    expect(r.mod.versionDiffers).toBe(true)
    expect(r.mod.pathDiffers).toBe(true)
    expect(r.mod.missing).toBe(false)
  })
  it('sin copia en la carpeta de mods: lo dice, sin crear nada', async () => {
    const { manifest } = await exported()
    const mods = tmp()
    expect(reviewInstalled(mods, manifest).status).toBe('missing-copy')
    expect(fs.readdirSync(mods)).toEqual([])
    expect(reviewInstalled(path.join(mods, 'no-existe'), manifest).status).toBe('missing-copy')
  })
  it('falta el .mod aunque la carpeta esté', async () => {
    const { dir, manifest } = await exported()
    const mods = install(dir)
    fs.rmSync(path.join(mods, 'mi_mod.mod'))
    const r = reviewInstalled(mods, manifest)
    expect(r.status === 'diff' && r.mod.missing).toBe(true)
  })
})
