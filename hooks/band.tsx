import type { RenderElement, RenderSurface } from 'claude-code'

import type { MemoryMode, Setup } from '../types'
import type { Ui } from './panel'
import { isSameSetup } from './setup'
import { plural } from './text'

// Like the panel, a view: plain values in, callbacks out.

export type BandInput = {
  isOpen: boolean
  hasSurvey: boolean
  surface: RenderSurface
  thread: Setup
  start: Setup
  isStatusLineOn: boolean
}

export type BandActions = {
  setMemory: (mode: MemoryMode) => unknown
  openPanel: () => unknown
  close: () => unknown
  closeStatusLine: () => unknown
}

/** The desktop's stand-in for the footer labels it doesn't draw: this thread's setup, at a glance. */
function statusLine(ui: Ui, input: BandInput, actions: BandActions) {
  const { Box, Button, Text } = ui
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
        <Button key="change" label="Change" dimColor onPress={() => actions.openPanel()} />
        {/* A desktop draws a dismiss button as its own close control, at the band's end. */}
        <Button
          key="close-status"
          label="Close"
          role="dismiss"
          dimColor
          onPress={() => actions.closeStatusLine()}
        />
      </Box>
    </Box>
  )
}

function switchRow(ui: Ui, input: BandInput, actions: BandActions) {
  const { Box, Button, Text } = ui
  const mode = input.thread.memory

  return (
    <Box gap={1} alignItems="center">
      <Text dimColor>Memory for this thread</Text>
      <Box gap={1}>
        <Button
          key="memory-on"
          label="On"
          variant={mode === 'on' ? 'primary' : 'secondary'}
          onPress={() => actions.setMemory('on')}
        />
        <Button
          key="memory-off"
          label="Off"
          variant={mode === 'off' ? 'primary' : 'secondary'}
          onPress={() => actions.setMemory('off')}
        />
      </Box>
      <Text dimColor>·</Text>
      <Button key="more" label="Skills & more" dimColor onPress={() => actions.openPanel()} />
      <Button key="dismiss" label="Dismiss" role="dismiss" dimColor onPress={() => actions.close()} />
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
