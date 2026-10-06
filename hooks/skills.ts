import type { SkillInfo } from '../types'

// The skill listing names one skill per "- name: description" line; a
// description sometimes runs on over the lines after it.
const SKILL_LINE = /^- (\S+): ?(.*)$/

const GROUP_YOURS = 'Your skills'
const GROUP_BUILT_IN = 'Built in'

type ListingEntry = { name: string; lines: string[] }
type Listing = { header: string[]; entries: ListingEntry[] }

export function parseListing(text: string): Listing {
  const listing: Listing = { header: [], entries: [] }

  for (const line of text.split('\n')) {
    const name = SKILL_LINE.exec(line)?.[1]
    const last = listing.entries.at(-1)

    if (name !== undefined) listing.entries.push({ name, lines: [line] })
    else if (last !== undefined) last.lines.push(line)
    else listing.header.push(line)
  }

  return listing
}

/** The listing without the skills that are off: null when none is left. */
export function listingWithout(listing: Listing, off: ReadonlySet<string>) {
  const kept = listing.entries.filter(entry => !off.has(entry.name))
  if (kept.length === 0) return null

  return [...listing.header, ...kept.flatMap(entry => entry.lines)].join('\n')
}

/** "anthropic-skills:docs" goes under its plugin; the rest are yours or built in. */
function groupOf(name: string, yours: ReadonlySet<string>) {
  const cut = name.indexOf(':')
  if (cut > 0) {
    const prefix = name.slice(0, cut).replace(/[-_]+/g, ' ')

    return prefix.charAt(0).toUpperCase() + prefix.slice(1)
  }

  return yours.has(name) ? GROUP_YOURS : GROUP_BUILT_IN
}

/** `yours` names the person's own skills: their user and project slash commands. */
export function toSkillInfo(entry: ListingEntry, yours: ReadonlySet<string>): SkillInfo {
  const first = SKILL_LINE.exec(entry.lines[0] ?? '')?.[2] ?? ''
  const whole = [first, ...entry.lines.slice(1)].join(' ')

  return {
    name: entry.name,
    description: first.replace(/\s+/g, ' ').trim().slice(0, 240),
    details: whole.replace(/\s+/g, ' ').trim().slice(0, 4000),
    group: groupOf(entry.name, yours),
  }
}

/** The name without its plugin prefix, as the panel shows it under that plugin's heading. */
export function shortName(name: string) {
  return name.slice(name.indexOf(':') + 1)
}

function groupRank(group: string) {
  if (group === GROUP_YOURS) return 0
  if (group === GROUP_BUILT_IN) return 2

  return 1
}

/** Skills by heading: yours first, then each plugin's, then built in. */
export function groupSkills(list: readonly SkillInfo[]) {
  const groups = new Map<string, SkillInfo[]>()
  for (const skill of list) groups.set(skill.group, [...(groups.get(skill.group) ?? []), skill])

  return [...groups.entries()]
    .map(([label, members]) => ({ label, skills: members }))
    .sort((a, b) => groupRank(a.label) - groupRank(b.label) || a.label.localeCompare(b.label))
}

export function skillDenied(name: string) {
  return (
    `The ${name} skill is off for this thread (thread-setup mod). ` +
    'Carry on without it; the person can turn it back on with /setup.'
  )
}
