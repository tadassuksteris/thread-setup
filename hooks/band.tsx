import type { RenderElement, RenderSurface } from 'claude-code'

import type { MemoryMode, Setup } from '../types'
import type { Ui } from './panel'
import { describeSetup, plural } from './text'

// Like the panel, a view: plain values in, callbacks out.

export type BandInput = {
  isOpen: boolean
  hasSurvey: boolean
  surface: RenderSurface
  thread: Setup
}

export type BandActions = {
  setMemory: (mode: MemoryMode) => unknown
  openPanel: () => unknown
  close: () => unknown
}

/**
 * The band above the prompt: the switch row while it's open; on desktop, a
 * one-line status once it's closed. Undefined leaves the band to the engine.
 */
export function bandView(ui: Ui, input: BandInput, actions: BandActions): RenderElement | undefined {
  if (input.hasSurvey) return undefined
  // The terminal shows the state in its footer; the desktop app doesn't draw
  // footer labels, so there the closed band keeps a one-line status instead.
  if (!input.isOpen && input.surface !== 'desktop') return undefined

  const { Box, Button, Text } = ui

  if (!input.isOpen) {
    return (
      <Box gap={1} alignItems="center">
        <Text dimColor>Thread setup · {describeSetup(input.thread)}</Text>
        <Button key="change" label="Change" dimColor onPress={() => actions.openPanel()} />
      </Box>
    )
  }

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

/** The footer's mode labels with this thread's switches added; undefined when there's none to add. */
export function footerModes(modes: readonly string[], thread: Setup) {
  const added: string[] = []
  // "memory paused" is the engine's own label for the same state.
  if (thread.memory === 'off' && !modes.includes('memory paused')) added.push('memory off')
  if (thread.skillsOff.length > 0) added.push(`${plural(thread.skillsOff.length, 'skill')} off`)

  return added.length === 0 ? undefined : [...modes, ...added]
}
