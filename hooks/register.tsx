import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { DescriptionMode, MemoryMode, Setup, SkillInfo, SkillView } from '../types'
import { bandView, footerModes } from './band'
import type { BandActions } from './band'
import { isMemoryAttachment, MEMORY_DENIED, resolveMemoryDir, touchesMemory } from './memory'
import { PANE_ID, PANE_TITLE, panelView } from './panel'
import type { PanelActions, PanelInput } from './panel'
import { listingWithout, parseListing, skillDenied, toSkillInfo } from './skills'
import {
  FACTORY_SETUP,
  isSameSetup,
  isSkillInfo,
  isStringList,
  mergeSkills,
  NOTHING_KEPT_OUT,
  STORE_KEYS,
  toggled,
} from './setup'
import { describeSetup, statusReport } from './text'

// Everything that touches the engine lives in this file: the engine follows `$`
// only into functions declared beside the hook that hands it over. The other
// modules are plain logic and views.

// The session's values, which the UI draws from. The engine reads each one off
// this file's source, so they are declared here, with literal plugin and key.
const isThreadSetUp = atom({ plugin: 'thread-setup', key: 'isThreadSetUp' } as const, false)
const memory = atom({ plugin: 'thread-setup', key: 'memory' } as const, FACTORY_SETUP.memory)
const skillsOff = atom({ plugin: 'thread-setup', key: 'skillsOff' } as const, [] as string[])
const defaults = atom({ plugin: 'thread-setup', key: 'defaults' } as const, FACTORY_SETUP)
const keptOut = atom({ plugin: 'thread-setup', key: 'keptOut' } as const, NOTHING_KEPT_OUT)
const isBandOpen = atom({ plugin: 'thread-setup', key: 'isBandOpen' } as const, false)
const skills = atom({ plugin: 'thread-setup', key: 'skills' } as const, [] as SkillInfo[])
const isSkillListLive = atom({ plugin: 'thread-setup', key: 'isSkillListLive' } as const, false)
const skillQuery = atom({ plugin: 'thread-setup', key: 'skillQuery' } as const, '')
const skillView = atom({ plugin: 'thread-setup', key: 'skillView' } as const, 'all' as SkillView)
const descriptionMode = atom(
  { plugin: 'thread-setup', key: 'descriptionMode' } as const,
  'line' as DescriptionMode,
)
const collapsedGroups = atom(
  { plugin: 'thread-setup', key: 'collapsedGroups' } as const,
  [] as string[],
)

const MEM_USAGE = 'Usage: /mem [on | off | status | default on | default off]'

// Read from settings at each load, so the memory guard checks no file per call.
let customMemoryDir: string | undefined

// ── Reading and writing the session's values ─────────────────────────────

async function loadStored($: EngineInterface) {
  const storedMemory = await $.store.get(STORE_KEYS.defaultMemory)
  const storedOff = await $.store.get(STORE_KEYS.defaultSkillsOff)
  await update($, defaults, () => ({
    memory: storedMemory === 'on' ? 'on' : 'off',
    skillsOff: isStringList(storedOff) ? storedOff : [],
  }))

  const folded = await $.store.get(STORE_KEYS.collapsedGroups)
  if (isStringList(folded)) await update($, collapsedGroups, () => folded)

  if ((await $.store.get(STORE_KEYS.descriptionMode)) === 'full') {
    await update($, descriptionMode, () => 'full')
  }

  // Until this thread's skill listing arrives, the panel shows the last one seen.
  if ((await read($, skills)).length === 0) {
    const known = await $.store.get(STORE_KEYS.knownSkills)
    if (Array.isArray(known)) await update($, skills, () => known.filter(isSkillInfo))
  }
}

async function readSettings($: EngineInterface) {
  return (await $.settings.read()) as Record<string, unknown>
}

async function loadMemorySettings($: EngineInterface) {
  customMemoryDir = resolveMemoryDir((await readSettings($)).autoMemoryDirectory, await $.env.get('HOME'))
}

async function currentSetup($: EngineInterface): Promise<Setup> {
  return { memory: await read($, memory), skillsOff: await read($, skillsOff) }
}

async function isMemoryOn($: EngineInterface) {
  return (await read($, memory)) === 'on'
}

async function setMemory($: EngineInterface, mode: MemoryMode) {
  await update($, memory, () => mode)
  // Each of these answers is cached by the engine; ask again under the new mode.
  $.ui.invalidate('prompt.section')
  $.ui.invalidate('prompt.context')
  $.ui.invalidate('prompt.attachment')
}

async function setSkillsOff($: EngineInterface, names: readonly string[]) {
  await update($, skillsOff, () => [...new Set(names)].sort())
  // The skill listing is an attachment; ask for it again so it drops or regains them.
  $.ui.invalidate('prompt.attachment')
}

async function toggleSkill($: EngineInterface, name: string) {
  await update($, skillsOff, names => toggled(names, name))
  $.ui.invalidate('prompt.attachment')
}

/** All on, or every skill of the current list off. */
async function setAllSkills($: EngineInterface, isOn: boolean) {
  await setSkillsOff($, isOn ? [] : (await read($, skills)).map(skill => skill.name))
}

async function applyDefaults($: EngineInterface) {
  const start = await read($, defaults)
  await setMemory($, start.memory)
  await setSkillsOff($, start.skillsOff)
}

async function saveDefaults($: EngineInterface, setup: Setup) {
  await $.store.set(STORE_KEYS.defaultMemory, setup.memory)
  await $.store.set(STORE_KEYS.defaultSkillsOff, setup.skillsOff)
  await update($, defaults, () => setup)
}

/** Brings the thread back to the defaults; nothing to do when it already matches them. */
async function resetToDefaults($: EngineInterface) {
  if (isSameSetup(await currentSetup($), await read($, defaults))) return
  await applyDefaults($)
}

async function saveThreadAsDefaults($: EngineInterface) {
  const setup = await currentSetup($)
  if (isSameSetup(setup, await read($, defaults))) return
  await saveDefaults($, setup)
  $.ui.toast(`New threads start with ${describeSetup(setup)}`)
}

/** A new conversation in this session (/clear): the defaults again, and the switch row. */
async function startFresh($: EngineInterface) {
  await applyDefaults($)
  await update($, keptOut, () => NOTHING_KEPT_OUT)
  await setBandOpen($, true)
}

async function setBandOpen($: EngineInterface, isOpen: boolean) {
  await update($, isBandOpen, () => isOpen)
}

/** Takes in the main thread's skill listing, and keeps it for the next thread's panel. */
async function rememberSkills($: EngineInterface, seen: SkillInfo[]) {
  // The first listing replaces the last thread's; later ones (skills added) merge in.
  const earlier = (await read($, isSkillListLive)) ? await read($, skills) : []
  const merged = mergeSkills(earlier, seen)
  await update($, skills, () => merged)
  await update($, isSkillListLive, () => true)
  await $.store.set(STORE_KEYS.knownSkills, merged)
}

async function toggleGroup($: EngineInterface, label: string) {
  await update($, collapsedGroups, groups => toggled(groups, label))
  await $.store.set(STORE_KEYS.collapsedGroups, await read($, collapsedGroups))
}

async function openPanel($: EngineInterface) {
  // Focused, the panel takes the first click as a press rather than as focus.
  await $.ui.open({ id: PANE_ID, title: PANE_TITLE, focus: true })
}

// ── What the views draw from, and what their buttons do ──────────────────

async function readPanelInput($: EngineInterface, surface: PanelInput['surface'], width: number) {
  const input: PanelInput = {
    thread: await currentSetup($),
    start: await read($, defaults),
    skills: await read($, skills),
    isLive: await read($, isSkillListLive),
    query: await read($, skillQuery),
    view: await read($, skillView),
    describe: await read($, descriptionMode),
    collapsed: await read($, collapsedGroups),
    surface,
    width,
  }

  return input
}

// Handlers run later, on a press: each reads the values it needs then, never
// the ones the drawing saw.
function panelActions($: EngineInterface): PanelActions {
  return {
    setMemory: mode => setMemory($, mode),
    toggleSkill: name => toggleSkill($, name),
    setAllSkills: isOn => setAllSkills($, isOn),
    toggleGroup: label => toggleGroup($, label),
    setQuery: query => update($, skillQuery, () => query),
    setView: view => update($, skillView, () => view),
    setDescriptionMode: async mode => {
      await update($, descriptionMode, () => mode)
      await $.store.set(STORE_KEYS.descriptionMode, mode)
    },
    resetToDefaults: () => resetToDefaults($),
    saveAsDefaults: () => saveThreadAsDefaults($),
  }
}

function bandActions($: EngineInterface): BandActions {
  return {
    setMemory: mode => setMemory($, mode),
    openPanel: () => openPanel($),
    close: () => setBandOpen($, false),
  }
}

// ── Hooks ────────────────────────────────────────────────────────────────

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'setup',
      description: 'Thread setup: memory and skills for this thread, and the defaults',
    })
    await $.command.register({
      name: 'mem',
      description: 'Memory for this thread: on, off, status, or set the default',
      argumentHint: 'on | off | status | default on|off',
    })
    await loadStored($)
    await loadMemorySettings($)
    // A reload leaves open sites drawn by the last load: redraw them with this one's handlers.
    $.ui.invalidate('ui.render')

    const hasMessages = (await $.session.messages()).length > 0
    // A hot reload fires session.start again; only the first load sets the thread up.
    if (!(await read($, isThreadSetUp))) {
      await update($, isThreadSetUp, () => true)
      await applyDefaults($)
      // Only the terminal is up before the first message. The desktop app starts
      // the session with that message, too late to choose: there, /setup opens it.
      await setBandOpen($, !hasMessages && e.surface === 'terminal')
    }
    // Loaded into a thread already under way: ask for the skill listing again to read it.
    if (hasMessages && !(await read($, isSkillListLive))) $.ui.invalidate('prompt.attachment')

    return next(e)
  })

  // /clear starts a new conversation in the same process. Both events below see
  // it; starting fresh is idempotent, so whichever one's state lands is right.
  on('classic.SessionStart', async ($, e, next) => {
    if (e.source === 'clear') await startFresh($)
    if (e.source === 'resume') await setBandOpen($, false)

    return next(e)
  })

  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') await startFresh($)

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    // The first real message settles the choice; slash commands (like /mem) don't.
    if (!e.text.trimStart().startsWith('/')) await setBandOpen($, false)

    return next(e)
  })

  // Commands

  on('command.run', { command: 'setup' }, async $ => {
    await openPanel($)

    return { text: `Thread setup: ${describeSetup(await currentSetup($))}.` }
  })

  on('command.run', { command: 'mem' }, async ($, e) => {
    const [verb = '', value = ''] = e.args.trim().toLowerCase().split(/\s+/)

    if (verb === 'on' || verb === 'off') {
      const hasStarted = (await $.session.messages()).length > 0
      await setMemory($, verb)
      const note = hasStarted ? ' It applies from the next message on.' : ''

      return { text: `Memory is ${verb} for this thread.${note}` }
    }

    if (verb === 'default' && (value === 'on' || value === 'off')) {
      await saveDefaults($, { ...(await read($, defaults)), memory: value })

      return { text: `New threads now start with memory ${value}.` }
    }

    // Bare /mem also opens the switch row, at any point in the thread.
    if (verb === '') await setBandOpen($, true)
    if (verb !== '' && verb !== 'status') return { text: MEM_USAGE }

    return {
      text: statusReport({
        thread: await currentSetup($),
        start: await read($, defaults),
        kept: await read($, keptOut),
        isAutoMemoryEnabled: (await readSettings($)).autoMemoryEnabled !== false,
      }),
    }
  })

  // Memory: kept from the model while off

  on('prompt.section', { name: 'memory' }, async ($, e, next) => {
    const computed = await next(e)
    if (computed.text === null || (await isMemoryOn($))) return computed

    await update($, keptOut, kept => ({ ...kept, isSectionDropped: true }))

    return { text: null }
  })

  on('prompt.context', async ($, e, next) => {
    const computed = await next(e)
    const files = computed.instructionFiles
    if (files === undefined || (await isMemoryOn($))) return computed

    const dropped = files.filter(file => file.kind === 'memory').map(file => file.path)
    if (dropped.length === 0) return computed

    await update($, keptOut, kept => ({ ...kept, files: [...new Set([...kept.files, ...dropped])] }))

    return { ...computed, instructionFiles: files.filter(file => file.kind !== 'memory') }
  })

  on('prompt.attachment', async ($, e, next) => {
    if (!isMemoryAttachment(e.type) || (await isMemoryOn($))) return next(e)

    await update($, keptOut, kept => ({
      ...kept,
      attachments: [...new Set([...kept.attachments, e.type])],
    }))

    return { text: null }
  })

  on('tool.call', async ($, e, next) => {
    const input = e as unknown as Record<string, unknown>
    if (!touchesMemory(String(e.tool), input, customMemoryDir) || (await isMemoryOn($))) return next(e)

    await update($, keptOut, kept => ({ ...kept, blockedCalls: kept.blockedCalls + 1 }))

    return { deny: MEMORY_DENIED }
  })

  // Skills: hidden from the listing and blocked while off

  on('prompt.attachment', { type: 'skill_listing' }, async ($, e, next) => {
    const listing = parseListing(e.text)
    if (listing.entries.length === 0) return next(e)

    // The main thread's listing is the one the panel shows; a subagent's is only filtered.
    if (e.agentId === undefined) {
      const commands = await $.command.list()
      const yours = new Set(commands.filter(command => command.source === 'user').map(command => command.name))
      await rememberSkills($, listing.entries.map(entry => toSkillInfo(entry, yours)))
    }

    const off = new Set(await read($, skillsOff))
    if (!listing.entries.some(entry => off.has(entry.name))) return next(e)

    const text = listingWithout(listing, off)

    return text === null ? { text: null } : next({ ...e, text })
  })

  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    if (!(await read($, skillsOff)).includes(e.skill)) return next(e)

    return { deny: skillDenied(e.skill) }
  })

  // A skill typed as /name, or preloaded, never goes through the Skill tool.
  on('skill.prompt', async ($, e, next) => {
    if (!(await read($, skillsOff)).includes(e.skill)) return next(e)

    return { text: skillDenied(e.skill) }
  })

  // UI

  on('ui.render', { component: 'Pane', requestId: PANE_ID }, async ($, e) => {
    const Input = e.surface === 'mobile' ? undefined : $.ui.resolve({ ...e, surface: e.surface }).Input
    const input = await readPanelInput($, e.surface, e.props.bodyColumns)

    return panelView($.ui.resolve(e), Input, input, panelActions($))
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const tree = bandView(
      $.ui.resolve(e),
      {
        isOpen: await read($, isBandOpen),
        hasSurvey: e.props.hasSurvey,
        surface: e.surface,
        thread: await currentSetup($),
      },
      bandActions($),
    )

    return tree ?? next(e)
  })

  on('ui.render', { component: 'SessionMode' }, async ($, e, next) => {
    const modes = footerModes(e.props.modes, await currentSetup($))

    return modes === undefined ? next(e) : next({ ...e, props: { ...e.props, modes } })
  })
}
