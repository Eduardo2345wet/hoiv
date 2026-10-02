// Memoria del mapa en la interfaz: texturas WebGL y si están liberadas (overlay F3 y pruebas).
export const mapMem = { textureBytes: 0, released: false, renderers: 0 }
if (
  typeof window !== 'undefined' &&
  (import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV
)
  (window as unknown as { __hoiMapMem: typeof mapMem }).__hoiMapMem = mapMem
