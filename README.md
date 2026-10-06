# thread-setup

A Claude Code mod for choosing, per thread, whether Claude uses auto memory and which skills it can see. `/setup` opens a panel with both switches and saves what new threads start with.

Built and tested on Claude Code 2.1.291 on macOS, in the terminal and in the desktop app's Code tab.

## What it does

**Memory.** Each thread starts with memory off unless you change the default. While it's off, the mod:

- removes the memory section from the system prompt
- drops auto-memory files from the context of the first message
- refuses tool calls that read or write the memory folder (`~/.claude/projects/<project>/memory/`, or the folder named by `autoMemoryDirectory`), and the `memory_*` tools

**Skills.** Any skill can be switched off for a thread. Claude no longer finds it in its skill list, and a call to it through the Skill tool or as `/name` is refused. Subagents get the same filtered list.

**Defaults.** "Save as default" stores the thread's switches as the starting point for new threads.

## Install

1. Clone the repo:

   ```bash
   git clone https://github.com/tadassuksteris/thread-setup ~/.claude/mods/thread-setup
   ```

2. Add these keys to `~/.claude/settings.json`, merged with what's already there:

   ```json
   {
     "autoMemoryEnabled": true,
     "env": {
       "CLAUDE_CODE_PLUGIN_DIRS": "~/.claude/mods/thread-setup"
     }
   }
   ```

   Auto memory has to be on: the mod can keep memory out of a thread, but it can't switch memory on. If `CLAUDE_CODE_PLUGIN_DIRS` already lists folders, add this one after a `:`.

3. Start a new session, in the terminal or the desktop app, and run `/setup`. The panel should open.

The mod starts every thread with memory off. If you'd rather have memory on by default, run `/mem default on` once.

To try the mod for one terminal session without changing settings:

```bash
claude --plugin-dir ~/.claude/mods/thread-setup
```

## Update

```bash
git -C ~/.claude/mods/thread-setup pull
```

Sessions started after the pull load the new version.

## Uninstall

1. In `~/.claude/settings.json`, remove the `CLAUDE_CODE_PLUGIN_DIRS` entry. Set `autoMemoryEnabled` back to `false` if you had it off before.
2. Delete `~/.claude/mods/thread-setup`.
3. To clear the choices the mod saved, delete `~/.claude/plugins/store/thread-setup_*.json`.

## Use

| Command | What it does |
| --- | --- |
| `/setup` | Opens the panel |
| `/mem` | Opens the memory switch above the prompt and prints the status |
| `/mem on`, `/mem off` | Switches memory for this thread |
| `/mem status` | Prints the status, including what was kept out so far |
| `/mem default on`, `/mem default off` | Sets memory for new threads |

The panel has three parts:

- A status card comparing this thread with your defaults, with Reset and Save as default.
- The memory switch.
- The skill list, grouped as your skills, each plugin's skills, and built-in skills. Click a heading to fold its group, and use the filter, the All/On/Off view or the description length to find a skill. Filtering down to three skills or fewer shows their full descriptions.

In the terminal, a new thread opens with the memory switch above the prompt, and the footer shows `memory off` and the number of skills off. The desktop app starts a session only when you send the first message, so there's nothing to show before that. Send `/setup` as the first message to choose before Claude reads anything. Once the session is running, the desktop app shows a status line above the prompt with a Change button.

## When a change takes effect

Claude reads memory and the skill list when a conversation starts. Choosing before the first message gives a clean thread. A change made later applies from the next message, but Claude has already seen what it read before.

Changing skills mid-thread sends the skill list again, so the next request can't reuse the prompt cache.

## Limits

- The mod fails open. If it doesn't load, or one of its hooks fails, memory is on for that session, because auto memory is on globally. A mod that fails to load gets a dim line in the transcript.
- The skill list is read from the message Claude receives, which names one skill per `- name: description` line. If a Claude Code update changes that format, the panel shows no skills. Skills already switched off are still refused when called.
- For Bash, the guard checks the command text for the memory folder's path. A command that reaches the folder without naming it isn't caught.
- Attachments that carry memory are recognised by name (anything with "memor" in it, except `nested_memory`, which is a CLAUDE.md in a subfolder).

## Files

| Path | Contents |
| --- | --- |
| `hooks/register.tsx` | The hooks, and every function that touches the engine (`$`) |
| `hooks/panel.tsx`, `hooks/band.tsx` | The panel and the row above the prompt, as views of plain data |
| `hooks/skills.ts` | Reading and filtering the skill list, grouping skills |
| `hooks/memory.ts` | Deciding whether a tool call touches auto memory |
| `hooks/setup.ts` | Comparing setups, store keys and checks on stored values |
| `hooks/text.ts` | Status wording |
| `types/index.d.ts` | The session values the mod keeps, declared for the engine |
| `tests/` | Tests, run with `claude plugin test` |

The engine follows `$` only into functions declared in the same file as the hook that passes it, and reads state names only from that file's source. That's why everything that reads or writes state lives in `register.tsx`, and the other modules take plain values.

The mod keeps your defaults, the last skill list, folded groups and the description length in Claude Code's plugin store (`~/.claude/plugins/store/thread-setup_*.json`).

## Development

```bash
claude plugin validate ~/.claude/mods/thread-setup
claude plugin test ~/.claude/mods/thread-setup
```

An interactive terminal session watches the folders in `CLAUDE_CODE_PLUGIN_DIRS` and reloads the mod when a file is saved. Desktop sessions also watch when `CLAUDE_CODE_PLUGIN_DIR_WATCH=1` is set.

## License

MIT. See [LICENSE](LICENSE).
