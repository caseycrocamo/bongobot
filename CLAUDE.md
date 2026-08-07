# BongoBot — Project Instructions

## Subagents / custom agents

Agent definitions in this project live in **two** places, in two different formats:

- **`.claude/agents/`** — Claude Code subagents. These are the only ones Claude Code
  actually registers and can dispatch via the Agent tool. Currently: `codebase-explorer`.
- **`.github/agents/*.agent.md`** — GitHub Copilot agents (different tool, different format).
  Claude Code does **not** load these. They are Copilot-only.

When asked to "use all available agents" or to add/port an agent so it's usable in Claude Code,
remember: only `.claude/agents/` is registered by the harness. To make a `.github/agents/` Copilot
agent usable here, port it into a `.claude/agents/<name>.md` file (Claude Code frontmatter:
`name`, `description`, `tools`, `model`). A CLAUDE.md note alone cannot register an agent.
