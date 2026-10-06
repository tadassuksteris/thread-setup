import { describe, expect, test } from 'claude-code/testing'

import { context, engine, HOME, MEMORY_FILE, mem, start } from './helpers'

describe('memory off (the default)', () => {
  test('drops the memory prompt section', async ($, on) => {
    engine(on)
    await start($)

    expect(await $.prompt.section({ name: 'memory', text: null })).toEqual({ text: null })
  })

  test('keeps other prompt sections', async ($, on) => {
    engine(on)
    await start($)

    expect(await $.prompt.section({ name: 'tone', text: null })).toEqual({ text: 'Your memories: ...' })
  })

  test('filters memory files out of the instruction files', async ($, on) => {
    engine(on)
    await start($)

    expect((await context($)).instructionFiles?.map(file => file.kind)).toEqual(['project'])
  })

  test('blocks reads and writes in the memory folder', async ($, on) => {
    engine(on)
    await start($)
    const write = await $.tool.call({ tool: 'Write', file_path: MEMORY_FILE, content: 'x' })
    const read = await $.tool.call({ tool: 'Read', file_path: MEMORY_FILE })

    expect(write.deny).toContain('Memory is off')
    expect(read.deny).toContain('Memory is off')
  })

  test('blocks the memory tools', async ($, on) => {
    engine(on)
    await start($)
    const result = await $.tool.call({ tool: 'memory_read', store: 'personal', path: '/MEMORY.md' })

    expect(result.deny).toContain('Memory is off')
  })

  test('lets other files through', async ($, on) => {
    engine(on)
    await start($)
    const result = await $.tool.call({ tool: 'Write', file_path: '/tmp/game/main.gd', content: 'x' })

    expect(result.deny).toBeUndefined()
  })

  test('also guards a memory folder named in settings', async ($, on) => {
    engine(on, { settings: { autoMemoryDirectory: '~/notes/claude-memory/' } })
    await start($)
    const custom = await $.tool.call({ tool: 'Read', file_path: `${HOME}/notes/claude-memory/MEMORY.md` })
    const standard = await $.tool.call({ tool: 'Read', file_path: MEMORY_FILE })

    expect(custom.deny).toContain('Memory is off')
    expect(standard.deny).toContain('Memory is off')
  })
})

describe('/mem', () => {
  test('/mem on lets memory through', async ($, on) => {
    engine(on)
    await start($)
    await mem($, 'on')

    expect(await $.prompt.section({ name: 'memory', text: null })).toEqual({ text: 'Your memories: ...' })
    expect((await context($)).instructionFiles).toHaveLength(2)
    expect((await $.tool.call({ tool: 'Read', file_path: MEMORY_FILE })).deny).toBeUndefined()
  })

  test('/mem default on makes the next fresh thread start with memory on', async ($, on) => {
    engine(on)
    await start($)
    const { text } = await mem($, 'default on')
    await $.classic.SessionStart({ source: 'clear' })

    expect(text).toContain('memory on')
    expect((await context($)).instructionFiles).toHaveLength(2)
  })

  test('a stored default of on applies at startup', async ($, on) => {
    engine(on, { store: { defaultMemory: 'on' } })
    await start($)

    expect((await context($)).instructionFiles).toHaveLength(2)
  })

  test('/mem status reports what was kept out', async ($, on) => {
    engine(on)
    await start($)
    await context($)
    const { text } = await mem($, 'status')

    expect(text).toContain('Memory is off for this thread')
    expect(text).toContain('1 memory file')
  })

  test('/mem status says when auto memory is off in settings', async ($, on) => {
    engine(on, { settings: { autoMemoryEnabled: false } })
    await start($)

    expect((await mem($, 'status')).text).toContain('Auto memory is turned off in settings')
  })

  test('/mem with an unknown argument shows usage', async ($, on) => {
    engine(on)
    await start($)

    expect((await mem($, 'maybe')).text).toContain('Usage')
  })
})
