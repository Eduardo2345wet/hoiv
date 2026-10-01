// Medidor de cuadros para el overlay F3: FPS reales mientras se mueve el mapa o se pinta.
// Si no se dibuja nada durante un rato (mapa quieto) no hay FPS que mostrar.

/** Se considera "quieto" si el último cuadro fue hace más de esto (ms) */
export const IDLE_MS = 500

export class FrameMeter {
  private times: number[] = []
  private costs: number[] = []
  private readonly keep: number
  constructor(keep = 90) {
    this.keep = keep
  }
  /** Registra un cuadro dibujado en `now` (ms) que tardó `cost` ms en enviarse a la GPU */
  frame(now: number, cost: number): void {
    this.times.push(now)
    this.costs.push(cost)
    if (this.times.length > this.keep) {
      this.times.shift()
      this.costs.shift()
    }
  }
  /** Cuadros por segundo entre los últimos cuadros; null si el mapa está quieto */
  fps(now: number): number | null {
    const n = this.times.length
    if (n < 2 || now - this.times[n - 1] > IDLE_MS) return null
    // Solo la racha continua más reciente (un hueco largo corta la cuenta)
    let start = n - 1
    while (start > 0 && this.times[start] - this.times[start - 1] < IDLE_MS) start--
    const span = this.times[n - 1] - this.times[start]
    return n - start < 2 || span <= 0 ? null : ((n - 1 - start) * 1000) / span
  }
  /** Promedio (ms) de lo que tarda cada llamada a dibujar */
  renderMs(): number {
    return this.costs.length ? this.costs.reduce((a, b) => a + b, 0) / this.costs.length : 0
  }
  /** El peor de los últimos cuadros (ms entre uno y otro) */
  worstGap(): number {
    let w = 0
    for (let i = 1; i < this.times.length; i++)
      if (this.times[i] - this.times[i - 1] < IDLE_MS)
        w = Math.max(w, this.times[i] - this.times[i - 1])
    return w
  }
}
