// Memoria: la caché en disco se limpia y se poda; el mapa es un solo MapData compartido
import { describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { cacheInfo, clearCache, pruneByPrefix } from '../src/main/cacheTools'
import { store } from '../src/renderer/src/store/appStore'
import { generateDemoMap } from '../src/shared/map/demo'
import { emptyProject } from './fixtures'

const tmp = (): string => fs.mkdtempSync(path.join(os.tmpdir(), 'hoi-mem-'))

describe('caché en disco', () => {
  it('muestra cuánto ocupa y "Limpiar caché" la vacía', () => {
    const d = tmp()
    fs.writeFileSync(path.join(d, 'mapa-a.bin'), Buffer.alloc(1000))
    fs.mkdirSync(path.join(d, 'sub'))
    fs.writeFileSync(path.join(d, 'sub', 'b.json'), Buffer.alloc(500))
    expect(cacheInfo(d)).toEqual({ bytes: 1500, files: 2 })
    clearCache(d)
    expect(cacheInfo(d)).toEqual({ bytes: 0, files: 0 })
    expect(fs.existsSync(d)).toBe(true)
  })
  it('las cachés de versiones viejas se podan: solo quedan las más recientes', () => {
    const d = tmp()
    for (let i = 0; i < 5; i++) {
      const f = path.join(d, `banderas-${i}.json`)
      fs.writeFileSync(f, 'x')
      fs.utimesSync(f, new Date(2020, 0, i + 1), new Date(2020, 0, i + 1))
    }
    fs.writeFileSync(path.join(d, 'otro.json'), 'x')
    pruneByPrefix(d, 'banderas-', 2)
    expect(fs.readdirSync(d).sort()).toEqual(['banderas-3.json', 'banderas-4.json', 'otro.json'])
  })
})

describe('un solo MapData', () => {
  it('todas las pestañas de documento comparten el mismo mapa (no se copia)', () => {
    const map = generateDemoMap()
    const a = store.openInNewTab(emptyProject(), null, 'mapa')
    store.set({ map })
    const first = store.get().map
    const b = store.openInNewTab(emptyProject(), null, 'mapa')
    store.switchTab(a)
    expect(store.get().map).toBe(first)
    store.switchTab(b)
    expect(store.get().map).toBe(first)
    expect(store.get().map).toBe(map)
  })
})
