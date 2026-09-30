// Render del mapa con WebGL2: una textura con el ID de provincia por píxel y texturas
// pequeñas provincia→estado y estado→color. Cambiar un dueño = actualizar unos texels.
// Las fronteras (de estado finas, de país gruesas) se calculan en el shader.
import type { MapData } from '../../../shared/map/types'
import { PROVINCE_TYPE } from '../../../shared/map/types'
import type { Palette } from './colors'
import type { MapRenderer, View } from './renderer'

const ROW = 4096 // ancho de las texturas "1D"

const VS = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`

const FS = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
uniform usampler2D uProv;      // ID de provincia por píxel
uniform usampler2D uProvSlot;  // provincia → posición de estado + 1 (0 = sin estado)
uniform usampler2D uProvType;  // provincia → tipo (1 tierra, 2 mar, 3 lago)
uniform sampler2D uPal;        // estado → color (rgb) + banderas (a)
uniform usampler2D uOwner;     // estado → índice del dueño
uniform vec2 uMapSize;
uniform vec2 uCanvas;
uniform vec3 uView;            // scale, x, y
out vec4 outColor;

ivec2 row(uint i) { return ivec2(int(i % ${ROW}u), int(i / ${ROW}u)); }
uint provAt(ivec2 p) {
  p = clamp(p, ivec2(0), ivec2(uMapSize) - 1);
  return texelFetch(uProv, p, 0).r;
}
uint slotOf(uint prov) { return texelFetch(uProvSlot, row(prov), 0).r; }
uint ownerOf(uint slot) { return slot == 0u ? 0u : texelFetch(uOwner, row(slot - 1u), 0).r; }

void main() {
  vec2 screen = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y);
  vec2 m = (screen - uView.yz) / uView.x;
  if (m.x < 0.0 || m.y < 0.0 || m.x >= uMapSize.x || m.y >= uMapSize.y) {
    outColor = vec4(0.07, 0.07, 0.08, 1.0);
    return;
  }
  ivec2 p = ivec2(floor(m));
  uint prov = provAt(p);
  uint slot = slotOf(prov);
  if (slot == 0u) {
    uint t = texelFetch(uProvType, row(prov), 0).r;
    outColor = t == 3u ? vec4(0.16, 0.27, 0.40, 1.0) : vec4(0.09, 0.15, 0.25, 1.0);
    return;
  }
  vec4 pal = texelFetch(uPal, row(slot - 1u), 0);
  uint flags = uint(pal.a * 255.0 + 0.5);
  vec3 col = pal.rgb;
  if ((flags & 8u) != 0u) col *= 0.62;              // otros países, apagados
  if ((flags & 4u) != 0u) col = mix(col, vec3(1.0), 0.35); // estado seleccionado

  // Fronteras: una línea de 1 px de pantalla (estado) o 2 px (país) en el borde del píxel
  vec2 f = fract(m);
  float ws = min(0.5, 1.0 / uView.x);
  float wc = min(0.5, 2.0 / uView.x);
  uint owner = ownerOf(slot);
  bool activeHere = (flags & 1u) != 0u;
  float stateB = 0.0;
  float countryB = 0.0;
  float activeB = 0.0;
  ivec2 dirs[4] = ivec2[4](ivec2(-1, 0), ivec2(1, 0), ivec2(0, -1), ivec2(0, 1));
  float dist[4] = float[4](f.x, 1.0 - f.x, f.y, 1.0 - f.y);
  for (int k = 0; k < 4; k++) {
    uint ns = slotOf(provAt(p + dirs[k]));
    if (ns == slot) continue;
    uint no = ownerOf(ns);
    if (dist[k] < ws) stateB = 1.0;
    if (no != owner && dist[k] < wc) countryB = 1.0;
    if (activeHere && ns != 0u) {
      vec4 np = texelFetch(uPal, row(ns - 1u), 0);
      bool nActive = (uint(np.a * 255.0 + 0.5) & 1u) != 0u;
      if (!nActive && dist[k] < wc) activeB = 1.0;
    } else if (activeHere && ns == 0u && dist[k] < wc) activeB = 1.0;
  }
  col = mix(col, col * 0.55, stateB);
  col = mix(col, vec3(0.05), countryB);
  col = mix(col, vec3(1.0, 0.75, 0.2), activeB);   // contorno ámbar del país activo
  outColor = vec4(col, 1.0);
}`

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
  return s
}

/** Arreglo "1D" de enteros a textura R16UI de ROW columnas */
function uintTexture(gl: WebGL2RenderingContext, data: Uint16Array): WebGLTexture {
  const rows = Math.max(1, Math.ceil(data.length / ROW))
  const padded = new Uint16Array(rows * ROW)
  padded.set(data)
  const t = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, t)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.R16UI, ROW, rows, 0, gl.RED_INTEGER, gl.UNSIGNED_SHORT, padded)
  for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER])
    gl.texParameteri(gl.TEXTURE_2D, p, gl.NEAREST)
  return t
}

export function createWebGLRenderer(canvas: HTMLCanvasElement, map: MapData): MapRenderer | null {
  const gl = canvas.getContext('webgl2', { antialias: false, preserveDrawingBuffer: false })
  if (!gl) return null
  if (
    map.width > gl.getParameter(gl.MAX_TEXTURE_SIZE) ||
    map.height > gl.getParameter(gl.MAX_TEXTURE_SIZE)
  )
    return null
  let prog: WebGLProgram
  try {
    prog = gl.createProgram()!
    gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, VS))
    gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, FS))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.warn('WebGL2: no se pudo enlazar el programa', gl.getProgramInfoLog(prog))
      return null
    }
  } catch (e) {
    console.warn('WebGL2: error al compilar el shader; se usa Canvas 2D.', e)
    return null
  }
  gl.useProgram(prog)
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)

  const buf = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buf)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const loc = gl.getAttribLocation(prog, 'aPos')
  gl.enableVertexAttribArray(loc)
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)

  // Textura de provincias por píxel
  const provTex = gl.createTexture()!
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, provTex)
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.R16UI,
    map.width,
    map.height,
    0,
    gl.RED_INTEGER,
    gl.UNSIGNED_SHORT,
    map.provinceIndex
  )
  for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER])
    gl.texParameteri(gl.TEXTURE_2D, p, gl.NEAREST)

  // provincia → posición de estado + 1, y provincia → tipo
  const slotOfState = new Map(map.states.map((s, i) => [s.id, i + 1]))
  const provSlot = new Uint16Array(map.provinceToState.length)
  map.provinceToState.forEach((st, prov) => (provSlot[prov] = st ? (slotOfState.get(st) ?? 0) : 0))
  gl.activeTexture(gl.TEXTURE1)
  uintTexture(gl, provSlot)
  gl.activeTexture(gl.TEXTURE2)
  const types = new Uint16Array(map.provinceType.length)
  map.provinceType.forEach((t, i) => (types[i] = t === PROVINCE_TYPE.none ? PROVINCE_TYPE.sea : t))
  uintTexture(gl, types)

  // Paleta (se actualiza) y dueños
  const palRows = Math.max(1, Math.ceil(map.states.length / ROW))
  gl.activeTexture(gl.TEXTURE3)
  const palTex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, palTex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, ROW, palRows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER])
    gl.texParameteri(gl.TEXTURE_2D, p, gl.NEAREST)
  gl.activeTexture(gl.TEXTURE4)
  let ownerTex = uintTexture(gl, new Uint16Array(map.states.length))

  const u = (n: string): WebGLUniformLocation | null => gl.getUniformLocation(prog, n)
  gl.uniform1i(u('uProv'), 0)
  gl.uniform1i(u('uProvSlot'), 1)
  gl.uniform1i(u('uProvType'), 2)
  gl.uniform1i(u('uPal'), 3)
  gl.uniform1i(u('uOwner'), 4)
  gl.uniform2f(u('uMapSize'), map.width, map.height)
  const uCanvas = u('uCanvas')
  const uView = u('uView')

  return {
    kind: 'webgl2',
    setPalette(p: Palette) {
      const padded = new Uint8Array(palRows * ROW * 4)
      padded.set(p.rgba)
      gl.activeTexture(gl.TEXTURE3)
      gl.bindTexture(gl.TEXTURE_2D, palTex)
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, ROW, palRows, gl.RGBA, gl.UNSIGNED_BYTE, padded)
      gl.activeTexture(gl.TEXTURE4)
      gl.deleteTexture(ownerTex)
      ownerTex = uintTexture(gl, p.owners)
    },
    render(view: View, width: number, height: number) {
      gl.viewport(0, 0, width, height)
      gl.uniform2f(uCanvas, width, height)
      gl.uniform3f(uView, view.scale, view.x, view.y)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    },
    destroy() {
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }
}
