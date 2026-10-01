// Mide el motor en Chromium con un mapa SINTÉTICO del tamaño del real (5632×2048, ~1 300 estados).
// No hay HOI4 en esta computadora, así que NO son números del mapa real; y con SwiftShader el
// dibujo es por software (mucho más lento que una GPU). Uso: node scripts/bench-render.mjs
import { build } from 'esbuild'
import { chromium } from 'playwright-core'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const here = path.dirname(fileURLToPath(import.meta.url))
const out = await build({
  entryPoints: [path.join(here, 'bench-entry.ts')],
  bundle: true,
  format: 'iife',
  platform: 'browser',
  write: false,
  logLevel: 'silent'
})
let exe = process.env.HOI4_TEST_CHROMIUM
if (!exe) {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers'
  try {
    const d = fs
      .readdirSync(root)
      .filter((x) => x.startsWith('chromium-'))
      .sort()
      .reverse()[0]
    if (d) exe = path.join(root, d, 'chrome-linux', 'chrome')
  } catch {
    // sin carpeta de navegadores: se probará Edge o Chrome
  }
}
const args = [
  '--ignore-gpu-blocklist',
  '--enable-webgl',
  '--use-gl=angle',
  '--use-angle=swiftshader-webgl',
  '--enable-unsafe-swiftshader'
]
const browser = await chromium.launch(
  exe ? { executablePath: exe, args } : { channel: 'msedge', args }
)
const page = await browser.newPage()
await page.setContent('<!doctype html><html><body></body></html>')
await page.addScriptTag({ content: out.outputFiles[0].text })
const res = await page.evaluate(() => window.__bench())
console.log(JSON.stringify(res, null, 2))
await browser.close()
