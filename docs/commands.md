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
- [Support](#support)
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

### Organizations

Lists every organization your credentials can see — root organizations and their
sub-organizations in one listing, each row carrying `type`
(`ROOT_ORGANIZATION` / `SUB_ORGANIZATION`), `parentId`, and whether it is the
`active` one (the organization from `bitmovin config set organization`).
Sub-organizations are listed directly beneath their parent.

```bash
bitmovin account organizations list                    # Everything, parent-first
bitmovin account organizations list --type root        # Only root organizations
bitmovin account organizations list --type sub         # Only sub-organizations
bitmovin account organizations list --parent <org-id>  # Only that parent's sub-organizations
bitmovin account organizations list --json --jq '.[] | select(.parentId != null) | .id'
```

`--type` and `--parent` cannot be combined, and `--parent` requires an organization
your credentials can see — an unknown id exits with an error rather than an empty
list.

This command takes no `--organization`: the listing is scoped by the credentials
themselves, not by `X-Tenant-Org-Id`, so the flag would have no effect. Use
`--parent <org-id>` to narrow it to one organization's sub-organizations.

The hierarchy is derived from the `parentId` of the flat organization listing, which
the CLI pages through in full. The API's per-organization `sub-organizations`
endpoint is deliberately not used: it answers `1001 An organization with the given
id does not exist` for organization ids that the listing plainly returns.

## Support

Support tickets filed with Bitmovin support (the same tickets you see in the
[dashboard](https://dashboard.bitmovin.com)).

```bash
bitmovin support tickets list
bitmovin support tickets list --status open,pending --sort createdAt:DESC
bitmovin support tickets list --category encoding --severity high,medium
bitmovin support tickets list --search "encoding fails"
bitmovin support tickets list --limit 50 --offset 50

bitmovin support tickets get <case-id>

bitmovin support tickets create --category encoding \
  --subject "Encoding stuck at 40%" --body "Encoding abc123 does not progress." \
  --encoding-id abc123

bitmovin support tickets comment <case-id> --body "Still reproducible on 8.150.0."
```

**Creating a ticket and commenting are irreversible.** Both commands print the
exact payload **to stderr** — always, including under `--json`, so a scripted run
still records what was filed and against which organization — warn that Bitmovin
support engineers will see it and that it cannot be withdrawn via the API, and then
ask for an explicit confirmation. `--yes` (alias `--confirm`) skips the prompt and
is **required** for non-interactive use — without a TTY, or in `--json` mode, the
commands refuse to send anything instead of silently filing a ticket.

The ticket is filed as **the user behind your credentials**, not as the
organization: the API resolves the requester from the authenticated user and that
person's name and email appear on the ticket. A credential that carries no user
identity (some machine keys) is rejected by the API with `400`.

A long `--body-file` is previewed head-and-tail with its character count rather
than in full, so the warning above stays on screen; the body is capped at 65,536
characters.

| Flag | Applies to | Description |
|------|-----------|-------------|
| `--organization <org-id>` (alias `--tenant-org`) | all | Organization to act on, sent as `X-Tenant-Org-Id`. Defaults to `bitmovin config set organization`; omit both to use the organization of your credentials. For `create`, the body's `organizationId` is set to the same value whenever an organization is resolved — the API rejects a mismatch. An **empty** value (`--organization ""`, e.g. an unset shell variable) is rejected rather than quietly falling back. |
| `--body <text>` / `--body-file <path>` | `create`, `comment` | Ticket / comment text, inline or from a file. |
| `--html` | `comment` | Send the comment as HTML. By default plain text is escaped and its line breaks are preserved. |
| `--yes` / `-y` | `create`, `comment` | Confirm non-interactively. |
| `--limit` / `--offset` | `list` | Page size (1–100, default 25) and offset (default 0). The offset must be `0` or a multiple of `--limit`; other values make the API silently return an earlier page, so the CLI rejects them. |
| `--show-secrets` | `get` | Print attachment download URLs. They are hidden by default — in `--json` output too, where the `url` field carries a placeholder instead — because the URL alone grants access to the file to anyone holding the link. |
| `--status`, `--category`, `--priority`, `--severity` | `list` | Comma-separated filters. Status: `new, open, pending, hold, solved, closed, deleted`. Category: `encoding, player, analytics, other`. Priority: `blocker, high, medium, low`. Severity: `high, medium, low, minor`. |
| `--search <text>` | `list` | Full-text search, max 100 characters, letters/digits/spaces only (the API rejects punctuation). |
| `--sort <expr>` | `list` | `createdAt` or `modifiedAt`, optionally `:ASC` / `:DESC`. |

`create` requires `--category` (`encoding`, `player`, `analytics`, `other`) and a
body. Some fields are category-gated: `--encoding-id` and `--allow-file-access`
require `--category encoding`, while `--license` and `--page-url` require
`--category player` or `--category analytics`. The CLI rejects a mismatch, because
the API does **not** — it accepts the request and silently drops the field, so a
ticket would look filed while the data never arrived. Run
`bitmovin support tickets create --help` for the full field list
(`--platform`, `--sdk-version`, `--os-details`, `--device-details`,
`--request-type`, `--reproducible-reliably`, …).

Some ticket fields the API accepts have no CLI flag: `collaborators`,
`businessImpact`, `streamId`, `analyticsUserSessionUrl`,
`analyticsCollectorVersion`, `playerConfig`, `playerSourceConfig` and
`playerWorkingVersion`. Use the dashboard when a ticket needs those — support
engineers routinely ask for the player config and version.

`comment` posts a **public** reply. It first reads the ticket to obtain its
`modifiedAt` and sends it as the required `updatedStamp`, which is how the API
detects a concurrent update — so you never have to pass a timestamp yourself. The
ticket's newest comment is shown in the confirmation, so you are replying to the
state the stamp was taken from: if support replies while you are deciding, the API
rejects the post rather than accepting a reply written against stale information.

`list` ordering: with no `--sort` and no filter, the API lists tickets awaiting your
reply first, then newest first — and in that mode its total counts only those, so
the CLI reports the range without a total. Pass `--sort createdAt:DESC` (or any
filter) for a strict ordering and an exact total. `--json` emits just the ticket
array; page by requesting successive offsets until a page returns fewer items than
`--limit`.

If a sub-organization is not granted to your credentials, the API answers
`1003 Access denied`; the CLI reports which organization was targeted and points
at `bitmovin account organizations list`.

Attachments (`uploads`) are not supported by the CLI yet — use the dashboard for
those.

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
