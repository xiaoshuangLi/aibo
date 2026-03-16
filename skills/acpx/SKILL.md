---
name: acpx
description: Use acpx_execute to communicate with local AI coding agents over the ACP (Agent Client Protocol). Covers persistent sessions, one-shot exec, named parallel sessions, session management, and cooperative cancellation.
---

# acpx Skill — ACP Protocol for Local Coding Agents

## When to use this skill

Use `acpx_execute` when you need to communicate with a local AI coding agent (codex, claude, gemini, cursor, copilot) over the **Agent Client Protocol (ACP)** instead of invoking their raw CLI directly.

Prefer `acpx_execute` over the individual CLI tools (`codex_execute`, `claude_execute`, etc.) when you need:
- **Persistent multi-turn sessions** — continue a conversation from where you left off
- **Named parallel sessions** — run backend and frontend workstreams simultaneously in the same repo
- **Prompt queueing** — submit prompts while one is already running
- **Cooperative cancellation** — cancel an in-flight prompt without tearing down the session
- **Structured output** — typed ACP messages rather than raw terminal scraping

## Supported agents

| `agent` value | Underlying tool |
|--------------|----------------|
| `codex`      | OpenAI Codex CLI |
| `claude`     | Claude Code CLI |
| `gemini`     | Gemini CLI (`gemini --acp`) |
| `cursor`     | Cursor agent (`cursor-agent acp`) |
| `copilot`    | GitHub Copilot (`copilot --acp --stdio`) |
| `pi`         | Pi Coding Agent |
| `openclaw`   | OpenClaw ACP bridge |
| `kimi`       | Kimi Coding Agent |
| `opencode`   | OpenCode CLI |
| `kiro`       | Kiro Agent |
| `kilocode`   | KiloCode Agent |
| `qwen`       | Qwen Coding Agent |
| `droid`      | Droid Agent |

Unknown names are treated as raw ACP server commands.

## Key parameters

| Parameter      | Description |
|----------------|-------------|
| `agent`        | ACP agent name (see table above) |
| `prompt`       | Task or question to send |
| `mode`         | `"prompt"` (persistent, default) · `"exec"` (one-shot) · `"sessions_new"` · `"sessions_list"` · `"sessions_close"` · `"cancel"` |
| `session_name` | Named session for parallel workstreams (`-s` flag) |
| `cwd`          | Working directory (scopes the session) |
| `approve`      | `"approve-all"` (default) · `"approve-reads"` · `"deny-all"` |
| `timeout`      | Milliseconds (default: 6 000 000 = 100 min) |

## Typical workflows

### 1. One-shot task (no saved session)

```json
{
  "agent": "codex",
  "prompt": "Summarise the purpose of this repository in 3 lines",
  "mode": "exec"
}
```

### 2. Persistent session — multi-turn conversation

```json
// Turn 1 — create a session first
{ "agent": "codex", "mode": "sessions_new" }

// Turn 2 — send the first prompt
{ "agent": "codex", "prompt": "Find the flaky test and describe the root cause" }

// Turn 3 — follow up in the same session
{ "agent": "codex", "prompt": "Apply the minimal fix and run the tests" }
```

### 3. Named parallel sessions

```json
// Backend workstream
{ "agent": "codex", "session_name": "backend", "prompt": "Implement token pagination for the /users endpoint" }

// Frontend workstream (runs in parallel)
{ "agent": "gemini", "session_name": "frontend", "prompt": "Add an infinite-scroll component for the user list" }
```

### 4. Cancel an in-flight prompt

```json
{ "agent": "codex", "mode": "cancel" }
```

### 5. List existing sessions

```json
{ "agent": "codex", "mode": "sessions_list" }
```

### 6. Close a session

```json
{ "agent": "codex", "mode": "sessions_close", "session_name": "backend" }
```

## Lark passthrough mode

When running in Lark mode, users can enter **ACP passthrough** to talk directly to a coding agent without going through the main AI model.

### Via slash command
```
/acp codex              # Enter passthrough mode with codex
/acp codex backend      # Enter passthrough with named session "backend"
/acp status             # Check current passthrough state
/acp stop               # Exit passthrough mode
```

### Via natural language (recommended)

When the user asks to start an interactive session with a coding tool — e.g. "用 claude 帮我修复这个 bug，然后我想直接和 claude 对话" — call `acpx_execute` with `start_passthrough: true`:

```json
{
  "agent": "claude",
  "prompt": "Fix the failing tests in src/",
  "start_passthrough": true
}
```

After this call completes, AIBO will automatically:
1. Send a Lark notification titled **"🔗 ACP [claude] 透传中"** announcing that passthrough mode is active
2. Forward all subsequent Lark messages directly to the `claude` ACP session (no LLM involved)
3. Label every response from the agent with the title **"🔗 ACP [claude] 透传中"** so the user always knows they are in passthrough mode

The user can exit passthrough mode at any time by saying "退出 acp", "exit acp", or typing `/acp stop`.

**When to set `start_passthrough: true`:**
- The user explicitly says they want to chat directly with a coding tool
- The user asks to "enter" / "启动" / "开始" a direct session with an agent
- The user wants follow-up conversations to go straight to the agent without going through AIBO

In passthrough mode every Lark message is forwarded verbatim to `acpx <agent> <prompt>`. Responses stream back as ACP-titled progress updates and a final response card.

## Routing guidance

- Prefer `acpx_execute` with `mode: "prompt"` when you need to **continue a conversation** across multiple tool calls.
- Prefer `acpx_execute` with `mode: "exec"` for **self-contained, stateless tasks** that don't need session history.
- Fall back to the individual CLI tools (`codex_execute`, `claude_execute`, etc.) when `acpx` is not installed or when the task is strictly one-shot.
- Use `session_name` to isolate workstreams (e.g. `"backend"` vs `"frontend"`) so they don't interfere.

## Prerequisites

```bash
npm install -g acpx
```

The target coding agent (codex, claude, etc.) must also be installed and authenticated separately.
