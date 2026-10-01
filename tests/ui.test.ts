// Pruebas de la interfaz tipo NX en un navegador real (servidor de Vite + Chromium/Edge).
// Sin navegador se saltan. La app corre sin Electron: sin carpeta del juego → mapa de demostración.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import path from 'path'
import react from '@vitejs/plugin-react'
import { createServer, type ViteDevServer } from 'vite'
import type { Browser, Page } from 'playwright-core'
import { launchBrowser } from './browser/launch'

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
  })

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
    await page.waitForSelector('text=Primero crea un país')
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
    expect(await page.locator('text=Deshacer').first().isDisabled()).toBe(true)
    await page.close()
  }, 120_000)
})
