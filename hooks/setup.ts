import type { KeptOut, Setup, SkillInfo } from '../types'

// What a thread starts with until the person saves defaults of their own.
export const FACTORY_SETUP: Setup = { memory: 'off', skillsOff: [] }
export const NOTHING_KEPT_OUT: KeptOut = {
  isSectionDropped: false,
  files: [],
  attachments: [],
  blockedCalls: 0,
}

// Kept across sessions in $.store.
export const STORE_KEYS = {
  defaultMemory: 'defaultMemory',
  defaultSkillsOff: 'defaultSkillsOff',
  knownSkills: 'knownSkills',
  collapsedGroups: 'collapsedGroups',
  descriptionMode: 'descriptionMode',
  statusLine: 'statusLine',
} as const

export function isStringList(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string')
}

export function isSkillInfo(value: unknown): value is SkillInfo {
  if (typeof value !== 'object' || value === null) return false
  const skill = value as Record<string, unknown>

  return ['name', 'description', 'details', 'group'].every(key => typeof skill[key] === 'string')
}

export function isSameSetup(a: Setup, b: Setup) {
  return a.memory === b.memory && a.skillsOff.join('\n') === b.skillsOff.join('\n')
}

/** The list with `item` added, or taken out if it was there; sorted. */
export function toggled(list: readonly string[], item: string) {
  return (list.includes(item) ? list.filter(other => other !== item) : [...list, item]).sort()
}

/** A later listing's skills over the earlier ones, by name; sorted. */
export function mergeSkills(earlier: readonly SkillInfo[], later: readonly SkillInfo[]) {
  return [...earlier.filter(skill => !later.some(other => other.name === skill.name)), ...later].sort((a, b) =>
    a.name.localeCompare(b.name),
  )
}
