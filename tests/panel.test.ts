import { describe, expect, test } from 'claude-code/testing'

import { engine, listing, pane, setup, start, SURFACES } from './helpers'

describe('opening', () => {
  test('/setup opens the panel and says where the thread stands', async ($, on) => {
    const { opened } = engine(on)
    await start($)
    const { text } = await setup($)

    expect(opened).toEqual(['thread-setup'])
    expect(text).toContain('memory off · all skills on')
  })

  for (const surface of SURFACES) {
    test(`lists the thread's skills (${surface})`, async ($, on) => {
      engine(on)
      await start($)
      await listing($)
      const ui = await pane($, surface)

      for (const name of ['crisp', 'dataviz', 'claude-api', 'anthropic-skills:pdf']) {
        expect(await ui.find({ key: `skill-${name}` })).toBeDefined()
      }
    })
  }
})

describe('mod settings', () => {
  test('sit under the cards on desktop, with the status line switch', async ($, on) => {
    engine(on)
    await start($)
    const ui = await pane($, 'desktop')

    expect(await ui.find({ type: 'Text', text: 'Mod settings' })).toBeDefined()
    expect((await ui.find({ key: 'status-line' }))?.props.label).toBe('On')
  })

  test("don't show in the terminal, which has no status line", async ($, on) => {
    engine(on)
    await start($)

    expect(await (await pane($, 'terminal')).find({ key: 'status-line' })).toBeUndefined()
  })
})

describe('controls', () => {
  test('every switch is one button: bright when on, dimmed when off', async ($, on) => {
    engine(on)
    await start($)
    await listing($)
    const ui = await pane($, 'desktop')
    const look = async (key: string) => {
      const props = (await ui.find({ key }))?.props

      return [props?.label, props?.variant, props?.dimColor]
    }

    expect(await look('memory')).toEqual(['Off', 'secondary', true])
    expect(await look('status-line')).toEqual(['On', 'primary', false])
    expect(await look('skill-crisp')).toEqual(['On', 'primary', false])

    await ui.press({ key: 'memory' })
    await ui.press({ key: 'skill-crisp' })
    expect(await look('memory')).toEqual(['On', 'primary', false])
    expect(await look('skill-crisp')).toEqual(['Off', 'secondary', true])
  })

  test('two quick presses flip a switch on and back off', async ($, on) => {
    engine(on)
    await start($)
    const ui = await pane($, 'desktop')
    await Promise.all([ui.press({ key: 'memory' }), ui.press({ key: 'memory' })])

    expect((await ui.find({ key: 'memory' }))?.props.label).toBe('Off')
  })

  test('an action that would do nothing now is dimmed', async ($, on) => {
    engine(on)
    await start($)
    await listing($)
    const ui = await pane($, 'desktop')
    const isDim = async (key: string) => (await ui.find({ key }))?.props.dimColor

    expect([await isDim('skills-all-on'), await isDim('skills-all-off')]).toEqual([true, false])
    expect([await isDim('reset-default'), await isDim('save-default')]).toEqual([true, true])

    await ui.press({ key: 'skill-crisp' })
    expect([await isDim('skills-all-on'), await isDim('reset-default')]).toEqual([false, false])
    expect((await ui.find({ key: 'save-default' }))?.props.variant).toBe('primary')
  })
})

describe('a narrow panel', () => {
  for (const surface of SURFACES) {
    test(`keeps every switch and stacks the rest (${surface})`, async ($, on) => {
      engine(on)
      await start($)
      await listing($)
      const ui = await pane($, surface, 40)

      for (const key of ['memory', 'skill-crisp', 'skill-dataviz', 'skill-claude-api', 'reset-default']) {
        expect(await ui.find({ key })).toBeDefined()
      }
      expect(await ui.find({ type: 'Text', text: 'This thread' })).toBeDefined()
      expect(await ui.find({ key: 'view-off' })).toBeDefined()
    })
  }

  test('cuts descriptions down to what fits', async ($, on) => {
    engine(on)
    await start($)
    await listing($)
    const narrow = await pane($, 'desktop', 40)
    const blurb = await narrow.find({ type: 'Text', text: /Use this skill whenever you are/ })

    expect((blurb?.text.length ?? 0) < 40).toBe(true)
  })
})

describe('status card', () => {
  test('shows this thread against the defaults, and flags a difference', async ($, on) => {
    engine(on)
    await start($)
    await listing($)
    const ui = await pane($)

    expect(await ui.findAll({ type: 'Text', text: 'All skills on' })).toHaveLength(2)
    expect(await ui.find({ type: 'Text', text: 'Matches your defaults.' })).toBeDefined()

    await ui.press({ key: 'skill-crisp' })
    expect(await ui.find({ type: 'Text', text: '3 skills on · ' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '1 off' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /differs from your defaults/ })).toBeDefined()

    await ui.press({ key: 'reset-default' })
    expect(await ui.find({ type: 'Text', text: 'Matches your defaults.' })).toBeDefined()
  })

  test('keeps its buttons whether or not the thread differs', async ($, on) => {
    engine(on)
    await start($)
    await listing($)
    const ui = await pane($)
    expect(await ui.find({ key: 'save-default' })).toBeDefined()

    await ui.press({ key: 'skill-crisp' })
    expect(await ui.find({ key: 'save-default' })).toBeDefined()
  })

  test('Save and Reset do nothing while the thread matches the defaults', async ($, on) => {
    engine(on)
    await start($)
    await listing($)
    const ui = await pane($)
    await ui.press({ key: 'save-default' })
    await ui.press({ key: 'reset-default' })
    await $.classic.SessionStart({ source: 'clear' })

    expect((await $.tool.call({ tool: 'Skill', skill: 'crisp' })).deny).toBeUndefined()
  })
})

describe('the skill list', () => {
  test('groups skills: yours first, plugins by prefix, built in last', async ($, on) => {
    engine(on)
    await start($)
    await listing($)
    const ui = await pane($)
    const headings = (await ui.findAll({ type: 'Button', text: /^▾ / })).map(found => found.text)

    expect(headings).toEqual(['▾ Your skills · 1', '▾ Anthropic skills · 1', '▾ Built in · 2'])
    expect(await ui.find({ type: 'Text', text: 'pdf' })).toBeDefined()
  })

  test('the filter narrows the list', async ($, on) => {
    engine(on)
    await start($)
    await listing($)
    const ui = await pane($)
    await ui.input({ key: 'skill-filter', text: 'pdf', kind: 'change' })

    expect(await ui.find({ key: 'skill-anthropic-skills:pdf' })).toBeDefined()
    expect(await ui.find({ key: 'skill-crisp' })).toBeUndefined()
  })

  test('the Off view lists only the skills switched off', async ($, on) => {
    engine(on)
    await start($)
    await listing($)
    const ui = await pane($)
    await ui.press({ key: 'skill-crisp' })
    await ui.press({ key: 'view-off' })

    expect(await ui.find({ key: 'skill-crisp' })).toBeDefined()
    expect(await ui.find({ key: 'skill-dataviz' })).toBeUndefined()

    await ui.press({ key: 'view-on' })
    expect(await ui.find({ key: 'skill-crisp' })).toBeUndefined()
    expect(await ui.find({ key: 'skill-dataviz' })).toBeDefined()
  })

  test('the Off view says so when nothing is off', async ($, on) => {
    engine(on)
    await start($)
    await listing($)
    const ui = await pane($)
    await ui.press({ key: 'view-off' })

    expect(await ui.find({ type: 'Text', text: 'No skills are off.' })).toBeDefined()
  })

  test('an off skill drops its description from the row', async ($, on) => {
    engine(on)
    await start($)
    await listing($)
    const ui = await pane($)
    expect(await ui.find({ type: 'Text', text: /Keeps prose plain/ })).toBeDefined()

    await ui.press({ key: 'skill-crisp' })
    expect(await ui.find({ type: 'Text', text: /Keeps prose plain/ })).toBeUndefined()
  })
})

describe('descriptions', () => {
  test('Full shows each one whole; One line folds them back', async ($, on) => {
    engine(on)
    await start($)
    await listing($)
    const ui = await pane($)
    expect(await ui.find({ type: 'Text', text: /TRIGGER/ })).toBeUndefined()

    await ui.press({ key: 'describe-full' })
    expect(await ui.find({ type: 'Text', text: /TRIGGER — read BEFORE/ })).toBeDefined()

    await ui.press({ key: 'describe-line' })
    expect(await ui.find({ type: 'Text', text: /TRIGGER/ })).toBeUndefined()
  })

  test('a filter down to a few skills shows them whole', async ($, on) => {
    engine(on)
    await start($)
    await listing($)
    const ui = await pane($)
    await ui.input({ key: 'skill-filter', text: 'claude-api', kind: 'change' })

    expect(await ui.find({ type: 'Text', text: /TRIGGER — read BEFORE/ })).toBeDefined()
  })

  test('the mode is kept for the next thread', async ($, on) => {
    engine(on, { store: { descriptionMode: 'full' } })
    await start($)
    await listing($)

    expect(await (await pane($)).find({ type: 'Text', text: /TRIGGER — read BEFORE/ })).toBeDefined()
  })
})

describe('group headings', () => {
  test('the whole heading folds and unfolds its group', async ($, on) => {
    engine(on)
    await start($)
    await listing($)
    const ui = await pane($)
    await ui.press({ key: 'fold-Built in' })

    expect(await ui.find({ type: 'Button', text: '▸ Built in · 2' })).toBeDefined()
    expect(await ui.find({ key: 'skill-dataviz' })).toBeUndefined()
    expect(await ui.find({ key: 'skill-crisp' })).toBeDefined()

    await ui.press({ key: 'fold-Built in' })
    expect(await ui.find({ type: 'Button', text: '▾ Built in · 2' })).toBeDefined()
    expect(await ui.find({ key: 'skill-dataviz' })).toBeDefined()
  })

  test('a folded group still shows matches for a filter', async ($, on) => {
    engine(on)
    await start($)
    await listing($)
    const ui = await pane($)
    await ui.press({ key: 'fold-Built in' })
    await ui.input({ key: 'skill-filter', text: 'chart', kind: 'change' })

    expect(await ui.find({ key: 'skill-dataviz' })).toBeDefined()
  })

  test('while a filter is on, headings are plain text', async ($, on) => {
    engine(on)
    await start($)
    await listing($)
    const ui = await pane($)
    await ui.input({ key: 'skill-filter', text: 'a', kind: 'change' })

    expect(await ui.find({ key: 'fold-Built in' })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'Built in · 2' })).toBeDefined()
  })

  test('folded groups come back from the store', async ($, on) => {
    engine(on, { store: { collapsedGroups: ['Built in'] } })
    await start($)
    await listing($)

    expect(await (await pane($)).find({ key: 'skill-dataviz' })).toBeUndefined()
  })
})
