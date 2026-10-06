import type { Elements, RenderElement, RenderSurface } from 'claude-code'

import type { DescriptionMode, Setup, SkillInfo, SkillView } from '../types'
import { action, choice, slotFor, toggle, toggleWidth } from './controls'
import type { Ui } from './controls'
import { groupSkills, shortName } from './skills'
import { isSameSetup } from './setup'
import { clip } from './text'

// The panel is a view: it draws from plain values and calls back through
// PanelActions, so nothing here touches the engine.

export const PANE_ID = 'thread-setup'
export const PANE_TITLE = 'Thread setup'

type InputElement = Elements['terminal']['Input']

/** What the panel draws from, read from the session's values. */
export type PanelInput = {
  thread: Setup
  start: Setup
  skills: SkillInfo[]
  /** False while `skills` is the last thread's list. */
  isLive: boolean
  query: string
  view: SkillView
  describe: DescriptionMode
  collapsed: readonly string[]
  /** The desktop status line above the prompt is wanted. */
  isStatusLineOn: boolean
  surface: RenderSurface
  width: number
}

export type PanelActions = {
  toggleMemory: () => unknown
  toggleSkill: (name: string) => unknown
  setAllSkills: (isOn: boolean) => unknown
  toggleGroup: (label: string) => unknown
  setQuery: (query: string) => unknown
  setView: (view: SkillView) => unknown
  setDescriptionMode: (mode: DescriptionMode) => unknown
  resetToDefaults: () => unknown
  saveAsDefaults: () => unknown
  toggleStatusLine: () => unknown
}

// Rows indent past the fold arrow of their group heading.
const INDENT_TERMINAL = 2
const INDENT_DESKTOP = 5
// What a row spends besides the name, indent and switch: the dot, the gap
// before the description, and the card's border and padding.
const ROW_CHROME = 14
// A filter this narrow shows each match's whole description.
const FULL_WHEN_AT_MOST = 3
// The status grid's columns.
const LABEL_COLUMN = 14
const MEMORY_COLUMN = 16
// Half a line between rows on desktop, where each row's toggle is a pill that
// would otherwise touch the next; the terminal's bracketed buttons need none.
const DESKTOP_ROW_GAP = 0.5
const DESKTOP_ROW_HOVER = '#ffffff0f'

/** The input with what the drawing works out from it. */
type Panel = PanelInput & {
  isAtDefaults: boolean
  off: ReadonlySet<string>
  shown: SkillInfo[]
  /** Whole descriptions: chosen, or a filter narrow enough to show them. */
  isFull: boolean
  /** A filter or a view is on: every match shows, folded groups included. */
  isNarrowed: boolean
  isTerminal: boolean
}

function toPanel(input: PanelInput): Panel {
  const query = input.query.trim().toLowerCase()
  const off = new Set(input.thread.skillsOff)
  const isInView = (skill: SkillInfo) => input.view === 'all' || (input.view === 'off') === off.has(skill.name)
  const matches = (skill: SkillInfo) =>
    query === '' || skill.name.toLowerCase().includes(query) || skill.details.toLowerCase().includes(query)
  const shown = input.skills.filter(skill => isInView(skill) && matches(skill))

  return {
    ...input,
    query,
    isAtDefaults: isSameSetup(input.thread, input.start),
    off,
    shown,
    isFull: input.describe === 'full' || (query !== '' && shown.length <= FULL_WHEN_AT_MOST),
    isNarrowed: query !== '' || input.view !== 'all',
    isTerminal: input.surface === 'terminal',
  }
}

/** One line of the status grid: this thread's, or what new threads start with. */
function statusGridRow(ui: Ui, panel: Panel, label: string, setup: Setup, isMain: boolean) {
  const { Box, Text } = ui
  const isMemoryOn = setup.memory === 'on'
  const offCount = setup.skillsOff.length
  const total = panel.skills.length

  return (
    <Box>
      <Box width={LABEL_COLUMN} flexShrink={0}>
        <Text bold={isMain} dimColor={!isMain}>
          {label}
        </Text>
      </Box>
      <Box width={MEMORY_COLUMN} flexShrink={0}>
        <Text color={isMemoryOn ? 'green' : undefined} dimColor={!isMemoryOn}>
          {isMemoryOn ? '●' : '○'}{' '}
        </Text>
        <Text dimColor={!isMain}>Memory {setup.memory}</Text>
      </Box>
      <Box>
        <Text color={offCount === 0 ? 'green' : 'yellow'}>● </Text>
        {offCount === 0 ? (
          <Text dimColor={!isMain}>All skills on</Text>
        ) : (
          <Box>
            <Text dimColor={!isMain}>
              {total > 0 ? `${Math.max(0, total - offCount)} skills on · ` : 'Skills: '}
            </Text>
            <Text color="yellow">{offCount} off</Text>
          </Box>
        )}
      </Box>
    </Box>
  )
}

function statusCard(ui: Ui, panel: Panel, actions: PanelActions) {
  const { Box, Text } = ui

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={panel.isAtDefaults ? undefined : 'yellow'}
      borderDimColor={panel.isAtDefaults}
      paddingX={1}
    >
      {statusGridRow(ui, panel, 'This thread', panel.thread, true)}
      {statusGridRow(ui, panel, 'New threads', panel.start, false)}
      {/* Always drawn, so the card keeps its size: only the colours change. */}
      <Box justifyContent="space-between" alignItems="center" marginTop={1}>
        {panel.isAtDefaults ? (
          <Text dimColor>Matches your defaults.</Text>
        ) : (
          <Text color="yellow">This thread differs from your defaults.</Text>
        )}
        <Box flexShrink={0} gap={1}>
          {action(ui, 'reset-default', 'Reset', actions.resetToDefaults, { isIdle: panel.isAtDefaults })}
          {action(ui, 'save-default', 'Save as default', actions.saveAsDefaults, {
            isIdle: panel.isAtDefaults,
            isMain: true,
          })}
        </Box>
      </Box>
    </Box>
  )
}

function memoryCard(ui: Ui, panel: Panel, actions: PanelActions) {
  const { Box, Text } = ui

  return (
    <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={1}>
      <Box justifyContent="space-between" alignItems="center">
        <Text bold>Memory</Text>
        {toggle(ui, 'memory', panel.thread.memory === 'on', actions.toggleMemory, panel.isTerminal)}
      </Box>
      <Text dimColor>Saved memories for this project. A change applies from your next message.</Text>
    </Box>
  )
}

/**
 * The mod's own settings, apart from the thread's: below the cards, under a
 * dim label rather than a heading. Its one setting is the status line, which
 * only the desktop app draws.
 */
function modSettings(ui: Ui, panel: Panel, actions: PanelActions) {
  const { Box, Text } = ui

  return (
    <Box flexDirection="column" paddingX={1} marginTop={1}>
      <Text dimColor>Mod settings</Text>
      <Box justifyContent="space-between" alignItems="center">
        <Text>Status line above the prompt</Text>
        {toggle(ui, 'status-line', panel.isStatusLineOn, actions.toggleStatusLine, panel.isTerminal)}
      </Box>
      <Text dimColor>Shows this thread's setup in every thread. Closing it there switches this off.</Text>
    </Box>
  )
}

function skillRow(ui: Ui, panel: Panel, actions: PanelActions, skill: SkillInfo) {
  const { Box, Text } = ui
  const isOff = panel.off.has(skill.name)
  const name = shortName(skill.name)
  const indent = panel.isTerminal ? INDENT_TERMINAL : INDENT_DESKTOP
  const room = panel.width - name.length - indent - toggleWidth(panel.isTerminal) - ROW_CHROME
  const blurb = clip(skill.description, Math.max(24, room))

  return (
    <Box
      key={`row-${skill.name}`}
      flexDirection="column"
      paddingLeft={indent}
      hover={panel.surface === 'desktop' ? { backgroundColor: DESKTOP_ROW_HOVER } : undefined}
    >
      <Box justifyContent="space-between" alignItems="center">
        <Box flexShrink={1}>
          <Text color={isOff ? undefined : 'green'} dimColor={isOff}>
            {isOff ? '○' : '●'}{' '}
          </Text>
          <Text bold={!isOff} dimColor={isOff} strikethrough={isOff}>
            {name}
          </Text>
          {/* An off skill keeps only its name, unless descriptions are full. */}
          {!panel.isFull && !isOff && (
            <Text dimColor wrap="truncate-end">
              {'  '}
              {blurb}
            </Text>
          )}
        </Box>
        {toggle(ui, `skill-${skill.name}`, !isOff, () => actions.toggleSkill(skill.name), panel.isTerminal)}
      </Box>
      {panel.isFull && (
        <Box paddingLeft={2} paddingBottom={1}>
          <Text dimColor wrap="wrap">
            {skill.details}
          </Text>
        </Box>
      )}
    </Box>
  )
}

function skillGroup(
  ui: Ui,
  panel: Panel,
  actions: PanelActions,
  group: { label: string; skills: SkillInfo[] },
) {
  const { Box, Button, Text } = ui
  const offCount = group.skills.filter(skill => panel.off.has(skill.name)).length
  const isFolded = panel.collapsed.includes(group.label) && !panel.isNarrowed
  const title = `${group.label} · ${group.skills.length}`

  return (
    <Box
      key={`group-${group.label}`}
      flexDirection="column"
      rowGap={panel.surface === 'desktop' ? DESKTOP_ROW_GAP : 0}
    >
      {/* The whole heading folds the group: a wide target, not just the arrow. */}
      <Box key={`head-${group.label}`} alignItems="center">
        {panel.isNarrowed ? (
          <Text bold>{title}</Text>
        ) : (
          <Button
            key={`fold-${group.label}`}
            label={`${isFolded ? '▸' : '▾'} ${title}`}
            plain={panel.isTerminal ? true : undefined}
            hover={{ underline: true }}
            onPress={() => actions.toggleGroup(group.label)}
          />
        )}
        {offCount > 0 && <Text color="yellow"> · {offCount} off</Text>}
      </Box>
      {!isFolded && group.skills.map(skill => skillRow(ui, panel, actions, skill))}
    </Box>
  )
}

function skillsCard(ui: Ui, Input: InputElement | undefined, panel: Panel, actions: PanelActions) {
  const { Box, Text } = ui
  const total = panel.skills.length
  const offCount = panel.skills.filter(skill => panel.off.has(skill.name)).length
  // Sized for the largest count the tabs can show, so a count that grows moves nothing.
  const tabSlot = slotFor([`Off ${total}`, `All ${total}`], panel.isTerminal)

  return (
    <Box flexDirection="column" gap={1} borderStyle="round" borderDimColor paddingX={1}>
      <Box flexDirection="column">
        <Box justifyContent="space-between" alignItems="center">
          <Text bold>Skills</Text>
          <Box alignItems="center" gap={1}>
            {action(ui, 'skills-all-on', 'All on', () => actions.setAllSkills(true), { isIdle: offCount === 0 })}
            {action(ui, 'skills-all-off', 'All off', () => actions.setAllSkills(false), {
              isIdle: total > 0 && offCount === total,
            })}
          </Box>
        </Box>
        <Text dimColor>Off hides a skill from Claude in this thread, and blocks it if called.</Text>
        {total === 0 && <Text dimColor>No skills read yet. They show up here after your next message.</Text>}
        {total > 0 && !panel.isLive && (
          <Text dimColor>
            Showing your last thread's skills until this thread's list is read, with your next message.
          </Text>
        )}
      </Box>
      {total > 0 && (
        <Box justifyContent="space-between" alignItems="center" flexWrap="wrap" columnGap={2}>
          <Box alignItems="center" columnGap={1} flexWrap="wrap">
            {Input !== undefined && (
              <Input
                key="skill-filter"
                placeholder="Filter skills"
                value={panel.query}
                onInput={value => actions.setQuery(value)}
                onSubmit={value => actions.setQuery(value)}
              />
            )}
            <Text dimColor>Show</Text>
            {choice(
              ui,
              'view',
              panel.view,
              [
                { value: 'all', label: `All ${total}` },
                { value: 'on', label: `On ${total - offCount}` },
                { value: 'off', label: `Off ${offCount}` },
              ],
              actions.setView,
              tabSlot,
            )}
          </Box>
          <Box alignItems="center" gap={1}>
            <Text dimColor>Descriptions</Text>
            {choice(
              ui,
              'describe',
              panel.describe,
              [
                { value: 'line', label: 'One line' },
                { value: 'full', label: 'Full' },
              ],
              actions.setDescriptionMode,
            )}
          </Box>
        </Box>
      )}
      {groupSkills(panel.shown).map(group => skillGroup(ui, panel, actions, group))}
      {total > 0 && panel.shown.length === 0 && (
        <Text dimColor>{panel.view === 'off' && panel.query === '' ? 'No skills are off.' : 'No skill matches.'}</Text>
      )}
    </Box>
  )
}

/** The whole panel. `Input` is absent where the surface draws no text field. */
export function panelView(
  ui: Ui,
  Input: InputElement | undefined,
  input: PanelInput,
  actions: PanelActions,
): RenderElement {
  const { Box } = ui
  const panel = toPanel(input)

  return (
    <Box flexDirection="column" gap={1}>
      {statusCard(ui, panel, actions)}
      {memoryCard(ui, panel, actions)}
      {skillsCard(ui, Input, panel, actions)}
      {panel.surface === 'desktop' && modSettings(ui, panel, actions)}
    </Box>
  )
}
