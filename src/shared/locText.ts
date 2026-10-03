// Limpieza de textos de localización del juego para mostrarlos al usuario:
//  · $OTRA_CLAVE$ se sustituye por el texto de esa clave (recursivo, con límite)
//  · se quitan los códigos de color (§Y … §!)
//  · los textos dinámicos entre corchetes [ … ] se quitan
//  · nunca queda un "$…$" crudo

const MAX_DEPTH = 5

export function cleanLoc(raw: string, lookup: (key: string) => string | undefined, depth = 0): string {
  let s = raw
  // $CLAVE$ → texto de la clave
  s = s.replace(/\$([A-Za-z0-9_.\-']+)(?:\|[^$]*)?\$/g, (_, k: string) => {
    if (depth >= MAX_DEPTH) return ''
    const v = lookup(k)
    return v === undefined ? '' : cleanLoc(v, lookup, depth + 1)
  })
  // Códigos de color de Paradox: §Y, §R, §! …
  s = s.replace(/§[A-Za-z0-9!]/g, '')
  // Texto dinámico [Root.GetName] → fuera
  s = s.replace(/\[[^\]]*\]/g, '')
  // Saltos de línea escritos como \n
  s = s.replace(/\\n/g, ' ')
  return s.replace(/\s{2,}/g, ' ').trim()
}
