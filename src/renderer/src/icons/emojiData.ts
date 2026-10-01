// Emojis del selector (por categoría, con palabras de búsqueda en español)
// y la regla para elegir uno automáticamente según el nombre.

export interface EmojiEntry {
  emoji: string
  words: string
}
export interface EmojiCategory {
  name: string
  items: EmojiEntry[]
}

const e = (emoji: string, words: string): EmojiEntry => ({ emoji, words })

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: 'Industria',
    items: [
      e('🏭', 'fabrica industria produccion'),
      e('⚙️', 'engranaje maquina produccion'),
      e('🔧', 'herramienta llave reparar'),
      e('🏗️', 'construccion obra grua'),
      e('⛏️', 'mineria pico recursos acero'),
      e('🛢️', 'petroleo barril recursos'),
      e('⚡', 'energia electricidad rayo')
    ]
  },
  {
    name: 'Ejército',
    items: [
      e('🪖', 'ejercito casco soldado tropas infanteria'),
      e('🎖️', 'medalla condecoracion honor'),
      e('🔫', 'arma pistola fusil'),
      e('🚚', 'camion motorizado logistica'),
      e('🏹', 'arco tiro'),
      e('🗡️', 'daga espada')
    ]
  },
  {
    name: 'Marina',
    items: [
      e('⚓', 'ancla marina puerto naval flota'),
      e('🚢', 'barco buque flota naval'),
      e('⛴️', 'ferry barco transporte'),
      e('🌊', 'mar ola oceano'),
      e('🧭', 'brujula navegacion')
    ]
  },
  {
    name: 'Aviación',
    items: [
      e('✈️', 'avion aviacion aire'),
      e('🛩️', 'avioneta aviacion caza'),
      e('🪂', 'paracaidas paracaidistas'),
      e('🚁', 'helicoptero aire'),
      e('🛫', 'despegue aeropuerto base aerea')
    ]
  },
  {
    name: 'Política',
    items: [
      e('🏛️', 'gobierno politica parlamento congreso'),
      e('📜', 'ley decreto pergamino constitucion'),
      e('🗳️', 'elecciones voto urna democracia'),
      e('👑', 'rey corona monarquia'),
      e('⚖️', 'justicia balanza ley'),
      e('📢', 'propaganda megafono'),
      e('🚩', 'bandera roja comunismo'),
      e('🏴', 'bandera negra')
    ]
  },
  {
    name: 'Economía',
    items: [
      e('💰', 'dinero economia bolsa'),
      e('📈', 'crecimiento grafico subir economia'),
      e('🏦', 'banco finanzas'),
      e('💵', 'billete dinero dolar'),
      e('🪙', 'moneda dinero'),
      e('📦', 'comercio caja exportar')
    ]
  },
  {
    name: 'Ciencia',
    items: [
      e('🔬', 'ciencia microscopio investigacion'),
      e('🧪', 'quimica laboratorio experimento'),
      e('💡', 'idea bombilla invento tecnologia'),
      e('📡', 'radar antena comunicacion'),
      e('☢️', 'nuclear atomica radiacion'),
      e('🚀', 'cohete espacio')
    ]
  },
  {
    name: 'Guerra',
    items: [
      e('⚔️', 'guerra espadas batalla ataque'),
      e('💣', 'bomba explosivo'),
      e('🛡️', 'escudo defensa proteccion'),
      e('🔥', 'fuego incendio'),
      e('💀', 'calavera muerte'),
      e('🎯', 'objetivo diana blanco'),
      e('🏰', 'castillo fortaleza fortificacion')
    ]
  },
  {
    name: 'Diplomacia',
    items: [
      e('🤝', 'alianza acuerdo diplomacia tratado'),
      e('🕊️', 'paz paloma'),
      e('🌍', 'mundo planeta global'),
      e('✉️', 'carta mensaje'),
      e('🗺️', 'mapa territorio'),
      e('📌', 'reclamo marcador')
    ]
  },
  {
    name: 'Pueblo',
    items: [
      e('👥', 'pueblo gente nacion unidad poblacion'),
      e('🌾', 'agricultura campo comida trigo'),
      e('🏥', 'hospital salud medicina'),
      e('🏠', 'casa vivienda hogar'),
      e('🎓', 'educacion escuela universidad'),
      e('⛪', 'iglesia religion'),
      e('⭐', 'estrella general')
    ]
  }
]

export const ALL_EMOJIS = EMOJI_CATEGORIES.flatMap((c) => c.items)

/** minúsculas y sin tildes */
export function normalize(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Busca emojis por palabra en español ("fábrica", "barco", "dinero") */
export function searchEmojis(query: string): EmojiEntry[] {
  const q = normalize(query).trim()
  if (!q) return ALL_EMOJIS
  return ALL_EMOJIS.filter((i) => i.words.split(' ').some((w) => w.startsWith(q) || w.includes(q)))
}

/** [palabras (raíces), emoji] — se buscan sin tildes y en minúsculas */
const AUTO_RULES: [string[], string][] = [
  [['fabrica', 'industri', 'produccion', 'producir'], '🏭'],
  [['ejercito', 'tropa', 'infanteria'], '🪖'],
  [['marina', 'flota', 'naval', 'puerto'], '⚓'],
  [['aviacion', 'aire', 'aereo', 'avion'], '✈️'],
  [['ciencia', 'investigacion', 'tecnologia'], '🔬'],
  [['economia', 'dinero', 'comercio', 'banco'], '💰'],
  [['politica', 'gobierno', 'partido', 'eleccion'], '🏛️'],
  [['guerra', 'ataque', 'invasion', 'invadir'], '⚔️'],
  [['defensa', 'fortificacion', 'fortificar', 'muro'], '🛡️'],
  [['alianza', 'faccion', 'diplomacia', 'tratado'], '🤝'],
  [['pueblo', 'nacion', 'unidad'], '👥'],
  [['agricultura', 'campo', 'comida'], '🌾'],
  [['petroleo', 'recurso', 'acero', 'mineria'], '⛏️']
]

export const FALLBACK_EMOJI = '⭐'

/** Elige un emoji según las palabras del nombre ("Industrializar" → 🏭) */
export function pickAutoEmoji(name: string): string {
  const n = normalize(name)
  for (const [words, emoji] of AUTO_RULES) if (words.some((w) => n.includes(w))) return emoji
  return FALLBACK_EMOJI
}
