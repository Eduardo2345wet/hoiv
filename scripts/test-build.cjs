// Prueba el bundle COMPILADO (out/main/index.js), no el código fuente: jomini con su .wasm y
// una carga completa del mapa con una carpeta de juego falsa. Uso: npm run test:build
const Module = require('module')
const fs = require('fs')
const os = require('os')
const path = require('path')
const assert = require('assert')

// "electron" no existe fuera de la app: un objeto que acepta cualquier llamada
const noop = new Proxy(function () {}, {
  get: () => noop,
  apply: () => noop
})
const load = Module._load
Module._load = function (req, ...rest) {
  return req === 'electron' ? noop : load.call(this, req, ...rest)
}
process.env.HOI4_BUNDLE_TEST = '1'
const bundle = path.join(__dirname, '..', 'out', 'main', 'index.js')
assert(fs.existsSync(bundle), 'Falta out/main/index.js: ejecuta npm run build antes')
require(bundle)
const core = globalThis.__hoi4Core
assert(core, 'El bundle no expuso getJomini/loadRealMap')

function bmp24(w, h, rgb) {
  const row = Math.ceil((w * 3) / 4) * 4
  const buf = Buffer.alloc(54 + row * h)
  buf.write('BM'); buf.writeUInt32LE(buf.length, 2); buf.writeUInt32LE(54, 10)
  buf.writeUInt32LE(40, 14); buf.writeInt32LE(w, 18); buf.writeInt32LE(h, 22)
  buf.writeUInt16LE(1, 26); buf.writeUInt16LE(24, 28)
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const [r, g, b] = rgb[y * w + x]
      const o = 54 + (h - 1 - y) * row + x * 3
      buf[o] = b; buf[o + 1] = g; buf[o + 2] = r
    }
  return buf
}

;(async () => {
  // 1. jomini (con el .wasm) en el bundle, y una sola inicialización
  const j = await core.getJomini()
  assert.strictEqual(await core.getJomini(), j, 'jomini debe ser un singleton')
  const p = j.parseText('state = { id = 1 history = { owner = MEX } provinces = { 1 2 } }')
  assert.strictEqual(p.state.id, 1)
  assert.strictEqual(p.state.history.owner, 'MEX')
  assert.deepStrictEqual(p.state.provinces, [1, 2])
  console.log('OK jomini en el bundle')

  // 2. carga completa del mapa con una carpeta de juego falsa
  const game = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi4-bundle-'))
  const w = (rel, data) => {
    fs.mkdirSync(path.dirname(path.join(game, rel)), { recursive: true })
    fs.writeFileSync(path.join(game, rel), data)
  }
  const px = []
  for (let i = 0; i < 8; i++) px.push(i % 4 < 2 ? [10, 0, 0] : [20, 0, 0])
  w('map/provinces.bmp', bmp24(4, 2, px))
  w('map/definition.csv', '0;0;0;0;land;false;unknown;0\n1;10;0;0;land;false;plains;1\n2;20;0;0;land;false;plains;1\n')
  w('history/states/1-A.txt', 'state = { id = 1 provinces = { 1 } history = { owner = GER add_core_of = GER } }\n')
  w('history/states/2-B.txt', 'state = { id = 2 provinces = { 2 } history = { owner = FRA } }\n')
  const cache = fs.mkdtempSync(path.join(os.tmpdir(), 'hoi4-cache-'))
  const map = await core.loadRealMap(game, cache, () => {}, null)
  assert.strictEqual(map.source, 'real')
  assert.deepStrictEqual(map.states.map((s) => [s.id, s.owner]), [[1, 'GER'], [2, 'FRA']])
  console.log('OK mapa real cargado con el bundle:', map.states.length, 'estados')
  process.exit(0)
})().catch((e) => { console.error('FALLÓ:', e); process.exit(1) })
