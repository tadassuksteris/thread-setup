import type { RenderElement, RenderSurface } from 'claude-code'

import type { Setup } from '../types'
import { action, toggle } from './controls'
import type { Ui } from './controls'
import { isSameSetup } from './setup'
import { plural } from './text'

// Like the panel, a view: plain values in, callbacks out.

type BandInput = {
  isOpen: boolean
  hasSurvey: boolean
  surface: RenderSurface
  thread: Setup
  start: Setup
  isStatusLineOn: boolean
}

export type BandActions = {
  toggleMemory: () => unknown
  openPanel: () => unknown
  close: () => unknown
  closeStatusLine: () => unknown
}

/** The desktop's stand-in for the footer labels it doesn't draw: this thread's setup, at a glance. */
function statusLine(ui: Ui, input: BandInput, actions: BandActions) {
  const { Box, Text } = ui
  const { memory, skillsOff } = input.thread
  const isMemoryOn = memory === 'on'
  const offCount = skillsOff.length

  return (
    <Box justifyContent="space-between" alignItems="center" gap={2}>
      <Box alignItems="center" gap={2} flexShrink={1}>
        <Text bold>Thread setup</Text>
        <Box>
          <Text color={isMemoryOn ? 'green' : undefined} dimColor={!isMemoryOn}>
            {isMemoryOn ? '●' : '○'}{' '}
          </Text>
          <Text>Memory {memory}</Text>
        </Box>
        <Box>
          <Text color={offCount === 0 ? 'green' : 'yellow'}>● </Text>
          {offCount === 0 ? (
            <Text>All skills on</Text>
          ) : (
            <Text color="yellow">{plural(offCount, 'skill')} off</Text>
          )}
        </Box>
        {!isSameSetup(input.thread, input.start) && <Text dimColor>Differs from your defaults</Text>}
      </Box>
      <Box alignItems="center" gap={1} flexShrink={0}>
        {action(ui, 'change', 'Change', actions.openPanel)}
        {action(ui, 'close-status', 'Close', actions.closeStatusLine, { isDismiss: true })}
      </Box>
    </Box>
  )
}

function switchRow(ui: Ui, input: BandInput, actions: BandActions) {
  const { Box, Text } = ui

  return (
    <Box gap={1} alignItems="center">
      <Text dimColor>Memory for this thread</Text>
      {toggle(ui, 'memory', input.thread.memory === 'on', actions.toggleMemory, input.surface === 'terminal')}
      <Text dimColor>·</Text>
      {action(ui, 'more', 'Skills & more', actions.openPanel)}
      {action(ui, 'dismiss', 'Dismiss', actions.close, { isDismiss: true })}
    </Box>
  )
}

/**
 * The band above the prompt: the switch row while it's open; on desktop, the
 * status line once it's closed. Undefined leaves the band to the engine.
 */
export function bandView(ui: Ui, input: BandInput, actions: BandActions): RenderElement | undefined {
  if (input.hasSurvey) return undefined
  if (input.isOpen) return switchRow(ui, input, actions)

  // The terminal shows the state in its footer; the desktop app doesn't draw
  // footer labels, so there the closed band keeps a status line instead.
  if (input.surface !== 'desktop' || !input.isStatusLineOn) return undefined

  return statusLine(ui, input, actions)
}

/** The footer's mode labels with this thread's switches added; undefined when there's none to add. */
export function footerModes(modes: readonly string[], thread: Setup) {
  const added: string[] = []
  // "memory paused" is the engine's own label for the same state.
  if (thread.memory === 'off' && !modes.includes('memory paused')) added.push('memory off')
  if (thread.skillsOff.length > 0) added.push(`${plural(thread.skillsOff.length, 'skill')} off`)

  return added.length === 0 ? undefined : [...modes, ...added]
}
