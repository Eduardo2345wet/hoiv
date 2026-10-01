// Lanzar Chromium (o Edge/Chrome) para las pruebas con navegador; null si no hay ninguno
import fs from 'fs'
import path from 'path'
import { chromium, type Browser } from 'playwright-core'

export const GL_ARGS = [
  '--ignore-gpu-blocklist',
  '--enable-webgl',
  '--use-gl=angle',
  '--use-angle=swiftshader-webgl',
  '--enable-unsafe-swiftshader'
]

export function findChromium(): string | undefined {
  if (process.env.HOI4_TEST_CHROMIUM) return process.env.HOI4_TEST_CHROMIUM
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH ?? '/opt/pw-browsers'
  try {
    for (const d of fs
      .readdirSync(root)
      .filter((x) => x.startsWith('chromium-'))
      .sort()
      .reverse()) {
      const exe = path.join(root, d, 'chrome-linux', 'chrome')
      if (fs.existsSync(exe)) return exe
    }
  } catch {
    // sin carpeta de navegadores
  }
  return undefined
}

export async function launchBrowser(): Promise<Browser | null> {
  const exe = findChromium()
  const attempts = exe
    ? [{ executablePath: exe, args: GL_ARGS }]
    : [
        { channel: 'msedge', args: GL_ARGS },
        { channel: 'chrome', args: GL_ARGS }
      ]
  for (const a of attempts) {
    try {
      return await chromium.launch(a)
    } catch {
      // probar el siguiente
    }
  }
  return null
}
