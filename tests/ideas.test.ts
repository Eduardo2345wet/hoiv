// Espíritus: lista corta en Blockly, catálogo del juego con caché y "crear a partir de uno del juego"
import { describe, expect, it } from 'vitest'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { parseGameIdeas } from '../src/shared/ideasParse'
import { ideasCatalogStats, readIdeasCatalog } from '../src/main/ideasCatalog'
import { buildMenu, SPECIAL } from '../src/renderer/src/blocks/fieldCatalog'
import { store } from '../src/renderer/src/store/appStore'
import { createIdea, createIdeaFrom } from '../src/renderer/src/ui/projectOps'
import { generateIdeas } from '../src/renderer/src/generator/ideas'
import { planIconExport } from '../src/renderer/src/export/gfx'
import { emptyProject } from './fixtures'

// Fixture propio que imita la estructura de common/ideas (no es un archivo del juego)
const FILE = `ideas = {
	country = {
		MI_ESPIRITU = {
			picture = generic_pp_unity
			allowed = { always = no }
			modifier = {
				stability_factor = 0.1
				political_power_gain = 0.25
				custom_modifier_tooltip = MI_TOOLTIP
				some_unknown_modifier = -0.2
			}
			on_add = { add_stability = 0.05 }
			cost = 150
		}
		OTRO_ESPIRITU = {
			modifier = { war_support_factor = -0.05 }
		}
	}
	economy = {
		law = yes
		use_list_view = yes
		civilian_economy = {
			modifier = { consumer_goods_factor = 0.35 }
		}
	}
	hidden_ideas = {
		oculta = { }
	}
	tank_manufacturer = {
		designer = yes
		yarrow_shipbuilders = { picture = x allowed = { original_tag = ENG } }
	}
	political_advisor = {
		asesor_uno = { picture = y }
	}
}
`

describe('lectura de ideas del juego', () => {
  const ideas = parseGameIdeas(FILE, 'x.txt')
  const by = (id: string) => ideas.find((i) => i.id === id)!
  it('categorías → pestañas', () => {
    expect(by('MI_ESPIRITU').tab).toBe('espiritus')
    expect(by('civilian_economy').tab).toBe('leyes')
    expect(by('yarrow_shipbuilders').tab).toBe('asesores')
    expect(by('asesor_uno').tab).toBe('asesores')
    expect(by('oculta').tab).toBe('otros')
    expect(ideas.map((i) => i.id)).not.toContain('law')
    expect(ideas.map((i) => i.id)).not.toContain('use_list_view')
  })
  it('modificadores soportados como filas y el resto como texto avanzado, tal cual', () => {
    const i = by('MI_ESPIRITU')
    expect(i.picture).toBe('generic_pp_unity')
    expect(i.modifiers).toEqual([
      ['stability_factor', 10],
      ['political_power_gain', 0.25]
    ])
    expect(i.extraModifierText).toContain('custom_modifier_tooltip = MI_TOOLTIP')
    expect(i.extraModifierText).toContain('some_unknown_modifier = -0.2')
    expect(i.extraText).toContain('allowed = { always = no }')
    expect(i.extraText).toContain('on_add = { add_stability = 0.05 }')
    expect(i.extraText).toContain('cost = 150')
    expect(i.extraText).not.toContain('picture')
  })
})

describe('catálogo con caché', () => {
  const mkGame = (): string => {
    const g = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi-ideas-'))
    fs.mkdirSync(path.join(g, 'common', 'ideas'), { recursive: true })
    fs.mkdirSync(path.join(g, 'localisation', 'english', 'replace'), { recursive: true })
    fs.writeFileSync(path.join(g, 'common', 'ideas', 'a.txt'), FILE)
    fs.writeFileSync(
      path.join(g, 'localisation', 'english', 'ideas_l_english.yml'),
      '﻿l_english:\n MI_ESPIRITU:0 "Mi espíritu"\n MI_ESPIRITU_desc:0 "Descripción"\n'
    )
    // nombre en OTRO yml (carpeta replace/)
    fs.writeFileSync(
      path.join(g, 'localisation', 'english', 'replace', 'r_l_english.yml'),
      '﻿l_english:\n OTRO_ESPIRITU:0 "Otro nombre"\n'
    )
    return g
  }
  it('se lee una sola vez, usa nombres de varios .yml y la caché en disco', async () => {
    const g = mkGame()
    const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi-cache-'))
    const before = ideasCatalogStats.reads
    const a = readIdeasCatalog(g, cache)
    const b = readIdeasCatalog(g, cache)
    expect(ideasCatalogStats.reads - before).toBe(1)
    expect(b).toBe(a)
    expect(a.find((i) => i.id === 'MI_ESPIRITU')!.name).toBe('Mi espíritu')
    expect(a.find((i) => i.id === 'MI_ESPIRITU')!.desc).toBe('Descripción')
    expect(a.find((i) => i.id === 'OTRO_ESPIRITU')!.name).toBe('Otro nombre')
    // memoria vacía pero caché en disco válida: no se vuelve a parsear
    ideasCatalogStats.memory.clear()
    const c = readIdeasCatalog(g, cache)
    expect(ideasCatalogStats.parses).toBe(1)
    expect(c.length).toBe(a.length)
    // cambia un archivo → la huella cambia y se vuelve a leer
    fs.appendFileSync(path.join(g, 'common', 'ideas', 'a.txt'), '\n# cambio\n')
    ideasCatalogStats.memory.clear()
    readIdeasCatalog(g, cache)
    expect(ideasCatalogStats.parses).toBe(2)
  })
})

describe('crear a partir de uno del juego', () => {
  it('copia nombre, modificadores, picture y texto avanzado sin copiar archivos', () => {
    const gi = parseGameIdeas(FILE, 'x.txt').find((i) => i.id === 'MI_ESPIRITU')!
    const r = createIdeaFrom(
      emptyProject(),
      { ...gi, name: 'Mi espíritu', desc: 'Descripción' },
      'Mi espíritu (copia)'
    )
    expect(r.idea.name).toBe('Mi espíritu (copia)')
    expect(r.idea.picture).toBe('generic_pp_unity')
    const out = generateIdeas(r.project)
    expect(out).toContain('picture = generic_pp_unity')
    expect(out).toContain('stability_factor = 0.1')
    expect(out).toContain('custom_modifier_tooltip = MI_TOOLTIP')
    expect(out).toContain('some_unknown_modifier = -0.2')
    expect(out).toContain('on_add = { add_stability = 0.05 }')
    expect(out).toContain('cost = 150')
    // el id lleva el prefijo del mod y no es el del juego
    expect(r.idea.id).not.toBe('MI_ESPIRITU')
    // no se exporta ningún archivo de imagen ni sprite
    const plan = planIconExport(r.project)
    expect(plan.dds).toEqual([])
    expect(plan.sprites.filter((s) => s.name.includes('generic_pp_unity'))).toEqual([])
  })
})

describe('menú corto de Blockly', () => {
  it('con 4000 ideas del juego solo trae las del mod, recientes y opciones especiales (<100 ms)', () => {
    let p = emptyProject()
    p = createIdea(p, 'Mío').project
    const fake: [string, string][] = Array.from({ length: 4000 }, (_, i) => [
      `idea_${i}`,
      `Idea ${i}`
    ])
    store.openProject(p, null)
    store.set({ game: { countries: [], ideas: fake } as never, recentIdeas: ['idea_7', 'idea_9'] })
    const t0 = performance.now()
    const menu = buildMenu('idea', '')
    const ms = performance.now() - t0
    expect(ms).toBeLessThan(100)
    expect(menu.length).toBeLessThan(20)
    const values = menu.map((m) => m[1])
    expect(values).toContain(SPECIAL.pickGame)
    expect(values).toContain(SPECIAL.create)
    expect(values).toContain(SPECIAL.createFromGame)
    expect(values).toContain(SPECIAL.other)
    expect(values).toContain('idea_7') // recientes
    expect(menu.some((m) => m[1] === 'idea_100')).toBe(false)
    expect(menu.some((m) => m[1] === p.ideas[0].id)).toBe(true)
  })
})
