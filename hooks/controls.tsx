import type { Elements, RenderSurface } from 'claude-code'

// Every button the panel and the band draw comes from here, under one rule:
// bright means on, selected, or worth pressing now; grey and dimmed is the rest.

export type Ui = Elements[RenderSurface]

// Controls whose label changes ("On" to "Off", a count) sit in slots of a fixed
// width, so nothing beside them moves: the longest label, and room for the
// terminal's "[ " and " ]", or a desktop pill's padding.
const TOGGLE_LABELS = ['On', 'Off'] as const
const SLOT_ROOM_TERMINAL = 4
const SLOT_ROOM_DESKTOP = 3

export function slotFor(labels: readonly string[], isTerminal: boolean) {
  const room = isTerminal ? SLOT_ROOM_TERMINAL : SLOT_ROOM_DESKTOP

  return Math.max(...labels.map(label => label.length)) + room
}

export function toggleWidth(isTerminal: boolean) {
  return slotFor(TOGGLE_LABELS, isTerminal)
}

/**
 * A switch: one button whose label is its state, bright when on and dimmed
 * when off. A press flips whatever the state is then, not what was drawn.
 */
export function toggle(ui: Ui, key: string, isOn: boolean, onToggle: () => unknown, isTerminal: boolean) {
  const { Box, Button } = ui

  return (
    <Box width={toggleWidth(isTerminal)} justifyContent="center" flexShrink={0}>
      <Button
        key={key}
        label={isOn ? 'On' : 'Off'}
        variant={isOn ? 'primary' : 'secondary'}
        dimColor={!isOn}
        onPress={() => onToggle()}
      />
    </Box>
  )
}

/**
 * One of a few options: the selected one bright, the others dimmed. Given a
 * slot, each option sits in one of that width, for labels that change (a
 * count); without, they sit side by side.
 */
export function choice<T extends string>(
  ui: Ui,
  prefix: string,
  selected: T,
  options: readonly { value: T; label: string }[],
  onPick: (value: T) => unknown,
  slot?: number,
) {
  const { Box, Button } = ui
  const button = (option: { value: T; label: string }) => (
    <Button
      key={`${prefix}-${option.value}`}
      label={option.label}
      variant={selected === option.value ? 'primary' : 'secondary'}
      dimColor={selected !== option.value}
      onPress={() => onPick(option.value)}
    />
  )

  if (slot === undefined) {
    return (
      <Box flexShrink={0} gap={1}>
        {options.map(button)}
      </Box>
    )
  }

  return (
    <Box flexShrink={0}>
      {options.map(option => (
        <Box key={`${prefix}-slot-${option.value}`} width={slot} justifyContent="center">
          {button(option)}
        </Box>
      ))}
    </Box>
  )
}

type ActionOptions = {
  /** It would do nothing now: dimmed. */
  isIdle?: boolean
  /** The one thing worth pressing here: bright, unless it's idle. */
  isMain?: boolean
  /** It closes what it sits in; a desktop draws its own close control for it. */
  isDismiss?: boolean
}

/** A button that does something once: grey, dimmed while it would do nothing. */
export function action(ui: Ui, key: string, label: string, onPress: () => unknown, options: ActionOptions = {}) {
  const { Button } = ui
  const isIdle = options.isIdle === true

  return (
    <Button
      key={key}
      label={label}
      variant={options.isMain === true && !isIdle ? 'primary' : 'secondary'}
      dimColor={isIdle}
      role={options.isDismiss === true ? 'dismiss' : undefined}
      onPress={() => onPress()}
    />
  )
}
