import { mock } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'
import type { On } from 'claude-code'

export const HOME = '/Users/me'
export const MEMORY_FILE = `${HOME}/.claude/projects/-Users-me-Code-game/memory/MEMORY.md`
export const SURFACES = ['terminal', 'desktop'] as const

// A skill listing as the engine words it: one skill per "- name:" line, a
// description that runs on over a second line, and a plugin's prefixed skill.
export const LISTING = [
  'The following skills are available for use with the Skill tool:',
  '',
  '- crisp: Keeps prose plain, specific, and human.',
  '- dataviz: Use this skill whenever you are about to chart.',
  '- claude-api: Reference for the Claude API.',
  'TRIGGER — read BEFORE opening the target file.',
  '- anthropic-skills:pdf: Use this skill whenever the user wants PDFs.',
].join('\n')

export const BAND_PROPS = {
  hasSurvey: false,
  isWorking: false,
  maxRows: 10,
  bodyColumns: 100,
  scroll: { offset: 0, bodyRows: 9 },
  view: {},
}

const PANE_PROPS = {
  title: 'Thread setup',
  isFocused: false,
  bodyColumns: 80,
  placement: 'dock' as const,
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
}

type EngineOptions = {
  /** What the plugin's store holds at the start. */
  store?: Record<string, unknown>
  /** What `$.settings.read()` answers. */
  settings?: Record<string, unknown>
}

/**
 * Stands in for the engine beneath the plugin. Every hook goes in before the
 * test's first call on $. Answers with the panes the plugin asked to open and
 * the notices it showed.
 */
export function engine(on: On, options: EngineOptions = {}) {
  const seen = { opened: [] as string[], toasts: [] as string[] }

  mock.store(on, options.store ?? {})
  mock.env(on, { HOME })
  on('settings.read', () => ({ value: options.settings ?? {} }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('command.list', () => ({
    value: [{ name: 'crisp', description: 'Keeps prose plain.', source: 'user' as const }],
  }))
  on('session.messages', () => ({ value: [] }))
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('classic.SessionStart', () => ({}))
  on('prompt.submit', ($, e) => ({ text: e.text }))
  on('prompt.section', () => ({ text: 'Your memories: ...' }))
  on('prompt.context', ($, e) => ({ blocks: e.blocks, instructionFiles: e.instructionFiles }))
  on('prompt.attachment', ($, e) => ({ text: e.text }))
  on('skill.prompt', ($, e) => ({ text: e.text }))
  on('tool.call', () => ({ result: 'ran' }))
  on('ui.invalidate', () => ({ value: undefined }))
  on('ui.toast', ($, e) => {
    seen.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.open', ($, e) => {
    seen.opened.push(e.id)
    return { value: { isPlaced: true } }
  })
  // The footer's labels come back as text, so a test can read what the plugin added.
  on('ui.render', ($, e) =>
    e.component === 'SessionMode'
      ? { type: 'Text', props: {}, children: [(e.props as { modes: string[] }).modes.join(', ')] }
      : { type: 'Box', props: {}, children: [] },
  )

  return seen
}

export function start($: Engine) {
  return $.session.start({ cwd: '/tmp/game', surface: 'terminal', isInteractive: true })
}

/** The desktop app starts its session with no surface yet. */
export function startOnDesktop($: Engine) {
  return $.session.start({ cwd: '/tmp/game', surface: null, isInteractive: false })
}

function command($: Engine, name: string, args: string) {
  return $.command.run({
    command: name,
    args,
    origin: { kind: 'composer' },
    presentation: { isFullscreen: false, columns: 100 },
  })
}

export function mem($: Engine, args: string) {
  return command($, 'mem', args)
}

export function setup($: Engine) {
  return command($, 'setup', '')
}

export function submit($: Engine, text: string) {
  return $.prompt.submit({ text, wait: false, origin: { kind: 'composer' } })
}

/** The first message's context, with a CLAUDE.md and the memory index behind it. */
export function context($: Engine) {
  return $.prompt.context({
    blocks: [{ name: 'claudeMd', text: 'instructions' }],
    instructionFiles: [
      { path: '/Users/me/Code/game/CLAUDE.md', kind: 'project', content: 'project rules' },
      { path: MEMORY_FILE, kind: 'memory', content: '- likes tabs' },
    ],
  })
}

export function listing($: Engine, agentId?: string) {
  return $.prompt.attachment({
    type: 'skill_listing',
    text: LISTING,
    origin: { kind: 'engine' },
    ...(agentId === undefined ? {} : { agentId }),
  })
}

export function pane($: Engine, surface: 'terminal' | 'desktop' = 'desktop', bodyColumns = 80) {
  return $.ui.mount({
    plugin: 'thread-setup',
    surface,
    component: 'Pane',
    requestId: 'thread-setup',
    props: { ...PANE_PROPS, bodyColumns },
  })
}

export function band($: Engine, surface: 'terminal' | 'desktop' = 'terminal') {
  return $.ui.mount({ plugin: 'thread-setup', surface, component: 'AbovePrompt', props: BAND_PROPS })
}

export function footer($: Engine) {
  return $.ui.mount({
    plugin: 'thread-setup',
    surface: 'terminal',
    component: 'SessionMode',
    props: { modes: ['focus'] },
  })
}
