import { describe, expect, test } from 'claude-code/testing'

import { context, engine, LISTING, listing, pane, start } from './helpers'

describe('skills off', () => {
  test('are hidden from the listing, which keeps the others whole', async ($, on) => {
    engine(on)
    await start($)
    await listing($)
    await (await pane($)).press({ key: 'skill-dataviz' })
    const { text } = await listing($)

    expect(text).not.toContain('dataviz')
    expect(text).toContain('- crisp:')
    expect(text).toContain('TRIGGER — read BEFORE opening the target file.')
    expect(text).toContain('The following skills are available')
  })

  test('are blocked through the Skill tool and as /name', async ($, on) => {
    engine(on)
    await start($)
    await listing($)
    await (await pane($)).press({ key: 'skill-crisp' })

    const call = await $.tool.call({ tool: 'Skill', skill: 'crisp' })
    const typed = await $.skill.prompt({ skill: 'crisp', text: 'the crisp skill' })
    const other = await $.tool.call({ tool: 'Skill', skill: 'dataviz' })

    expect(call.deny).toContain('crisp skill is off')
    expect(typed.text).toContain('crisp skill is off')
    expect(other.deny).toBeUndefined()
  })

  test('All off drops the listing; All on brings it back', async ($, on) => {
    engine(on)
    await start($)
    await listing($)
    const ui = await pane($)

    await ui.press({ key: 'skills-all-off' })
    expect((await listing($)).text).toBeNull()

    await ui.press({ key: 'skills-all-on' })
    expect((await listing($)).text).toBe(LISTING)
  })
})

describe('defaults', () => {
  test('Save as default carries memory and skills into the next fresh thread', async ($, on) => {
    engine(on)
    await start($)
    await listing($)
    const ui = await pane($)
    await ui.press({ key: 'memory-on' })
    await ui.press({ key: 'skill-dataviz' })
    await ui.press({ key: 'save-default' })

    await ui.press({ key: 'memory-off' })
    await ui.press({ key: 'skill-dataviz' })
    await $.classic.SessionStart({ source: 'clear' })

    expect((await context($)).instructionFiles).toHaveLength(2)
    expect((await $.tool.call({ tool: 'Skill', skill: 'dataviz' })).deny).toContain('off')
  })

  test('saved defaults apply when a new session starts', async ($, on) => {
    engine(on, { store: { defaultMemory: 'off', defaultSkillsOff: ['crisp'] } })
    await start($)

    expect((await $.tool.call({ tool: 'Skill', skill: 'crisp' })).deny).toContain('off')
  })

  test('stored values of the wrong shape are ignored', async ($, on) => {
    engine(on, { store: { defaultMemory: 'maybe', defaultSkillsOff: 'crisp', knownSkills: [{ name: 1 }] } })
    await start($)
    const ui = await pane($)

    expect((await $.tool.call({ tool: 'Skill', skill: 'crisp' })).deny).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /No skills read yet/ })).toBeDefined()
  })
})

describe('the skill list', () => {
  test("before this thread's listing arrives, the panel shows the last thread's", async ($, on) => {
    const known = [{ name: 'crisp', description: 'Keeps prose plain.', details: 'Keeps prose plain.', group: 'Your skills' }]
    engine(on, { store: { knownSkills: known } })
    await start($)
    const ui = await pane($)

    expect(await ui.find({ key: 'skill-crisp' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /last thread/ })).toBeDefined()
  })

  test("a subagent's listing is filtered but doesn't replace the panel's list", async ($, on) => {
    engine(on, { store: { defaultSkillsOff: ['dataviz'] } })
    await start($)
    const { text } = await listing($, 'agent-1')

    expect(text).not.toContain('dataviz')
    expect(await (await pane($)).find({ type: 'Text', text: /No skills read yet/ })).toBeDefined()
  })
})
