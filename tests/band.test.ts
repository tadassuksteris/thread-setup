import { describe, expect, test } from 'claude-code/testing'

import { band, context, engine, footer, listing, mem, pane, start, startOnDesktop, submit, SURFACES } from './helpers'

describe('the switch row in a new thread', () => {
  for (const surface of SURFACES) {
    test(`offers memory on/off and turns it on (${surface})`, async ($, on) => {
      engine(on)
      await start($)
      const ui = await band($, surface)

      expect(await ui.find({ key: 'memory-on' })).toBeDefined()
      await ui.press({ key: 'memory-on' })

      expect((await context($)).instructionFiles).toHaveLength(2)
    })
  }

  test('closes after the first message, not after a slash command', async ($, on) => {
    engine(on)
    await start($)

    await submit($, '/model')
    expect(await (await band($)).find({ key: 'memory-on' })).toBeDefined()

    await submit($, 'hello')
    expect(await (await band($)).find({ key: 'memory-on' })).toBeUndefined()
  })

  test('comes back after /clear', async ($, on) => {
    engine(on)
    await start($)
    await submit($, 'hello')
    await $.classic.SessionStart({ source: 'clear' })

    expect(await (await band($)).find({ key: 'memory-on' })).toBeDefined()
  })

  test('bare /mem reopens it mid-thread; /mem status does not', async ($, on) => {
    engine(on)
    await start($)
    await submit($, 'hello')

    await mem($, 'status')
    expect(await (await band($)).find({ key: 'memory-on' })).toBeUndefined()

    await mem($, '')
    expect(await (await band($)).find({ key: 'memory-on' })).toBeDefined()
  })
})

describe('on desktop', () => {
  test('the session starts without the switch row, until /mem opens it', async ($, on) => {
    engine(on)
    await startOnDesktop($)
    expect(await (await band($, 'desktop')).find({ key: 'memory-on' })).toBeUndefined()

    await mem($, '')
    expect(await (await band($, 'desktop')).find({ key: 'memory-on' })).toBeDefined()
  })

  test('the closed band keeps a status line that opens the panel', async ($, on) => {
    const { opened } = engine(on)
    await startOnDesktop($)
    await listing($)
    await (await pane($)).press({ key: 'skill-crisp' })
    const ui = await band($, 'desktop')

    expect(await ui.find({ type: 'Text', text: 'Memory off' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '1 skill off' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Differs from your defaults' })).toBeDefined()
    await ui.press({ key: 'change' })
    expect(opened).toEqual(['thread-setup'])
  })

  test('the status line says all skills on, and nothing about defaults it matches', async ($, on) => {
    engine(on)
    await startOnDesktop($)
    const ui = await band($, 'desktop')

    expect(await ui.find({ type: 'Text', text: 'All skills on' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Differs from your defaults' })).toBeUndefined()
  })

  test('closing the status line switches it off, as the panel then shows', async ($, on) => {
    const { toasts } = engine(on)
    await startOnDesktop($)
    const ui = await pane($)
    expect((await ui.find({ key: 'status-line-off' }))?.props.dimColor).toBe(true)

    await (await band($, 'desktop')).press({ key: 'close-status' })

    expect(await (await band($, 'desktop')).find({ key: 'change' })).toBeUndefined()
    expect((await ui.find({ key: 'status-line-on' }))?.props.dimColor).toBe(true)
    expect((await ui.find({ key: 'status-line-off' }))?.props.dimColor).toBe(false)
    expect(toasts).toEqual(['Status line off. Turn it back on in /setup, under Mod settings.'])
  })

  test('once closed, it stays off after /clear until the panel turns it on', async ($, on) => {
    engine(on)
    await startOnDesktop($)
    await (await band($, 'desktop')).press({ key: 'close-status' })
    await $.classic.SessionStart({ source: 'clear' })
    await (await band($, 'desktop')).press({ key: 'dismiss' })
    expect(await (await band($, 'desktop')).find({ key: 'change' })).toBeUndefined()

    await (await pane($)).press({ key: 'status-line-on' })
    expect(await (await band($, 'desktop')).find({ key: 'change' })).toBeDefined()
  })

  test('a status line switched off stays off in the next session', async ($, on) => {
    engine(on, { store: { statusLine: 'off' } })
    await startOnDesktop($)

    expect(await (await band($, 'desktop')).find({ key: 'change' })).toBeUndefined()
  })
})

describe('in the terminal', () => {
  test('the band draws nothing while closed', async ($, on) => {
    engine(on)
    await start($)
    await submit($, 'hello')
    const ui = await band($)

    expect(await ui.find({ key: 'change' })).toBeUndefined()
    expect(await ui.find({ key: 'memory-on' })).toBeUndefined()
  })

  test('the footer says memory is off and counts skills off', async ($, on) => {
    engine(on, { store: { defaultSkillsOff: ['crisp'] } })
    await start($)

    expect(await (await footer($)).find({ type: 'Text', text: 'focus, memory off, 1 skill off' })).toBeDefined()
  })

  test('the footer adds nothing with memory on and every skill on', async ($, on) => {
    engine(on, { store: { defaultMemory: 'on' } })
    await start($)

    expect(await (await footer($)).find({ type: 'Text', text: 'focus' })).toBeDefined()
  })
})
