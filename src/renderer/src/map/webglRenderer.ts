// Render del mapa con WebGL2 en dos pasadas:
//  1. RELLENO (pantalla completa): textura con el ID de provincia por píxel + texturas pequeñas
//     provincia→estado y estado→color. La costa se suaviza con 4 vecinos (borde antialias).
//  2. LÍNEAS (instanciadas): las fronteras vectoriales (polilíneas ya calculadas) como cápsulas
//     antialias de ANCHO CONSTANTE en pantalla. El color lo decide el shader según los dueños
//     actuales; pintar solo cambia texturas, la geometría no se toca.
// Todo respeta devicePixelRatio: la vista y los anchos van en píxeles CSS.
import type { MapData } from '../../../shared/map/types'
import { MAP_THEME, THEME_RGB, glslVec3 } from '../../../shared/map/theme'
import type { Palette } from './colors'
import { FLAG } from './colors'
import { buildSegmentBuffer, SEG_STRIDE, visibleTiles, type SegmentBuffer } from './borderGeometry'
import type { MapRenderer, RenderOptions, RendererOptions, View } from './renderer'

const ROW = 4096 // ancho de las texturas "1D"

const COMMON = `#version 300 es
precision highp float;
precision highp int;
precision highp usampler2D;
ivec2 row(uint i) { return ivec2(int(i % ${ROW}u), int(i / ${ROW}u)); }
`

// ---------------------------------------------------------------------------------------------
// Pasada 1: relleno
// ---------------------------------------------------------------------------------------------
const FILL_VS = `#version 300 es
in vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }`

const FILL_FS = `${COMMON}
uniform usampler2D uProv;      // ID de provincia por píxel
uniform usampler2D uProvSlot;  // provincia → posición de estado + 1 (0 = mar / lago)
uniform sampler2D uPal;        // estado → color (rgb) + banderas (a)
uniform vec2 uMapSize;
uniform vec2 uCanvas;          // píxeles del dispositivo
uniform vec3 uView;            // escala, x, y (píxeles del dispositivo)
uniform float uDpr;
uniform uint uHover;           // posición + 1 del estado bajo el cursor (0 = ninguno)
uniform bool uProvBorders;
out vec4 outColor;

const vec3 SEA = ${glslVec3(THEME_RGB.sea)};
const vec3 PROV_LINE = ${glslVec3(THEME_RGB.provinceBorder)};
const float PROV_W = ${MAP_THEME.width.provinceBorder.toFixed(3)};
const float HOVER_BRIGHTEN = ${MAP_THEME.hoverBrighten.toFixed(3)};
const float STRIPE_PERIOD = ${MAP_THEME.stripe.period.toFixed(3)};
const float STRIPE_THICK = ${MAP_THEME.stripe.thickness.toFixed(3)};
const float STRIPE_DARKEN = ${MAP_THEME.stripe.darken.toFixed(3)};

uint provAt(ivec2 p) {
  p = clamp(p, ivec2(0), ivec2(uMapSize) - 1);
  return texelFetch(uProv, p, 0).r;
}
uint slotOf(uint prov) { return texelFetch(uProvSlot, row(prov), 0).r; }
uint slotAt(ivec2 p) { return slotOf(provAt(p)); }

// Rayas diagonales suaves de grosor constante en pantalla (0–1)
float stripes(vec2 screen) {
  float u = (screen.x + screen.y) * 0.70710678;   // distancia perpendicular a las rayas
  float period = STRIPE_PERIOD * uDpr;
  float d = abs(mod(u, period) - period * 0.5);
  return clamp(STRIPE_THICK * uDpr * 0.5 - d + 0.5, 0.0, 1.0);
}

void main() {
  vec2 screen = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y);
  vec2 m = (screen - uView.yz) / uView.x;
  if (m.x < 0.0 || m.y < 0.0 || m.x >= uMapSize.x || m.y >= uMapSize.y) {
    outColor = vec4(SEA, 1.0);
    return;
  }

  // Costa suave: máscara tierra/mar de los 4 píxeles vecinos (bilineal) y su contorno en 0.5,
  // con un borde de ~1 píxel de pantalla (antialias a cualquier zoom).
  vec2 q = m - 0.5;
  ivec2 i0 = ivec2(floor(q));
  vec2 f = q - floor(q);
  uint s00 = slotAt(i0);
  uint s10 = slotAt(i0 + ivec2(1, 0));
  uint s01 = slotAt(i0 + ivec2(0, 1));
  uint s11 = slotAt(i0 + ivec2(1, 1));
  float w00 = (1.0 - f.x) * (1.0 - f.y);
  float w10 = f.x * (1.0 - f.y);
  float w01 = (1.0 - f.x) * f.y;
  float w11 = f.x * f.y;
  float land = (s00 != 0u ? w00 : 0.0) + (s10 != 0u ? w10 : 0.0)
             + (s01 != 0u ? w01 : 0.0) + (s11 != 0u ? w11 : 0.0);
  if (land <= 0.0) {
    outColor = vec4(SEA, 1.0);
    return;
  }
  // El píxel de tierra más cercano da el color (los colores NO se mezclan entre estados)
  uint slot = 0u;
  float best = -1.0;
  if (s00 != 0u && w00 > best) { best = w00; slot = s00; }
  if (s10 != 0u && w10 > best) { best = w10; slot = s10; }
  if (s01 != 0u && w01 > best) { best = w01; slot = s01; }
  if (s11 != 0u && w11 > best) { best = w11; slot = s11; }
  float aa = max(fwidth(land) * 0.75, 1e-4);
  float cover = smoothstep(0.5 - aa, 0.5 + aa, land);
  if (cover <= 0.0) {
    outColor = vec4(SEA, 1.0);
    return;
  }

  vec4 pal = texelFetch(uPal, row(slot - 1u), 0);
  uint flags = uint(pal.a * 255.0 + 0.5);
  vec3 col = pal.rgb;
  if ((flags & ${FLAG.highlight}u) != 0u)                                   // pendiente: rayas suaves
    col = mix(col, vec3(0.96, 0.72, 0.24), stripes(screen) * 0.65);
  if ((flags & ${FLAG.striped}u) != 0u) col *= 1.0 - STRIPE_DARKEN * stripes(screen);
  if ((flags & ${FLAG.selected}u) != 0u) col = mix(col, vec3(1.0, 0.85, 0.4), 0.35);
  if (slot == uHover) col = mix(col, vec3(1.0), HOVER_BRIGHTEN);

  // Fronteras de provincia (solo con el interruptor): 0.5 px, dentro del mismo estado
  if (uProvBorders) {
    ivec2 p = ivec2(floor(m));
    uint prov = provAt(p);
    if (slotOf(prov) == slot) {
      vec2 fr = fract(m);
      float widthDev = PROV_W * uDpr;
      float cov = 0.0;
      ivec2 dirs[4] = ivec2[4](ivec2(-1, 0), ivec2(1, 0), ivec2(0, -1), ivec2(0, 1));
      float dist[4] = float[4](fr.x, 1.0 - fr.x, fr.y, 1.0 - fr.y);
      for (int k = 0; k < 4; k++) {
        uint np = provAt(p + dirs[k]);
        if (np != prov && slotOf(np) == slot) {
          float dd = dist[k] * uView.x;
          cov = max(cov, clamp(widthDev * 0.5 + 0.5 - dd, 0.0, min(1.0, widthDev)));
        }
      }
      col = mix(col, PROV_LINE, cov);
    }
  }
  outColor = vec4(mix(SEA, col, cover), 1.0);
}`

// ---------------------------------------------------------------------------------------------
// Pasada 2: líneas (una cápsula por segmento de polilínea)
// ---------------------------------------------------------------------------------------------
const LINE_VS = `${COMMON}
in vec4 aSeg;        // x0 y0 x1 y1 en píxeles del mapa
in uvec2 aSlots;     // posición + 1 del estado A (0 = costa) y del B
uniform sampler2D uPal;
uniform usampler2D uOwner;   // posición de estado → índice del dueño (0 = sin pintar)
uniform vec3 uView;          // escala, x, y (píxeles del dispositivo)
uniform vec2 uCanvas;
uniform float uDpr;
uniform int uPass;           // 0 fronteras, 1 contorno del país activo, 2 contorno bajo el cursor
uniform uint uHover;
flat out vec4 vSeg;          // extremos en píxeles del dispositivo
flat out vec4 vStyle;        // rgb + medio ancho

const vec3 STATE_LINE = ${glslVec3(THEME_RGB.stateBorder)};
const vec3 COUNTRY_LINE = ${glslVec3(THEME_RGB.countryBorder)};
const vec3 ACTIVE_LINE = ${glslVec3(THEME_RGB.activeContour)};
const vec3 HOVER_LINE = ${glslVec3(THEME_RGB.hoverContour)};

void main() {
  uint sa = aSlots.x;
  uint sb = aSlots.y;
  vec3 col = vec3(0.0);
  float wcss = 0.0;   // ancho en píxeles CSS (0 = no se dibuja)
  if (uPass == 0) {
    // La costa (sa == 0) no lleva línea: solo el cambio de color suavizado del relleno
    if (sa != 0u && sb != 0u) {
      uint oa = texelFetch(uOwner, row(sa - 1u), 0).r;
      uint ob = texelFetch(uOwner, row(sb - 1u), 0).r;
      bool country = oa != 0u && ob != 0u && oa != ob;
      col = country ? COUNTRY_LINE : STATE_LINE;
      wcss = country ? ${MAP_THEME.width.countryBorder.toFixed(3)} : ${MAP_THEME.width.stateBorder.toFixed(3)};
    }
  } else if (uPass == 1) {
    uint fa = sa == 0u ? 0u : uint(texelFetch(uPal, row(sa - 1u), 0).a * 255.0 + 0.5);
    uint fb = sb == 0u ? 0u : uint(texelFetch(uPal, row(sb - 1u), 0).a * 255.0 + 0.5);
    if (((fa ^ fb) & ${FLAG.active}u) != 0u) {
      col = ACTIVE_LINE;
      wcss = ${MAP_THEME.width.activeContour.toFixed(3)};
    }
  } else if (uHover != 0u && (sa == uHover || sb == uHover)) {
    col = HOVER_LINE;
    wcss = ${MAP_THEME.width.hoverContour.toFixed(3)};
  }
  if (wcss == 0.0) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);   // fuera de la pantalla: no se dibuja
    return;
  }
  vec2 p0 = aSeg.xy * uView.x + uView.yz;
  vec2 p1 = aSeg.zw * uView.x + uView.yz;
  float hw = wcss * uDpr * 0.5;
  float ext = hw + 1.0;                                // + margen para el antialias
  vec2 d = p1 - p0;
  float len = length(d);
  vec2 t = len > 1e-5 ? d / len : vec2(1.0, 0.0);
  vec2 n = vec2(-t.y, t.x);
  vec2 c = vec2(float(gl_VertexID & 1), float((gl_VertexID >> 1) & 1));
  vec2 pos = mix(p0, p1, c.x) + t * (c.x * 2.0 - 1.0) * ext + n * (c.y * 2.0 - 1.0) * ext;
  vSeg = vec4(p0, p1);
  vStyle = vec4(col, hw);
  gl_Position = vec4(pos.x / uCanvas.x * 2.0 - 1.0, 1.0 - pos.y / uCanvas.y * 2.0, 0.0, 1.0);
}`

const LINE_FS = `${COMMON}
uniform vec2 uCanvas;
flat in vec4 vSeg;
flat in vec4 vStyle;
out vec4 outColor;
void main() {
  vec2 p = vec2(gl_FragCoord.x, uCanvas.y - gl_FragCoord.y);
  vec2 a = vSeg.xy;
  vec2 ab = vSeg.zw - a;
  float t = clamp(dot(p - a, ab) / max(dot(ab, ab), 1e-6), 0.0, 1.0);
  float d = length(p - a - ab * t);
  float hw = vStyle.w;
  // Cobertura del píxel; las líneas más finas que 1 píxel quedan tenues (área real)
  float cov = clamp(hw + 0.5 - d, 0.0, min(1.0, 2.0 * hw));
  if (cov <= 0.0) discard;
  outColor = vec4(vStyle.rgb * cov, cov);   // alfa premultiplicado
}`

function compile(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const s = gl.createShader(type)!
  gl.shaderSource(s, src)
  gl.compileShader(s)
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
    throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
  return s
}

function link(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const prog = gl.createProgram()!
  gl.attachShader(prog, compile(gl, gl.VERTEX_SHADER, vs))
  gl.attachShader(prog, compile(gl, gl.FRAGMENT_SHADER, fs))
  gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS))
    throw new Error(gl.getProgramInfoLog(prog) ?? 'link')
  return prog
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

export function createWebGLRenderer(
  canvas: HTMLCanvasElement,
  map: MapData,
  options: RendererOptions = {}
): MapRenderer | null {
  const gl = canvas.getContext('webgl2', {
    antialias: false,
    preserveDrawingBuffer: !!options.preserveDrawingBuffer
  })
  if (!gl) return null
  if (
    map.width > gl.getParameter(gl.MAX_TEXTURE_SIZE) ||
    map.height > gl.getParameter(gl.MAX_TEXTURE_SIZE)
  )
    return null
  let fillProg: WebGLProgram
  let lineProg: WebGLProgram
  try {
    fillProg = link(gl, FILL_VS, FILL_FS)
    lineProg = link(gl, LINE_VS, LINE_FS)
  } catch (e) {
    console.warn('WebGL2: error al compilar los shaders; se usa Canvas 2D.', e)
    return null
  }
  gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)

  // ---- Texturas (compartidas por las dos pasadas) ----
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

  // provincia → posición de estado + 1
  const slotOfState = new Map(map.states.map((s, i) => [s.id, i + 1]))
  const provSlot = new Uint16Array(map.provinceToState.length)
  map.provinceToState.forEach((st, prov) => (provSlot[prov] = st ? (slotOfState.get(st) ?? 0) : 0))
  gl.activeTexture(gl.TEXTURE1)
  uintTexture(gl, provSlot)
  // (la unidad 2 queda libre)

  const palRows = Math.max(1, Math.ceil(map.states.length / ROW))
  gl.activeTexture(gl.TEXTURE3)
  const palTex = gl.createTexture()!
  gl.bindTexture(gl.TEXTURE_2D, palTex)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, ROW, palRows, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  for (const p of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER])
    gl.texParameteri(gl.TEXTURE_2D, p, gl.NEAREST)
  gl.activeTexture(gl.TEXTURE4)
  let ownerTex = uintTexture(gl, new Uint16Array(map.states.length))

  // ---- Pantalla completa (relleno) ----
  const quad = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, quad)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const fillVao = gl.createVertexArray()!
  gl.bindVertexArray(fillVao)
  const aPos = gl.getAttribLocation(fillProg, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  // ---- Segmentos de las fronteras (una sola vez) ----
  const seg: SegmentBuffer = buildSegmentBuffer(map.borders, slotOfState, map.width, map.height)
  const segBuf = gl.createBuffer()!
  gl.bindBuffer(gl.ARRAY_BUFFER, segBuf)
  gl.bufferData(gl.ARRAY_BUFFER, seg.data, gl.STATIC_DRAW)
  const lineVao = gl.createVertexArray()!
  gl.bindVertexArray(lineVao)
  const aSeg = gl.getAttribLocation(lineProg, 'aSeg')
  const aSlots = gl.getAttribLocation(lineProg, 'aSlots')
  const pointAt = (first: number): void => {
    gl.bindBuffer(gl.ARRAY_BUFFER, segBuf)
    gl.enableVertexAttribArray(aSeg)
    gl.vertexAttribPointer(aSeg, 4, gl.FLOAT, false, SEG_STRIDE, first * SEG_STRIDE)
    gl.vertexAttribDivisor(aSeg, 1)
    gl.enableVertexAttribArray(aSlots)
    gl.vertexAttribIPointer(aSlots, 2, gl.UNSIGNED_SHORT, SEG_STRIDE, first * SEG_STRIDE + 16)
    gl.vertexAttribDivisor(aSlots, 1)
  }

  const uni = (p: WebGLProgram, n: string): WebGLUniformLocation | null =>
    gl.getUniformLocation(p, n)
  gl.useProgram(fillProg)
  gl.uniform1i(uni(fillProg, 'uProv'), 0)
  gl.uniform1i(uni(fillProg, 'uProvSlot'), 1)
  gl.uniform1i(uni(fillProg, 'uPal'), 3)
  gl.uniform2f(uni(fillProg, 'uMapSize'), map.width, map.height)
  const f = {
    canvas: uni(fillProg, 'uCanvas'),
    view: uni(fillProg, 'uView'),
    dpr: uni(fillProg, 'uDpr'),
    hover: uni(fillProg, 'uHover'),
    prov: uni(fillProg, 'uProvBorders')
  }
  gl.useProgram(lineProg)
  gl.uniform1i(uni(lineProg, 'uPal'), 3)
  gl.uniform1i(uni(lineProg, 'uOwner'), 4)
  const l = {
    canvas: uni(lineProg, 'uCanvas'),
    view: uni(lineProg, 'uView'),
    dpr: uni(lineProg, 'uDpr'),
    pass: uni(lineProg, 'uPass'),
    hover: uni(lineProg, 'uHover')
  }

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
    render(view: View, width: number, height: number, opts: RenderOptions) {
      const dpr = opts.dpr || 1
      const scale = view.scale * dpr
      const vx = view.x * dpr
      const vy = view.y * dpr
      const hover = opts.hoverStateId ? (slotOfState.get(opts.hoverStateId) ?? 0) : 0
      gl.viewport(0, 0, width, height)
      gl.disable(gl.BLEND)

      // 1. Relleno
      gl.useProgram(fillProg)
      gl.bindVertexArray(fillVao)
      gl.uniform2f(f.canvas, width, height)
      gl.uniform3f(f.view, scale, vx, vy)
      gl.uniform1f(f.dpr, dpr)
      gl.uniform1ui(f.hover, hover)
      gl.uniform1i(f.prov, opts.provinceBorders ? 1 : 0)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)

      // 2. Líneas: solo las baldosas que se ven
      gl.useProgram(lineProg)
      gl.bindVertexArray(lineVao)
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      gl.uniform2f(l.canvas, width, height)
      gl.uniform3f(l.view, scale, vx, vy)
      gl.uniform1f(l.dpr, dpr)
      gl.uniform1ui(l.hover, hover)
      const margin = (MAP_THEME.width.countryBorder * dpr) / scale + 2 / scale
      const tiles = visibleTiles(
        seg.tiles,
        -vx / scale,
        -vy / scale,
        (width - vx) / scale,
        (height - vy) / scale,
        margin
      )
      const passes = [0]
      if (opts.activeContour) passes.push(1)
      if (hover) passes.push(2)
      for (const pass of passes) {
        gl.uniform1i(l.pass, pass)
        for (const t of tiles) {
          pointAt(t.start)
          gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, t.count)
        }
      }
      gl.disable(gl.BLEND)
    },
    destroy() {
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }
}
