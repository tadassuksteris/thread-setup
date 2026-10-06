export type MemoryMode = 'on' | 'off'

/** A thread's switches: what this thread runs with, or what new threads start with. */
export type Setup = { memory: MemoryMode; skillsOff: string[] }

/** What the mod has kept from the model this thread while memory was off. */
export type KeptOut = {
  isSectionDropped: boolean
  files: string[]
  attachments: string[]
  blockedCalls: number
}

/** One skill as the skill listing names it. */
export type SkillInfo = {
  name: string
  /** The description's first line. */
  description: string
  /** The whole description, every line joined. */
  details: string
  /** The heading it is listed under: its plugin prefix, "Your skills" or "Built in". */
  group: string
}

/** Which skills the panel lists: every one, the ones on, or the ones off. */
export type SkillView = 'all' | 'on' | 'off'

/** How much of each description the panel shows. */
export type DescriptionMode = 'line' | 'full'

declare module 'claude-code' {
  interface PluginState {
    'thread-setup': {
      /** Set once this load has given the thread its defaults; a hot reload keeps it. */
      isThreadSetUp: boolean
      memory: MemoryMode
      skillsOff: string[]
      /** What new threads start with; kept across threads. */
      defaults: Setup
      keptOut: KeptOut
      /** The switch row above the prompt. */
      isBandOpen: boolean
      skills: SkillInfo[]
      /** False while `skills` is the last thread's list, before this thread's arrives. */
      isSkillListLive: boolean
      skillQuery: string
      skillView: SkillView
      /** Kept across threads. */
      descriptionMode: DescriptionMode
      /** Group headings folded shut; kept across threads. */
      collapsedGroups: string[]
    }
  }
}
