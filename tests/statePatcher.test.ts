import { describe, it, expect } from 'vitest'
import { patchStateHistory } from '../src/shared/statePatcher'

describe('State History Patcher', () => {
  const sampleStateFile = `# State 1 - Texas\r
state = {\r
\tid = 1\r
\tname = "STATE_TEXAS"\r
\tstate_category = "town"\r
\r
\thistory = {\r
\t\towner = USA\r
\t\tadd_core_of = USA\r
\t\tadd_core_of = TEX\r
\t\tvictory_points = { 101 10 }\r
\r
\t\t1939.1.1 = {\r
\t\t\towner = CSA\r
\t\t\tremove_core_of = USA\r
\t\t}\r
\t}\r
\r
\tprovinces = {\r
\t\t101 102 103\r
\t}\r
}\r
`

  it('patches top-level owner and cores preserving comments, date blocks and CRLF line endings', () => {
    const edit = {
      owner: 'MEX',
      addCores: ['MEX'],
      removeCores: ['TEX']
    }

    const res = patchStateHistory(sampleStateFile, edit)
    expect(res.success).toBe(true)
    expect(res.patchedText).toBeDefined()

    const text = res.patchedText!

    // Debe conservar finales de línea CRLF
    expect(text).toContain('\r\n')

    // Comentario inicial intacto
    expect(text).toContain('# State 1 - Texas')

    // Bloque de fecha 1939 intacto
    expect(text).toContain('1939.1.1 = {\r\n\t\t\towner = CSA\r\n\t\t\tremove_core_of = USA')

    // Modificaciones en top-level
    expect(text).toContain('owner = MEX')
    expect(text).toContain('add_core_of = USA')
    expect(text).toContain('add_core_of = MEX')
    expect(text).not.toContain('add_core_of = TEX')
  })

  it('is idempotent: patching twice gives the exact same result', () => {
    const edit = {
      owner: 'MEX',
      addCores: ['MEX'],
      removeCores: ['TEX']
    }

    const first = patchStateHistory(sampleStateFile, edit)
    expect(first.success).toBe(true)

    const second = patchStateHistory(first.patchedText!, edit)
    expect(second.success).toBe(true)

    expect(second.patchedText).toBe(first.patchedText)
  })

  it('returns clear error if history block is missing or malformed', () => {
    const invalidText = 'state = { id = 1 name = "BAD" }'
    const res = patchStateHistory(invalidText, { owner: 'MEX' })
    expect(res.success).toBe(false)
    expect(res.error).toContain('history')
  })
})
