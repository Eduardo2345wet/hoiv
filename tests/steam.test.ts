// Detección de HOI4 en Steam (con un sistema de archivos simulado)
import { describe, expect, it } from 'vitest'
import path from 'path'
import {
  findHoi4,
  parseInstallDir,
  parseLibraryFolders,
  parseRegQuery,
  type DetectEnv
} from '../src/main/steamDetect'

const VDF = `"libraryfolders"
{
	"0"
	{
		"path"		"C:\\\\Program Files (x86)\\\\Steam"
	}
	"1"
	{
		"path"		"D:\\\\SteamLibrary"
	}
}`

function fakeEnv(files: Record<string, string>, registry: Record<string, string>): DetectEnv {
  const w = path.win32
  const norm = (p: string): string => w.normalize(p).toLowerCase()
  const all = Object.keys(files).map(norm)
  return {
    platform: 'win32',
    readRegistry: async (key, value) => registry[`${key}|${value}`] ?? null,
    exists: (p) => all.some((f) => f === norm(p) || f.startsWith(norm(p) + '\\')),
    readText: (p) => {
      const k = Object.keys(files).find((f) => norm(f) === norm(p))
      return k ? files[k] : null
    },
    homedir: 'C:\\Users\\x',
    join: (...parts) => w.join(...parts)
  }
}

describe('detección de HOI4', () => {
  it('lee las bibliotecas del libraryfolders.vdf', () => {
    expect(parseLibraryFolders(VDF)).toEqual(['C:\\Program Files (x86)\\Steam', 'D:\\SteamLibrary'])
  })
  it('lee installdir del appmanifest', () => {
    expect(parseInstallDir('"AppState"\n{\n\t"installdir"\t\t"Hearts of Iron IV"\n}')).toBe(
      'Hearts of Iron IV'
    )
  })
  it('lee el valor de reg query', () => {
    const out =
      '\r\nHKEY_CURRENT_USER\\Software\\Valve\\Steam\r\n    SteamPath    REG_SZ    c:/program files (x86)/steam\r\n'
    expect(parseRegQuery(out, 'SteamPath')).toBe('c:/program files (x86)/steam')
  })
  it('encuentra el juego en una segunda biblioteca', async () => {
    const root = 'C:\\Program Files (x86)\\Steam'
    const game = 'D:\\SteamLibrary\\steamapps\\common\\Hearts of Iron IV'
    const env = fakeEnv(
      {
        [`${root}\\steamapps\\libraryfolders.vdf`]: VDF,
        'D:\\SteamLibrary\\steamapps\\appmanifest_394360.acf': '"installdir" "Hearts of Iron IV"',
        [`${game}\\map\\provinces.bmp`]: 'x',
        [`${game}\\history\\states\\1-France.txt`]: 'x'
      },
      { 'HKCU\\Software\\Valve\\Steam|SteamPath': 'c:/program files (x86)/steam' }
    )
    const r = await findHoi4(env)
    expect(r.gamePath).toBe(game)
    expect(r.via).toBe('biblioteca')
  })
  it('sin Steam ni juego devuelve null', async () => {
    const r = await findHoi4(fakeEnv({}, {}))
    expect(r.gamePath).toBeNull()
  })
})
