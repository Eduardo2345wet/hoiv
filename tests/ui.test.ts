// Pruebas de la interfaz tipo NX en un navegador real (servidor de Vite + Chromium/Edge).
// Sin navegador se saltan. La app corre sin Electron: sin carpeta del juego → mapa de demostración.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import path from 'path'
import react from '@vitejs/plugin-react'
import { createServer, type ViteDevServer } from 'vite'
import type { Browser, Page } from 'playwright-core'
import { launchBrowser } from './browser/launch'
import { newCountry } from '../src/renderer/src/countries/countryOps'

let server: ViteDevServer | null = null
let browser: Browser | null = null
let url = ''

beforeAll(async () => {
  browser = await launchBrowser()
  if (!browser) return
  server = await createServer({
    root: path.join(__dirname, '..', 'src', 'renderer'),
    plugins: [react()],
    server: { port: 0 },
    logLevel: 'silent'
  })
  await server.listen()
  const a = server.httpServer!.address()
  url = `http://localhost:${typeof a === 'object' && a ? a.port : 5173}`
}, 120_000)

afterAll(async () => {
  await browser?.close()
  await server?.close()
})

async function fresh(): Promise<Page> {
  const page = await browser!.newPage({ viewport: { width: 1366, height: 768 } })
  await page.goto(url)
  await page.waitForSelector('text=Nuevo proyecto')
  return page
}

async function newProject(page: Page, name: string, template: string): Promise<void> {
  await page.keyboard.press('Control+n')
  await page.waitForSelector('text=Nombre del proyecto')
  await page.click(`button:has-text("${template}")`)
  await page.fill('input[placeholder="Mi mod de México"]', name)
  await page.click('button:has-text("Aceptar")')
  await page.waitForSelector(`[title="Sin guardar"]:has-text("${name}")`)
}

describe('interfaz tipo NX (partes 1 a 4)', () => {
  it('sin proyecto: herramientas en gris, página de inicio y Archivo funciona', async ({
    skip
  }) => {
    if (!browser) skip()
    const page = await fresh()
    // Página de inicio: dos botones grandes y Recientes
    expect(await page.locator('text=Abrir proyecto').count()).toBeGreaterThan(0)
    expect(await page.locator('h2:text-is("Recientes")').count()).toBe(1)
    // Cinta completa pero con las herramientas deshabilitadas
    for (const t of ['Inicio', 'Mapa', 'Focos', 'Países', 'Espíritus', 'Íconos', 'Exportar'])
      expect(await page.locator(`button:text-is("${t}")`).count()).toBeGreaterThan(0)
    await page.click('button:text-is("Mapa")')
    for (const t of ['Pincel', 'Cubeta', 'Zoom +', 'Exportar imagen PNG'])
      expect(await page.locator(`button:has-text("${t}")`).first().isDisabled()).toBe(true)
    // No pide nombre del mod ni tag al abrir
    expect(await page.locator('input[placeholder="MEX"]').count()).toBe(0)
    // Archivo funciona: abre el diálogo de Nuevo proyecto
    await page.click('button:text-is("Archivo")')
    await page.click('text=Nuevo proyecto…')
    await page.waitForSelector('text=Nombre del proyecto')
    await page.close()
  }, 60_000)

  it('Nuevo proyecto con cada plantilla abre una pestaña y no pide tag', async ({ skip }) => {
    if (!browser) skip()
    const page = await fresh()
    const names = ['Lienzo en blanco', 'Lienzo en blanco + Sin nación', 'Mapa del juego']
    for (const [i, t] of names.entries()) {
      await page.keyboard.press('Control+n')
      await page.waitForSelector('text=Nombre del proyecto')
      expect(await page.locator('input[placeholder="MEX"]').count()).toBe(0)
      await page.locator(`button:has-text("${t}")`).first().click()
      await page.fill('input[placeholder="Mi mod de México"]', `P${i}`)
      await page.click('button:has-text("Aceptar")')
      await page.waitForSelector(`[title="Sin guardar"]:has-text("P${i}")`)
    }
    // "Mod sin mapa" está en la categoría Contenido y abre en Focos
    await page.keyboard.press('Control+n')
    await page.waitForSelector('text=Nombre del proyecto')
    await page.click('button:text-is("Contenido")')
    await page.click('button:has-text("Mod sin mapa")')
    await page.fill('input[placeholder="Mi mod de México"]', 'Sin mapa')
    await page.click('button:has-text("Aceptar")')
    await page.waitForSelector('[title="Sin guardar"]:has-text("Sin mapa")')
    expect(await page.locator('[title="Sin guardar"]').count()).toBe(4)
    expect(await page.locator('text=Plantilla: Mod sin mapa').count()).toBe(1)
    await page.close()
  }, 120_000)

  it('Focos sin países avisa; Navegador y cinta cambian de vista', async ({ skip }) => {
    if (!browser) skip()
    const page = await fresh()
    await newProject(page, 'Solo focos', 'Lienzo en blanco')
    await page.click('button:text-is("Focos")')
    await page.click('button:has-text("Añadir foco")')
    await page.waitForSelector('text=¿De qué país es este árbol de focos?')
    await page.waitForSelector('text=Todos los países del juego')
    await page.keyboard.press('Escape')
    // La cinta cambia la vista principal: Países muestra su pestaña
    await page.click('button:text-is("Países")')
    await page.waitForSelector('button:has-text("Crear país")')
    // Propiedades del proyecto: la plantilla se ve ahí y no hay botón para cambiarla en el mapa
    await page.click('button:text-is("Archivo")')
    await page.click('text=Propiedades del proyecto…')
    await page.waitForSelector('dt:text-is("Plantilla") + dd:has-text("Lienzo en blanco")')
    await page.click('button:text-is("Cerrar")')
    await page.click('button:text-is("Mapa")')
    expect(await page.locator('button:has-text("Base:")').count()).toBe(0)
    expect(await page.locator('button:has-text("Nuevo proyecto con otra plantilla")').count()).toBe(
      1
    )
    await page.close()
  }, 120_000)

  it('dos pestañas: pintar en una no cambia la otra y Ctrl+Tab cambia', async ({ skip }) => {
    if (!browser) skip()
    const page = await fresh()
    await newProject(page, 'Uno', 'Lienzo en blanco')
    await newProject(page, 'Dos', 'Lienzo en blanco')
    // En "Dos": un país rápido (Paleta del Navegador) y pintar un estado con el Pincel
    await page.click('button:has-text("País rápido")')
    await page.fill('input[placeholder="Nombre del país"]', 'Pais Dos')
    await page.click('button:text-is("Crear")')
    await page.click('button:has-text("Pincel")')
    await page.waitForSelector('text=Estados del país (0)')
    const box = (await page.locator('canvas').first().boundingBox())!
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2)
    await page.waitForSelector('text=Estados del país (1)')
    // La pestaña "Uno" sigue sin cambios (y sin el país)
    await page.click('[title="Sin guardar"]:has-text("Uno")')
    await page.waitForSelector('text=Estados modificados')
    expect(
      await page.locator('aside:has-text("Navegador del proyecto") >> text=Pais Dos').count()
    ).toBe(0)
    // Ctrl+Tab vuelve a "Dos", que conserva lo pintado y el país activo
    await page.keyboard.press('Control+Tab')
    await page.waitForSelector('text=Estados del país (1)')
    // Deshacer en "Dos" quita lo pintado ahí y no toca "Uno"
    await page.keyboard.press('Control+z')
    await page.waitForSelector('text=Estados del país (0)')
    await page.keyboard.press('Control+Tab')
    await page.waitForSelector('text=Estados modificados')
    expect(await page.locator('button[title="Deshacer (Ctrl+Z)"]').isDisabled()).toBe(true)
    await page.close()
  }, 120_000)
})

// ---------- Capas: las ventanas siempre por encima de Blockly ----------
type HoiWindow = {
  __hoiStore: Record<string, (...a: unknown[]) => unknown> & { get(): { project: unknown } }
}

/** Abre un proyecto con país y foco para que el editor de focos con Blockly se vea */
async function focusEditor(page: Page): Promise<void> {
  await page.evaluate(() => {
    const st = (window as unknown as HoiWindow).__hoiStore as never as {
      openInNewTab(p: unknown, f: null, r: string): void
    }
    const country = {
      uid: 'c1',
      mode: 'nuevo',
      tag: 'NVG',
      names: { name: 'Nueva Granada', def: 'Nueva Granada', adj: 'Granadino' },
      ideologyNames: {},
      color: [10, 100, 200],
      graphicalCulture: 'x',
      graphicalCulture2d: 'x',
      politics: {
        ruling: 'neutrality',
        popularities: { democratic: 0, communism: 0, fascism: 0, neutrality: 100 },
        electionsAllowed: false,
        electionFrequency: 48,
        lastElection: '1936.1.1',
        parties: {}
      },
      capital: null,
      flags: { main: null, byIdeology: {} },
      leaders: [],
      focusTreeId: 'arbol_1',
      existing: { renameInGame: false, historyFile: null, historyText: null, historyEdited: false }
    }
    st.openInNewTab(
      {
        version: 6,
        template: 'game',
        modName: 'Capas',
        tag: '',
        countries: [country],
        focusTrees: [{ id: 'arbol_1', name: 'Árbol' }],
        focuses: [
          {
            uid: 'f1',
            treeId: 'arbol_1',
            id: 'capas_NVG_uno',
            name: 'Uno',
            description: '',
            cost: 10,
            icon: { kind: 'game', gfx: 'GFX_goal_unknown' },
            iconAuto: false,
            x: 0,
            y: 0,
            prerequisites: [],
            mutuallyExclusive: [],
            blocks: null,
            scripts: { available: '', bypass: '', reward: '' }
          }
        ],
        ideas: [],
        icons: [],
        countryFlags: [],
        stateEdits: {},
        mapSettings: {
          base: 'game',
          mod: null,
          unpainted: 'keep',
          noNation: { tag: '', name: 'Sin nación', keepGameCores: false }
        }
      },
      null,
      'focos'
    )
  })
  await page.waitForSelector('.blocklyToolboxCategory', { timeout: 20000 })
}

describe('capas de las ventanas (parte 1)', () => {
  it('con la caja de Blockly abierta, la ventana del país queda por encima de todo', async ({
    skip
  }) => {
    if (!browser) skip()
    const page = await fresh()
    await focusEditor(page)
    await page.click('.blocklyToolboxCategory >> nth=0') // abre el flyout
    await page.waitForTimeout(400)
    await page.evaluate(() => {
      void (window as unknown as HoiWindow).__hoiStore.pickCountry(
        '¿De qué país es este árbol de focos?'
      )
    })
    await page.waitForSelector('text=¿De qué país es este árbol de focos?')
    await page.waitForTimeout(300)
    const r = await page.evaluate(() => {
      const win = document.querySelector('[data-window] > div') as HTMLElement
      const b = win.getBoundingClientRect()
      const pts: [number, number][] = []
      for (const fx of [0.05, 0.3, 0.5, 0.7, 0.95])
        for (const fy of [0.05, 0.3, 0.5, 0.8, 0.95])
          pts.push([b.left + b.width * fx, b.top + b.height * fy])
      const bad = pts.filter(([x, y]) => {
        const el = document.elementFromPoint(x, y)
        return (
          !el ||
          !el.closest('[data-window]') ||
          !!el.closest('.injectionDiv, .blocklyToolboxDiv, .blocklyFlyout')
        )
      })
      const flyout = document.querySelector('.blocklyFlyout') as HTMLElement | null
      const root = document.getElementById('root')!
      return {
        bad: bad.length,
        inert: root.hasAttribute('inert'),
        flyoutHidden:
          !flyout ||
          getComputedStyle(flyout).display === 'none' ||
          flyout.getBoundingClientRect().width === 0,
        inBody: win.parentElement === document.body || !!win.closest('body > *')
      }
    })
    expect(r.bad).toBe(0)
    expect(r.inert).toBe(true)
    expect(r.flyoutHidden).toBe(true)
    // Cerrar: se quita el inert
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => !document.getElementById('root')!.hasAttribute('inert'))
    await page.close()
  }, 120_000)

  it('las categorías del toolbox miden ~14 px', async ({ skip }) => {
    if (!browser) skip()
    const page = await fresh()
    await focusEditor(page)
    const sizes = await page.evaluate(() =>
      [...document.querySelectorAll('.blocklyToolboxCategoryLabel, .blocklyTreeLabel')].map((e) =>
        parseFloat(getComputedStyle(e).fontSize)
      )
    )
    expect(sizes.length).toBeGreaterThan(3)
    for (const s of sizes)
      (expect(s).toBeGreaterThanOrEqual(13.5), expect(s).toBeLessThanOrEqual(14.5))
    await page.close()
  }, 60_000)
})

describe('"En el mapa" solo con mis estados (partes 2 y 3)', () => {
  it('Lienzo en blanco + Sin nación sin pintar: el selector y la Paleta dicen (0) con el mensaje', async ({
    skip
  }) => {
    if (!browser) skip()
    const page = await fresh()
    await newProject(page, 'Vacío', 'Lienzo en blanco + Sin nación')
    await page.waitForSelector('text=En el mapa (0)')
    expect(
      await page
        .locator(
          'text=Todavía no hay países en tu mapa. Pinta estados o elige uno de la lista de abajo.'
        )
        .count()
    ).toBeGreaterThan(0)
    await page.evaluate(() => {
      void (window as unknown as HoiWindow).__hoiStore.pickCountry('Elegir')
    })
    await page.waitForSelector('[data-window] >> text=EN EL MAPA (0)')
    expect(
      await page.locator('[data-window] >> text=Todavía no hay países en tu mapa').count()
    ).toBe(1)
    await page.keyboard.press('Escape')
    await page.close()
  }, 60_000)
})

// ---------- Barras de desplazamiento de Blockly (arreglos) ----------
const visible = (page: Page, sel: string): Promise<{ n: number; shown: number }> =>
  page.evaluate((q) => {
    const els = [...document.querySelectorAll(q)] as HTMLElement[]
    return {
      n: els.length,
      shown: els.filter((e) => getComputedStyle(e).display !== 'none').length
    }
  }, sel)

const handleRect = (
  page: Page,
  sel: string
): Promise<{ x: number; y: number; w: number; h: number }> =>
  page.evaluate((q) => {
    const all = [...document.querySelectorAll(q)] as SVGElement[]
    // la del área de trabajo: la que NO es del flyout y está visible
    const el = all.find(
      (e) =>
        !e.classList.contains('blocklyFlyoutScrollbar') && getComputedStyle(e).display !== 'none'
    )!
    const r = el.querySelector('.blocklyScrollbarHandle')!.getBoundingClientRect()
    return { x: r.x, y: r.y, w: r.width, h: r.height }
  }, sel)

describe('barras de desplazamiento de Blockly', () => {
  it('al cerrar una categoría, la barra del flyout se oculta por completo', async ({ skip }) => {
    if (!browser) skip()
    const page = await fresh()
    await focusEditor(page)
    expect((await visible(page, '.blocklyFlyoutScrollbar')).shown).toBe(0)
    await page.click('.blocklyToolboxCategory >> nth=0')
    await page.waitForTimeout(400)
    expect((await visible(page, '.blocklyFlyoutScrollbar')).shown).toBeGreaterThan(0)
    // 1) clic en el área de trabajo
    await page.mouse.click(880, 620)
    await page.waitForTimeout(300)
    expect((await visible(page, '.blocklyFlyoutScrollbar')).shown).toBe(0)
    // 2) Esc
    await page.click('.blocklyToolboxCategory >> nth=1')
    await page.waitForTimeout(300)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    expect((await visible(page, '.blocklyFlyoutScrollbar')).shown).toBe(0)
    // 3) abrir una ventana con el flyout abierto
    await page.click('.blocklyToolboxCategory >> nth=0')
    await page.waitForTimeout(300)
    await page.evaluate(() => void (window as unknown as HoiWindow).__hoiStore.pickCountry('X'))
    await page.waitForSelector('[data-window]')
    expect((await visible(page, '.blocklyFlyoutScrollbar')).shown).toBe(0)
    await page.keyboard.press('Escape')
    await page.close()
  }, 120_000)

  it('las barras del área de trabajo se arrastran, también tras abrir y cerrar categorías y ventanas', async ({
    skip
  }) => {
    if (!browser) skip()
    const page = await fresh()
    await focusEditor(page)
    for (const round of [0, 1, 2]) {
      if (round === 1) {
        await page.click('.blocklyToolboxCategory >> nth=0')
        await page.waitForTimeout(300)
        await page.mouse.click(880, 620)
        await page.waitForTimeout(300)
      }
      if (round === 2) {
        await page.evaluate(() => void (window as unknown as HoiWindow).__hoiStore.pickCountry('X'))
        await page.waitForSelector('[data-window]')
        await page.keyboard.press('Escape')
        await page.waitForFunction(() => !document.getElementById('root')!.hasAttribute('inert'))
      }
      for (const [sel, axis] of [
        ['.blocklyScrollbarVertical', 'y'],
        ['.blocklyScrollbarHorizontal', 'x']
      ] as const) {
        const before = await handleRect(page, sel)
        const cx = before.x + before.w / 2
        const cy = before.y + before.h / 2
        // El punto del mouse debe caer en la barra (no en un elemento encima)
        const top = await page.evaluate(
          ([x, y]) => document.elementFromPoint(x, y)?.getAttribute('class') ?? '',
          [cx, cy]
        )
        expect(top, `${sel} ronda ${round}`).toContain('blocklyScrollbarHandle')
        await page.mouse.move(cx, cy)
        await page.mouse.down()
        // Se arrastra hacia el lado donde la barra tiene espacio (si no, ya estaría en su tope)
        const room = await page.evaluate(
          ([q, ax]) => {
            const el = [...document.querySelectorAll(q)].find(
              (e) =>
                !e.classList.contains('blocklyFlyoutScrollbar') &&
                getComputedStyle(e).display !== 'none'
            )!
            const t = el.getBoundingClientRect()
            const h = el.querySelector('.blocklyScrollbarHandle')!.getBoundingClientRect()
            return ax === 'y'
              ? [h.top - t.top, t.bottom - h.bottom]
              : [h.left - t.left, t.right - h.right]
          },
          [sel, axis]
        )
        const d = room[0] > room[1] ? -40 : 40
        await page.mouse.move(axis === 'y' ? cx : cx + d, axis === 'y' ? cy + d : cy, { steps: 6 })
        await page.mouse.up()
        const after = await handleRect(page, sel)
        expect(Math.abs(after[axis] - before[axis]), `${sel} ronda ${round}`).toBeGreaterThan(5)
      }
    }
    await page.close()
  }, 120_000)

  it('la rueda del mouse mueve el área de trabajo', async ({ skip }) => {
    if (!browser) skip()
    const page = await fresh()
    await focusEditor(page)
    const before = await handleRect(page, '.blocklyScrollbarVertical')
    await page.mouse.move(800, 600)
    await page.mouse.wheel(0, 120)
    await page.waitForTimeout(300)
    const after = await handleRect(page, '.blocklyScrollbarVertical')
    expect(Math.abs(after.y - before.y)).toBeGreaterThan(2)
    await page.close()
  }, 60_000)

  it('los controles de zoom, centrar y la papelera reciben los clics', async ({ skip }) => {
    if (!browser) skip()
    const page = await fresh()
    await focusEditor(page)
    // Posiciones de los controles respecto al área (las imágenes de Blockly son una hoja de
    // sprites recortada, por eso se mide desde el contenedor): centrar, acercar, alejar y papelera
    const bad = await page.evaluate(() => {
      const box = document.querySelector('.injectionDiv')!.getBoundingClientRect()
      const pts: [string, number, number, string][] = [
        ['centrar', box.right - 51, box.top + 34, '.blocklyZoomReset'],
        ['acercar', box.right - 51, box.top + 78, '.blocklyZoomIn'],
        ['alejar', box.right - 51, box.top + 111, '.blocklyZoomOut'],
        ['papelera', box.right - 59, box.bottom - 63, '.blocklyTrash']
      ]
      const out: string[] = []
      for (const [name, x, y, cls] of pts) {
        const hit = document.elementFromPoint(x, y)
        if (!hit || !hit.closest(cls))
          out.push(`${name}: ${hit?.getAttribute('class') ?? hit?.tagName}`)
      }
      return out
    })
    expect(bad).toEqual([])
    await page.close()
  }, 60_000)

  it('al cambiar el tamaño del contenedor se avisa a Blockly y las barras quedan dentro', async ({
    skip
  }) => {
    if (!browser) skip()
    const page = await fresh()
    await focusEditor(page)
    const resizes = (): Promise<number> =>
      page.evaluate(
        () => (window as unknown as { __hoiBlockly: { resizes: number } }).__hoiBlockly.resizes
      )
    const r0 = await resizes()
    await page.setViewportSize({ width: 1000, height: 640 })
    await page.waitForTimeout(500)
    expect(await resizes()).toBeGreaterThan(r0)
    const inside = await page.evaluate(() => {
      const box = document.querySelector('.injectionDiv')!.getBoundingClientRect()
      return ['.blocklyScrollbarVertical', '.blocklyScrollbarHorizontal'].every((s) => {
        const el = [...document.querySelectorAll(s)].find(
          (e) =>
            !e.classList.contains('blocklyFlyoutScrollbar') &&
            getComputedStyle(e).display !== 'none'
        )!
        const r = el.getBoundingClientRect()
        return (
          r.right <= box.right + 1 &&
          r.bottom <= box.bottom + 1 &&
          r.left >= box.left - 1 &&
          r.top >= box.top - 1
        )
      })
    })
    expect(inside).toBe(true)
    // Cambiar de pestaña de la cinta y volver también avisa
    const r1 = await resizes()
    await page.click('button:text-is("Países")')
    await page.click('button:text-is("Focos")')
    await page.waitForTimeout(400)
    expect(await resizes()).toBeGreaterThan(r1)
    await page.close()
  }, 120_000)
})

// ---------- Guardar: elegir dónde y ver la ruta ----------
/** App con una API de Electron de mentira que anota las llamadas */
async function withFakeApi(
  settings: Record<string, unknown> = {},
  modsRoot: string | null = null
): Promise<Page> {
  const page = await browser!.newPage({ viewport: { width: 1366, height: 768 } })
  await page.addInitScript(
    ([st, mr]) => {
      const calls: unknown[][] = []
      const w = window as unknown as Record<string, unknown>
      w.__calls = calls
      const rec =
        (name: string, ret?: unknown) =>
        async (...a: unknown[]) => {
          calls.push([name, ...a])
          return ret
        }
      w.electronAPI = {
        getSettings: async () => ({ gamePath: null, ...st }),
        setSettings: rec('setSettings'),
        detectGame: async () => ({ gamePath: null, auto: false, via: null }),
        getProjectsDir: async () => '/docs/HOI4 Mod Studio/Proyectos',
        getExportInfo: async () => ({
          modsDir: mr ?? 'C:/Users/yo/Documents/Paradox Interactive/Hearts of Iron IV/mod',
          docsFound: !!mr,
          defaultDir: '/desk/HOI4 Mod Studio - Exportados',
          lastDir: null,
          installedVersion: '1.14.*',
          fallbackVersion: '1.19.*'
        }),
        exportExists: async () => !!(window as unknown as Record<string, unknown>).__exists,
        exportMod: async (...a: unknown[]) => {
          calls.push(['exportMod', ...a])
          return { success: true, modFolder: '/desk/HOI4 Mod Studio - Exportados/mi_mod' }
        },
        selectFolder: async () => null,
        saveProjectDialog: async (_j: string, def: string) => {
          calls.push(['dialog', def])
          return def
        },
        saveProjectToPath: rec('saveToPath'),
        openFolder: rec('openFolder', true),
        onCloseRequest: () => () => {},
        onMapProgress: () => () => {}
      }
    },
    [settings, modsRoot] as const
  )
  await page.goto(url)
  await page.waitForSelector('text=Nuevo proyecto')
  return page
}
const calls = (page: Page): Promise<unknown[][]> =>
  page.evaluate(() => (window as unknown as { __calls: unknown[][] }).__calls)

describe('guardar: elegir dónde y ver la ruta (parte 2)', () => {
  it('la primera vez pregunta (con la carpeta por defecto), muestra la ruta y "Abrir carpeta"', async ({
    skip
  }) => {
    if (!browser) skip()
    const page = await withFakeApi({ askWhereToSave: false })
    await page.evaluate(() => {
      const st = (window as unknown as HoiWindow).__hoiStore as never as {
        openInNewTab(p: unknown, f: null, r: string): void
      }
      st.openInNewTab(
        {
          version: 6,
          template: 'game',
          modName: 'Mi Mod México',
          tag: '',
          countries: [],
          focusTrees: [],
          focuses: [],
          ideas: [],
          icons: [],
          countryFlags: [],
          stateEdits: {},
          mapSettings: {
            base: 'game',
            mod: null,
            unpainted: 'keep',
            noNation: { tag: '', name: 'x', keepGameCores: false }
          }
        },
        null,
        'mapa'
      )
    })
    await page.keyboard.press('Control+s')
    await page.waitForSelector('text=Proyecto guardado en')
    const c = await calls(page)
    expect(c.find((x) => x[0] === 'dialog')![1]).toBe(
      '/docs/HOI4 Mod Studio/Proyectos/mi_mod_mexico/proyecto.json'
    )
    expect(
      await page
        .locator('footer, div')
        .filter({ hasText: '/docs/HOI4 Mod Studio/Proyectos/mi_mod_mexico/proyecto.json' })
        .count()
    ).toBeGreaterThan(0)
    // ruta en la barra de estado y en el tooltip de la pestaña
    expect(
      await page
        .locator('[title="/docs/HOI4 Mod Studio/Proyectos/mi_mod_mexico/proyecto.json"]')
        .count()
    ).toBeGreaterThanOrEqual(2)
    await page.click('button:text-is("Abrir carpeta")')
    expect((await calls(page)).find((x) => x[0] === 'openFolder')![1]).toBe(
      '/docs/HOI4 Mod Studio/Proyectos/mi_mod_mexico'
    )
    // Ya tiene archivo y "Preguntar siempre" está apagado: Ctrl+S guarda directo
    await page.keyboard.press('Control+s')
    await page.waitForTimeout(300)
    const c2 = await calls(page)
    expect(c2.filter((x) => x[0] === 'dialog').length).toBe(1)
    expect(c2.some((x) => x[0] === 'saveToPath')).toBe(true)
    // Guardar como: SIEMPRE pregunta
    await page.keyboard.press('Control+Shift+s')
    await page.waitForTimeout(300)
    expect((await calls(page)).filter((x) => x[0] === 'dialog').length).toBe(2)
    await page.close()
  }, 60_000)

  it('con "Preguntar siempre" (activado por defecto) Ctrl+S abre el diálogo con la ubicación actual', async ({
    skip
  }) => {
    if (!browser) skip()
    const page = await withFakeApi({})
    await page.evaluate(() => {
      const st = (window as unknown as HoiWindow).__hoiStore as never as {
        openInNewTab(p: unknown, f: string, r: string): void
      }
      st.openInNewTab(
        {
          version: 6,
          template: 'game',
          modName: 'X',
          tag: '',
          countries: [],
          focusTrees: [],
          focuses: [],
          ideas: [],
          icons: [],
          countryFlags: [],
          stateEdits: {},
          mapSettings: {
            base: 'game',
            mod: null,
            unpainted: 'keep',
            noNation: { tag: '', name: 'x', keepGameCores: false }
          }
        },
        'D:/mis/proyectos/x/proyecto.json',
        'mapa'
      )
    })
    await page.keyboard.press('Control+s')
    await page.waitForSelector('text=Proyecto guardado en D:/mis/proyectos/x/proyecto.json')
    const c = await calls(page)
    expect(c.find((x) => x[0] === 'dialog')![1]).toBe('D:/mis/proyectos/x/proyecto.json')
    expect(c.some((x) => x[0] === 'saveToPath')).toBe(false)
    // Se puede apagar en Ajustes → General
    await page.click('button:text-is("Archivo")')
    await page.click('text=Ajustes…')
    await page.click('label:has-text("Preguntar siempre dónde guardar") input')
    expect(
      (await calls(page)).some(
        (x) =>
          x[0] === 'setSettings' && (x[1] as { askWhereToSave: boolean }).askWhereToSave === false
      )
    ).toBe(true)
    await page.close()
  }, 60_000)
})

describe('guardar no toca el juego; exportar a mano (parte 3)', () => {
  const open = (page: Page, focuses: unknown[]): Promise<void> =>
    page.evaluate(
      ([f, country]) => {
        const st = (window as unknown as HoiWindow).__hoiStore as never as {
          openInNewTab(p: unknown, f: string, r: string): void
        }
        st.openInNewTab(
          {
            version: 6,
            template: 'content',
            modName: 'Mi Mod',
            tag: '',
            countries: [country],
            focusTrees: [{ id: 'arbol_1', name: 'A' }],
            focuses: f,
            ideas: [],
            icons: [],
            countryFlags: [],
            stateEdits: {},
            mapSettings: {
              base: 'game',
              mod: null,
              unpainted: 'keep',
              noNation: { tag: '', name: 'x', keepGameCores: false }
            }
          },
          '/p/proyecto.json',
          'focos'
        )
      },
      [
        focuses,
        {
          ...newCountry({ mode: 'existente', tag: 'NVG', name: 'N' }),
          light: true,
          leaders: [],
          focusTreeId: 'arbol_1'
        }
      ] as const
    )
  const focus = (name: string): unknown => ({
    uid: 'f1',
    treeId: 'arbol_1',
    id: 'mi_mod_NVG_uno',
    name,
    description: '',
    cost: 10,
    icon: { kind: 'game', gfx: 'GFX_goal_unknown' },
    iconAuto: false,
    x: 0,
    y: 0,
    prerequisites: [],
    mutuallyExclusive: [],
    blocks: null,
    scripts: { available: '', bypass: '', reward: '' }
  })

  it('Guardar solo guarda el proyecto: no hay mod sincronizado ni aviso del juego abierto', async ({
    skip
  }) => {
    if (!browser) skip()
    const page = await withFakeApi({ askWhereToSave: false }, '/docs/hoi4/mod')
    await open(page, [focus('Uno')])
    await page.keyboard.press('Control+s')
    await page.waitForSelector('text=Proyecto guardado en')
    await page.waitForTimeout(500)
    const c = await calls(page)
    expect(c.some((x) => x[0] === 'saveToPath')).toBe(true)
    expect(c.some((x) => x[0] === 'exportMod')).toBe(false)
    expect(await page.locator('text=Mod actualizado en el juego').count()).toBe(0)
    expect(await page.locator('text=HOI4 está abierto').count()).toBe(0)
    await page.close()
  }, 60_000)

  it('Ctrl+E abre el diálogo con la carpeta del Escritorio y exporta con la versión del juego', async ({
    skip
  }) => {
    if (!browser) skip()
    const page = await withFakeApi({ askWhereToSave: false }, '/docs/hoi4/mod')
    await open(page, [focus('Uno')])
    await page.keyboard.press('Control+e')
    await page.click('button:text-is("Exportar de todos modos")') // avisos del validador
    await page.waitForSelector('text=Carpeta de destino')
    expect(await page.getByText('/desk/HOI4 Mod Studio - Exportados').count()).toBeGreaterThan(0)
    expect(await page.getByText('/docs/hoi4/mod').count()).toBeGreaterThan(0)
    await page.locator('button:text-is("Exportar")').last().click()
    await page.waitForSelector('text=Mod exportado en')
    const exp = (await calls(page)).find((x) => x[0] === 'exportMod')![1] as {
      exportPath: string
      gameModsDir: string
      supportedVersion: string
      replacePrevious: boolean
    }
    expect(exp.exportPath).toBe('/desk/HOI4 Mod Studio - Exportados')
    expect(exp.gameModsDir).toBe('/docs/hoi4/mod')
    expect(exp.supportedVersion).toBe('1.14.*')
    expect(exp.replacePrevious).toBe(false)
    const set = (await calls(page)).find(
      (x) => x[0] === 'setSettings' && (x[1] as Record<string, unknown>).lastExportDir
    )
    expect(set).toBeTruthy()
    await page.close()
  }, 60_000)

  it('si ya hay una exportación anterior pregunta si se reemplaza', async ({ skip }) => {
    if (!browser) skip()
    const page = await withFakeApi({ askWhereToSave: false }, '/docs/hoi4/mod')
    await page.evaluate(() => ((window as unknown as Record<string, unknown>).__exists = true))
    await open(page, [focus('Uno')])
    await page.keyboard.press('Control+e')
    await page.click('button:text-is("Exportar de todos modos")')
    await page.locator('button:text-is("Exportar")').last().click()
    await page.waitForSelector('text=¿Reemplazar la exportación anterior?')
    await page.click('button:text-is("Cancelar")')
    await page.waitForTimeout(300)
    expect((await calls(page)).some((x) => x[0] === 'exportMod')).toBe(false)
    await page.keyboard.press('Control+e')
    await page.click('button:text-is("Exportar de todos modos")')
    await page.locator('button:text-is("Exportar")').last().click()
    await page.click('button:text-is("Reemplazar")')
    await page.waitForSelector('text=Mod exportado en')
    const exp = (await calls(page)).find((x) => x[0] === 'exportMod')![1] as {
      replacePrevious: boolean
    }
    expect(exp.replacePrevious).toBe(true)
    await page.close()
  }, 60_000)
})

// ---------- Bloque único "Foco" (requisitos / saltar si / recompensa) ----------
describe('bloque único Foco en el editor', () => {
  it('Requisitos crece hacia abajo sin pisar "Saltar si"; la raíz no se borra; los sueltos no tocan', async () => {
    const page = await fresh()
    await focusEditor(page)
    await page.waitForFunction(
      () => !!(window as never as { __hoiBlockly: { ws?: unknown } }).__hoiBlockly.ws
    )
    const r = await page.evaluate(async () => {
      type W = {
        getBlocksByType(t: string, o: boolean): never[]
        getTopBlocks(o: boolean): never[]
      }
      const Bw = (window as never as { __hoiBlockly: { ws: W } }).__hoiBlockly
      const ws = Bw.ws as never as {
        newBlock(t: string): {
          initSvg(): void
          render(): void
          previousConnection: unknown
          nextConnection: unknown
          getInput(n: string): { connection: { connect(c: unknown): void } }
          moveBy(x: number, y: number): void
          getRelativeToSurfaceXY(): { x: number; y: number }
          getBoundingRectangle(): { top: number; bottom: number; left: number; right: number }
          isDeletable(): boolean
          type: string
        }
        getBlocksByType(t: string, o: boolean): never[]
      }
      const root = (
        ws.getBlocksByType('focus_root', false) as unknown as ReturnType<typeof ws.newBlock>[]
      )[0]
      const mk = (t: string): ReturnType<typeof ws.newBlock> => {
        const b = ws.newBlock(t)
        b.initSvg()
        b.render()
        return b
      }
      const not = mk('cond_not')
      root.getInput('AVAILABLE').connection.connect(not.previousConnection)
      const inner = mk('cond_has_war')
      not.getInput('CHILDREN').connection.connect(inner.previousConnection)
      const second = mk('cond_has_war')
      inner.nextConnection &&
        (inner.nextConnection as { connect(c: unknown): void }).connect(second.previousConnection)
      await new Promise((r) => setTimeout(r, 200))
      const all = document.querySelectorAll('.blocklyDraggable').length
      const box = (
        root as unknown as { getBoundingRectangle(): { top: number; bottom: number } }
      ).getBoundingRectangle()
      return {
        hasRoot: !!root,
        deletable: root.isDeletable(),
        all,
        top: box.top,
        bottom: box.bottom,
        slotTypes: ['slot_available', 'slot_bypass', 'slot_reward'].map(
          (t) => ws.getBlocksByType(t, false).length
        )
      }
    })
    expect(r.hasRoot).toBe(true)
    expect(r.deletable).toBe(false)
    expect(r.slotTypes).toEqual([0, 0, 0])
    // Las tres secciones viven dentro de UN bloque: el título "Saltar si" queda debajo de lo que
    // se añadió a Requisitos, no encima
    const pos = await page.evaluate(() => {
      const t = [...document.querySelectorAll('.blocklyText')].map((e) => ({
        text: (e.textContent ?? '').replace(/\u00a0/g, ' '),
        y: e.getBoundingClientRect().top
      }))
      const find = (s: string): number => {
        const f = t.find((x) => x.text.includes(s))
        if (!f) throw new Error(`sin texto ${s}: ${JSON.stringify(t.map((x) => x.text))}`)
        return f.y
      }
      const cond = [...document.querySelectorAll('.blocklyBlockCanvas .blocklyText')].filter((e) =>
        (e.textContent ?? '').includes('guerra')
      )
      return {
        req: find('Requisitos'),
        skip: find('Saltar si'),
        lastCond: Math.max(...cond.map((e) => e.getBoundingClientRect().bottom), 0),
        reward: find('Recompensa')
      }
    })
    expect(pos.skip).toBeGreaterThan(pos.lastCond - 2)
    expect(pos.reward).toBeGreaterThan(pos.skip)
    await page.close()
  }, 60_000)
})

// ---------- Tarjeta del país: capital de un país del juego ----------
describe('capital de un país del juego en la tarjeta', () => {
  it('muestra la capital del juego y avisa si ahora es de otro país', async ({ skip }) => {
    if (!browser) skip()
    const page = await fresh()
    const demoUrl = '/@fs' + path.resolve('src/shared/map/demo.ts')
    const r = await page.evaluate(async (url) => {
      const { generateDemoMap } = await new Function('u', 'return import(u)')(url)
      const map = generateDemoMap()
      const s = map.states[0]
      const other = map.states.find((x) => x.owner !== s.owner)!
      const st = (window as unknown as HoiWindow).__hoiStore as never as {
        openInNewTab(p: unknown, f: null, r: string): void
        set(p: unknown): void
      }
      st.openInNewTab(
        {
          version: 7,
          template: 'game',
          modName: 'Cap',
          tag: '',
          countries: [],
          focusTrees: [],
          focuses: [],
          ideas: [],
          icons: [],
          countryFlags: [],
          stateEdits: {},
          mapSettings: {
            base: 'game',
            mod: null,
            unpainted: 'keep',
            noNation: { tag: '', name: 'x', keepGameCores: false },
            moveLostCapitals: true,
            capitalChoices: {}
          }
        },
        null,
        'mapa'
      )
      st.set({
        map,
        game: { countries: [], countryCapitals: { [s.owner]: s.id } },
        activeTag: s.owner
      })
      return { tag: s.owner, id: s.id, name: s.name, otherOwner: other.owner }
    }, demoUrl)
    await page.waitForSelector(`text=${r.name} (#${r.id})`, { timeout: 10000 })
    expect(await page.locator('text=sin capital').count()).toBe(0)
    // Ahora el estado de la capital se pinta de otro país
    await page.evaluate(
      ([id, owner]) => {
        const st = (window as unknown as HoiWindow).__hoiStore as never as {
          updateProject(f: (p: Record<string, unknown>) => unknown): void
        }
        st.updateProject((p) => ({ ...p, stateEdits: { [id as number]: { owner } } }))
      },
      [r.id, r.otherOwner]
    )
    await page.waitForSelector('text=capital en territorio ajeno', { timeout: 10000 })
    await page.close()
  }, 60_000)
})
