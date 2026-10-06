import { describe, expect, test } from 'claude-code/testing'

import { footerModes } from '../hooks/band'
import { resolveMemoryDir, touchesMemory } from '../hooks/memory'
import { mergeSkills, toggled } from '../hooks/setup'
import { groupSkills, listingWithout, parseListing, shortName, toSkillInfo } from '../hooks/skills'
import { clip, describeSetup } from '../hooks/text'
import { LISTING, MEMORY_FILE } from './helpers'

describe('skill listing', () => {
  test('keeps a description that runs on with its skill', () => {
    const listing = parseListing(LISTING)

    expect(listing.entries.map(entry => entry.name)).toEqual([
      'crisp',
      'dataviz',
      'claude-api',
      'anthropic-skills:pdf',
    ])
    expect(listing.entries[2]?.lines).toHaveLength(2)
  })

  test('drops the skills off, and gives null when none is left', () => {
    const listing = parseListing(LISTING)

    expect(listingWithout(listing, new Set(['claude-api']))).not.toContain('TRIGGER')
    expect(listingWithout(listing, new Set(listing.entries.map(entry => entry.name)))).toBeNull()
  })

  test('groups yours first, plugins by prefix, built in last', () => {
    const yours = new Set(['crisp'])
    const skills = parseListing(LISTING).entries.map(entry => toSkillInfo(entry, yours))

    expect(groupSkills(skills).map(group => group.label)).toEqual(['Your skills', 'Anthropic skills', 'Built in'])
    expect(shortName('anthropic-skills:pdf')).toBe('pdf')
  })

  test('a later listing replaces skills by name and keeps the rest', () => {
    const a = { name: 'a', description: 'old', details: 'old', group: 'Built in' }
    const b = { name: 'b', description: 'b', details: 'b', group: 'Built in' }
    const newA = { ...a, description: 'new' }

    expect(mergeSkills([a, b], [newA])).toEqual([newA, b])
  })
})

describe('memory guard', () => {
  test('matches the memory folder, the memory tools and a custom folder', () => {
    expect(touchesMemory('Read', { file_path: MEMORY_FILE })).toBe(true)
    expect(touchesMemory('Bash', { command: `cat ${MEMORY_FILE}` })).toBe(true)
    expect(touchesMemory('mcp__store__memory_write', {})).toBe(true)
    expect(touchesMemory('Read', { file_path: '/notes/mem/a.md' }, '/notes/mem')).toBe(true)
    expect(touchesMemory('Read', { file_path: '/tmp/game/main.gd' })).toBe(false)
  })

  test('expands ~/ in a settings path and trims the trailing slash', () => {
    expect(resolveMemoryDir('~/notes/mem/', '/Users/me')).toBe('/Users/me/notes/mem')
    expect(resolveMemoryDir('', '/Users/me')).toBeUndefined()
    expect(resolveMemoryDir(42, '/Users/me')).toBeUndefined()
  })
})

describe('words', () => {
  test('describes a setup', () => {
    expect(describeSetup({ memory: 'off', skillsOff: [] })).toBe('memory off · all skills on')
    expect(describeSetup({ memory: 'on', skillsOff: ['a', 'b'] })).toBe('memory on · 2 skills off')
  })

  test('clips with an ellipsis, and gives nothing with hardly any room', () => {
    expect(clip('abcdefghijkl', 10)).toBe('abcdefghi…')
    expect(clip('short', 10)).toBe('short')
    expect(clip('anything', 5)).toBe('')
  })

  test('toggles an item in a sorted list', () => {
    expect(toggled(['b'], 'a')).toEqual(['a', 'b'])
    expect(toggled(['a', 'b'], 'a')).toEqual(['b'])
  })

  test("adds the footer's labels, and defers to the engine's own", () => {
    expect(footerModes(['focus'], { memory: 'off', skillsOff: ['a'] })).toEqual(['focus', 'memory off', '1 skill off'])
    expect(footerModes(['memory paused'], { memory: 'off', skillsOff: [] })).toBeUndefined()
    expect(footerModes([], { memory: 'on', skillsOff: [] })).toBeUndefined()
  })
})
