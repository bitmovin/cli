# Command Reference

Full reference for all `bitmovin` commands. Every command also documents
itself with `--help`, and `bitmovin skill` prints this reference as markdown
for AI assistants.

- [AI Agent Setup](#ai-agent-setup)
- [AI Assistant Skills](#ai-assistant-skills)
- [Config](#config)
- [Encoding](#encoding)
- [Player](#player)
- [Analytics](#analytics)
- [Account](#account)
- [Output Formats](#output-formats)
- [OAuth Details](#oauth-details)

## AI Agent Setup

Set up AI coding agents with Bitmovin skills, Claude Code plugins, and the
Bitmovin MCP server ([mcp.bitmovin.com](https://mcp.bitmovin.com)) in one go.
Without flags this runs an interactive wizard that detects installed agents;
all choices are also available as flags for non-interactive use.

```bash
bitmovin agents setup                                # Interactive wizard
bitmovin agents setup --all-agents --yes             # All detected agents, no prompts
bitmovin agents setup --agent claude-code --yes      # A specific agent
bitmovin agents setup --agent codex --no-mcp --yes   # Skills only
bitmovin agents setup --dry-run                      # Show what would happen
```

Per agent this configures:

| Agent | Skills | MCP server |
|---|---|---|
| `claude-code` | Plugins via the [bitmovin/skills](https://github.com/bitmovin/skills) marketplace (`--plugin` to pick) | `claude mcp add` (user scope) |
| `codex` | `npx skills` | `[mcp_servers.bitmovin]` in `~/.codex/config.toml` |
| `gemini-cli` | `npx skills` | `mcpServers` entry in `~/.gemini/settings.json` |
| `cursor` | `npx skills` | `mcpServers` entry in `~/.cursor/mcp.json` |
| `pi` | `npx skills` | not supported yet |

The MCP server authenticates with your Bitmovin API key (`x-api-key` header).
The key is resolved from `--api-key`, `BITMOVIN_API_KEY`, or the CLI config;
the wizard offers to fetch one from
[dashboard.bitmovin.com/account](https://dashboard.bitmovin.com/account) if
none is found. Existing config files are backed up to `<file>.bak` before
being modified, and re-running the command is safe — already-configured steps
are skipped. Note that marketplace plugins are updated with
`claude plugin marketplace update bitmovin`, while copied skills are updated
by re-running setup.

## AI Assistant Skills

Install and manage Bitmovin AI assistant skills from [github.com/bitmovin/skills](https://github.com/bitmovin/skills). These commands delegate to the open [`skills`](https://www.npmjs.com/package/skills) installer. For a guided setup that also connects the MCP server, use `bitmovin agents setup` above.

```bash
bitmovin skills list                  # List available Bitmovin skills
bitmovin skills add --skill bitmovin  # Install a specific skill
bitmovin skills add --all             # Install all Bitmovin skills
bitmovin skills remove --skill bitmovin
```

Use `--agent` with agent IDs supported by `npx skills`, for example `pi`, `claude-code`, `codex`, or `gemini-cli`.

## Config

```bash
bitmovin config set api-key <key>              # Set API key
bitmovin config set organization <id>          # Set active organization
bitmovin config set default-region <region>    # Set default cloud region
bitmovin config show                           # Show current config
bitmovin config list organizations             # List available organizations
```

## Encoding

### Templates

The recommended way to encode. Define your entire workflow in a single [YAML template](https://developer.bitmovin.com/encoding/docs/encoding-templates).

```bash
bitmovin encoding templates start ./template.yaml --watch   # Start from file
bitmovin encoding templates start --id <id> --watch         # Start stored template
bitmovin encoding templates create ./template.yaml --name "Standard VOD"
bitmovin encoding templates list
bitmovin encoding templates get <id>
bitmovin encoding templates delete <id>
bitmovin encoding templates validate ./template.yaml        # Validate against schema
```

### Jobs

```bash
bitmovin encoding jobs list [--status running|finished|error]
bitmovin encoding jobs get <id>
bitmovin encoding jobs status <id> [--watch]    # Live progress bar with --watch
bitmovin encoding jobs start <id> [--watch]
bitmovin encoding jobs stop <id>
bitmovin encoding jobs delete <id>
bitmovin encoding jobs live <id>                # Encoder IP, stream keys, SRT inputs
```

### Inputs & Outputs

```bash
bitmovin encoding inputs list [--type s3|gcs|http|https|azure]
bitmovin encoding inputs get <id>
bitmovin encoding inputs create s3 --name "Prod" --bucket my-bucket --access-key AK --secret-key SK
bitmovin encoding inputs create gcs --name "Staging" --bucket my-bucket --access-key AK --secret-key SK
bitmovin encoding inputs create https --name "CDN" --host storage.example.com
bitmovin encoding inputs delete <id>

bitmovin encoding outputs list [--type s3|gcs|azure]
bitmovin encoding outputs get <id>
bitmovin encoding outputs create s3 --name "CDN Out" --bucket my-bucket --access-key AK --secret-key SK
bitmovin encoding outputs create gcs --name "GCS Out" --bucket my-bucket --access-key AK --secret-key SK
bitmovin encoding outputs delete <id>
```

### Codec Configs

```bash
bitmovin encoding codecs list [--type video|audio] [--codec h264|h265|av1|aac|opus]
bitmovin encoding codecs get <id>              # auto-detects codec type
bitmovin encoding codecs create h264 --name "1080p" --bitrate 4800000 --height 1080 --profile HIGH
bitmovin encoding codecs create h265 --name "4K HEVC" --bitrate 8000000 --height 2160
bitmovin encoding codecs create aac --name "Stereo 128k" --bitrate 128000
bitmovin encoding codecs delete <id>            # auto-detects codec type
```

### Manifests & Stats

```bash
bitmovin encoding manifests list [--type dash|hls|smooth]
bitmovin encoding manifests get <id> --type dash
bitmovin encoding manifests delete <id> --type dash

bitmovin encoding stats [--from 2024-01-01] [--to 2024-03-31]
```

## Player

```bash
bitmovin player licenses list
bitmovin player licenses get <id>
bitmovin player licenses create --name "Production"
bitmovin player licenses update <id> --name "New Name"

bitmovin player domains list <license-id-or-key-or-name>
bitmovin player domains add <license-id-or-key-or-name> --url https://example.com
bitmovin player domains remove <license-id-or-key-or-name> <domain-id>

bitmovin player analytics activate <license-id> --analytics-key <key>
bitmovin player analytics deactivate <license-id>
```

## Analytics

```bash
bitmovin analytics licenses list
bitmovin analytics licenses get <id>
bitmovin analytics licenses create --name "Prod Analytics" [--timezone Europe/Vienna]
bitmovin analytics licenses update <id> --name "New Name" [--ignore-dnt] [--timezone UTC]

bitmovin analytics domains list <license-id-or-key-or-name>
bitmovin analytics domains add <license-id-or-key-or-name> --url https://example.com
bitmovin analytics domains remove <license-id-or-key-or-name> <domain-id>
```

## Account

```bash
bitmovin account info
```

## Output Formats

By default, the CLI outputs human-readable tables when used interactively. For scripting and automation, use `--json` and `--jq`:

```bash
# JSON output
bitmovin encoding jobs list --json

# Filter with jq
bitmovin encoding jobs list --json --jq '.[].id'
bitmovin player licenses list --jq '[.[] | {name, licenseKey}]'

# Pipe-friendly: colors and spinners are automatically disabled when stdout is not a TTY
bitmovin encoding jobs list | head -5
```

**Design principles** (inspired by [gh](https://github.com/cli/cli)):
- `--json` outputs structured JSON to stdout
- `--jq` filters JSON with [jq](https://jqlang.github.io/jq/) expressions (implies `--json`)
- Status messages always go to stderr, data to stdout
- Colors and spinners are disabled when piped

### Global Flags

| Flag | Description |
|------|-------------|
| `--json` / `-j` | Output JSON to stdout |
| `--jq <expr>` | Filter JSON with a jq expression |
| `--api-key <key>` | Override the configured API key |
| `--quiet` / `-q` | Suppress non-essential output |

## OAuth Details

`bitmovin login` opens a browser for OAuth (PKCE) and stores the resulting
session in `~/.config/bitmovin/config.json` with file mode `0600`. Tokens
are kept as plain JSON on disk (no OS keychain yet — tracked as a follow-up).
Access tokens are refreshed silently in the background; you only need to log
in again when the refresh token is no longer valid. The callback uses a fixed
loopback port (`http://127.0.0.1:27315/callback`). To target a different IdP set
`BITMOVIN_OAUTH_ISSUER`, `BITMOVIN_OAUTH_CLIENT_ID`, `BITMOVIN_OAUTH_SCOPE`,
`BITMOVIN_OAUTH_REDIRECT_PORT`, or override individual URLs with
`BITMOVIN_OAUTH_AUTHORIZE_URL` and `BITMOVIN_OAUTH_TOKEN_URL`.

Use `bitmovin login --print-url` to print the authorize URL instead of opening
a browser (useful over SSH), and `bitmovin logout` to forget the stored session.
