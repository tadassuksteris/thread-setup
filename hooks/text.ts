import type { KeptOut, Setup } from '../types'

export function plural(count: number, word: string) {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

/** "memory off · 2 skills off", or "memory on · all skills on". */
export function describeSetup(setup: Setup) {
  const off = setup.skillsOff.length
  const skillsPart = off === 0 ? 'all skills on' : `${plural(off, 'skill')} off`

  return `memory ${setup.memory} · ${skillsPart}`
}

/** Cuts text to `room` characters with an ellipsis; nothing when there's hardly room. */
export function clip(text: string, room: number) {
  if (room < 8) return ''

  return text.length <= room ? text : `${text.slice(0, room - 1)}…`
}

/** What `/mem status` prints. */
export function statusReport(report: {
  thread: Setup
  start: Setup
  kept: KeptOut
  isAutoMemoryEnabled: boolean
}) {
  const { thread, start, kept } = report
  const lines = [
    `Memory is ${thread.memory} for this thread. New threads start with ${describeSetup(start)}.`,
  ]

  if (thread.skillsOff.length > 0) lines.push(`Skills off this thread: ${thread.skillsOff.join(', ')}.`)

  if (!report.isAutoMemoryEnabled) {
    lines.push(
      'Auto memory is turned off in settings (autoMemoryEnabled: false), so there is no memory to load either way.',
    )
  }

  const parts = [
    kept.isSectionDropped && 'the memory prompt section',
    kept.files.length > 0 && plural(kept.files.length, 'memory file'),
    kept.attachments.length > 0 && `attachments: ${kept.attachments.join(', ')}`,
    kept.blockedCalls > 0 && plural(kept.blockedCalls, 'blocked tool call'),
  ].filter(Boolean)

  if (parts.length > 0) lines.push(`Kept out so far: ${parts.join(' · ')}.`)

  return lines.join('\n')
}
