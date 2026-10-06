// Auto memory lives in ~/.claude/projects/<project>/memory/, unless settings
// name another folder (autoMemoryDirectory).
const DEFAULT_MEMORY_DIR = /\.claude\/projects\/[^/\s'"]+\/memory(\/|\b|$)/
const MEMORY_TOOLS = new Set(['memory_list', 'memory_read', 'memory_write'])
// Tool inputs that may name a path; Bash names one inside its command.
const PATH_FIELDS = ['file_path', 'notebook_path', 'path', 'command'] as const

export const MEMORY_DENIED =
  'Memory is off for this thread (thread-setup mod), so memory files and tools are blocked. ' +
  'Carry on without them; the person can turn memory back on with /mem on.'

/** A settings path with `~/` expanded and no trailing slash; undefined when it names nothing. */
export function resolveMemoryDir(dir: unknown, home: string | undefined) {
  if (typeof dir !== 'string' || dir.trim() === '') return undefined
  const expanded = dir.startsWith('~/') && home !== undefined ? `${home}/${dir.slice(2)}` : dir

  return expanded.replace(/\/+$/, '')
}

/** True when a tool call would read or write auto memory. */
export function touchesMemory(tool: string, input: Record<string, unknown>, customDir?: string) {
  if (MEMORY_TOOLS.has(tool.split('__').at(-1) ?? tool)) return true

  return PATH_FIELDS.some(field => {
    const value = input[field]
    if (typeof value !== 'string') return false

    return DEFAULT_MEMORY_DIR.test(value) || (customDir !== undefined && value.includes(customDir))
  })
}

/** An attachment that carries auto memory; nested_memory is a CLAUDE.md in a subfolder. */
export function isMemoryAttachment(type: string) {
  return /memor/i.test(type) && type !== 'nested_memory'
}
