// Validación del "tag" de país (las 3 letras que identifican a un país en HOI4, p. ej. GER).
// Se comparte entre el proceso principal (main) y la interfaz (renderer).

export const TAG_REGEX = /^[A-Z][A-Z0-9]{2}$/

// Palabras reservadas que el juego no acepta como tag.
export const RESERVED_TAGS = ['NOT', 'AND', 'TAG', 'OOB', 'LOG', 'NUM', 'RED']

/** Devuelve un mensaje de error en español, o null si el tag es válido. */
export function validateTag(tag: string): string | null {
  if (!tag) return 'Escribe el tag del país (3 caracteres).'
  if (!TAG_REGEX.test(tag)) {
    return 'El tag debe tener 3 caracteres: una letra mayúscula seguida de 2 letras mayúsculas o números (ej: GER, SPR, X01).'
  }
  if (RESERVED_TAGS.includes(tag)) {
    return `"${tag}" es una palabra reservada del juego y no se puede usar como tag.`
  }
  return null
}
