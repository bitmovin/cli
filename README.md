# Bitmovin CLI

The official command-line interface for [Bitmovin](https://bitmovin.com). Manage encodings, player licenses, analytics, and more — from your terminal.

## Install

```bash
npm install -g @bitmovin/cli
```

Requires Node.js 20+.

## Quick Start

```bash
# 1. Authenticate — either OAuth (recommended) or an API key
bitmovin login                                 # OAuth (browser-based)
# or
bitmovin config set api-key YOUR_API_KEY       # API key (https://dashboard.bitmovin.com/account)

# 2. Select an organization (optional)
bitmovin config list organizations
bitmovin config set organization ORG_ID

# 3. Start encoding
bitmovin encoding templates start ./my-encoding.yaml --watch
```

## Commands

| Command | What it does |
|---------|--------------|
| `bitmovin login` / `logout` | Browser-based OAuth (PKCE) sign-in |
| `bitmovin agents setup` | Set up AI coding agents with Bitmovin skills, plugins, and the MCP server |
| `bitmovin skills …` | Install individual AI assistant skills |
| `bitmovin config …` | API key, organization, and defaults |
| `bitmovin encoding …` | Templates, jobs, inputs/outputs, codecs, manifests, stats |
| `bitmovin player …` | Player licenses, domains, analytics linking |
| `bitmovin analytics …` | Analytics licenses and domains |
| `bitmovin account …` | Account information, organizations and sub-organizations |
| `bitmovin support tickets …` | List, read, file, and comment on Bitmovin support tickets |

### Support tickets

`bitmovin support tickets create` and `bitmovin support tickets comment` write to
a **real** support ticket that Bitmovin support engineers see and that cannot be
withdrawn via the API. Both print the exact payload to stderr — including under
`--json`, so a scripted run still records what was filed — and require an explicit
confirmation; `--yes` skips the prompt for scripting. The ticket is filed as the
user behind your credentials, whose name and email appear on it.
`--organization <org-id>` targets a sub-organization (list them with
`bitmovin account organizations list`).

Every command documents itself with `--help`. The full command reference with
examples lives in [docs/commands.md](docs/commands.md), and `bitmovin skill`
prints it as markdown for AI assistants.

## Use Bitmovin from your AI agent

One command connects your AI coding agents to Bitmovin — it installs the
[Bitmovin skills](https://github.com/bitmovin/skills) (as plugins on Claude
Code), and hooks up the [Bitmovin MCP server](https://mcp.bitmovin.com) so
your agent can query encodings, play streams, and analyze viewer data
directly:

```bash
bitmovin agents setup                       # Interactive wizard, detects installed agents
bitmovin agents setup --all-agents --yes    # Non-interactive
bitmovin agents setup --dry-run             # Show what would happen
```

Supported agents: `claude-code`, `codex`, `gemini-cli`, `cursor`, and `pi`.
Re-running is safe, modified config files are backed up to `<file>.bak`, and
[docs/commands.md](docs/commands.md#ai-agent-setup) has the per-agent details.

## Scripting

Human-readable tables when interactive; `--json` and `--jq` for automation
(design inspired by [gh](https://github.com/cli/cli) — data to stdout, status
to stderr, colors off when piped):

```bash
bitmovin encoding jobs list --json --jq '.[].id'
```

## Configuration

Config is stored in `~/.config/bitmovin/config.json` (mode `0600`). You can also set the API key via the `BITMOVIN_API_KEY` environment variable, or sign in with `bitmovin login` to store an OAuth session.

**Credential priority:** `--api-key` flag > `BITMOVIN_API_KEY` env var > stored OAuth session > `api-key` in config file.

See [docs/commands.md](docs/commands.md#oauth-details) for OAuth internals
(token storage, silent refresh, custom IdP overrides).

## License

MIT
