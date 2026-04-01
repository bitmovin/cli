# Bitmovin CLI

The official command-line interface for [Bitmovin](https://bitmovin.com). Manage encodings, player licenses, analytics, and more — from your terminal.

## Install

```bash
npm install -g @bitmovin/cli
```

Requires Node.js 18+.

## Quick Start

```bash
# 1. Get your API key from https://dashboard.bitmovin.com/account
bitmovin config set api-key YOUR_API_KEY

# 2. Select an organization (optional)
bitmovin config list organizations
bitmovin config set organization ORG_ID

# 3. Start encoding
bitmovin encoding template start ./my-encoding.yaml --watch
```

## Commands

### Config

```bash
bitmovin config set api-key <key>              # Set API key
bitmovin config set organization <id>          # Set active organization
bitmovin config set default-region <region>    # Set default cloud region
bitmovin config show                           # Show current config
bitmovin config list organizations             # List available organizations
```

### Encoding — Templates

The recommended way to encode. Define your entire workflow in a single [YAML template](https://developer.bitmovin.com/encoding/docs/encoding-templates).

```bash
bitmovin encoding template start ./template.yaml --watch   # Start from file
bitmovin encoding template start --id <id> --watch         # Start stored template
bitmovin encoding template create ./template.yaml --name "Standard VOD"
bitmovin encoding template list
bitmovin encoding template get <id>
bitmovin encoding template delete <id>
bitmovin encoding template validate ./template.yaml        # Validate against schema
```

### Encoding — Jobs

```bash
bitmovin encoding job list [--status running|finished|error]
bitmovin encoding job get <id>
bitmovin encoding job status <id> [--watch]    # Live progress bar with --watch
bitmovin encoding job start <id> [--watch]
bitmovin encoding job stop <id>
bitmovin encoding job delete <id>
```

### Encoding — Inputs & Outputs

```bash
bitmovin encoding input list [--type s3|gcs|http|https|azure]
bitmovin encoding input get <id>
bitmovin encoding input create s3 --name "Prod" --bucket my-bucket --access-key AK --secret-key SK
bitmovin encoding input create gcs --name "Staging" --bucket my-bucket --access-key AK --secret-key SK
bitmovin encoding input create https --name "CDN" --host storage.example.com
bitmovin encoding input delete <id>

bitmovin encoding output list [--type s3|gcs|azure]
bitmovin encoding output get <id>
bitmovin encoding output create s3 --name "CDN Out" --bucket my-bucket --access-key AK --secret-key SK
bitmovin encoding output create gcs --name "GCS Out" --bucket my-bucket --access-key AK --secret-key SK
bitmovin encoding output delete <id>
```

### Encoding — Codec Configs

```bash
bitmovin encoding codec list [--type video|audio] [--codec h264|h265|av1|aac|opus]
bitmovin encoding codec get <id> --codec h264
bitmovin encoding codec create h264 --name "1080p" --bitrate 4800000 --height 1080 --profile HIGH
bitmovin encoding codec create h265 --name "4K HEVC" --bitrate 8000000 --height 2160
bitmovin encoding codec create aac --name "Stereo 128k" --bitrate 128000
bitmovin encoding codec delete <id> --codec h264
```

### Encoding — Manifests & Stats

```bash
bitmovin encoding manifest list [--type dash|hls|smooth]
bitmovin encoding manifest get <id> --type dash
bitmovin encoding manifest delete <id> --type dash

bitmovin encoding stats [--from 2024-01-01] [--to 2024-03-31]
```

### Player

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

### Analytics

```bash
bitmovin analytics licenses list
bitmovin analytics licenses get <id>
bitmovin analytics licenses create --name "Prod Analytics" [--timezone Europe/Vienna]
bitmovin analytics licenses update <id> --name "New Name" [--ignore-dnt] [--timezone UTC]

bitmovin analytics domains list <license-id-or-key-or-name>
bitmovin analytics domains add <license-id-or-key-or-name> --url https://example.com
bitmovin analytics domains remove <license-id-or-key-or-name> <domain-id>
```

### Account

```bash
bitmovin account info
```

## Output Formats

By default, the CLI outputs human-readable tables when used interactively. For scripting and automation, use `--json` and `--jq`:

```bash
# JSON output
bitmovin encoding job list --json

# Filter with jq
bitmovin encoding job list --json --jq '.[].id'
bitmovin player licenses list --jq '[.[] | {name, licenseKey}]'

# Pipe-friendly: colors and spinners are automatically disabled when stdout is not a TTY
bitmovin encoding job list | head -5
```

**Design principles** (inspired by [gh](https://github.com/cli/cli)):
- `--json` outputs structured JSON to stdout
- `--jq` filters JSON with [jq](https://jqlang.github.io/jq/) expressions (implies `--json`)
- Status messages always go to stderr, data to stdout
- Colors and spinners are disabled when piped

## Global Flags

| Flag | Description |
|------|-------------|
| `--json` / `-j` | Output JSON to stdout |
| `--jq <expr>` | Filter JSON with a jq expression |
| `--api-key <key>` | Override the configured API key |
| `--quiet` / `-q` | Suppress non-essential output |

## Configuration

Config is stored in `~/.config/bitmovin/config.json`.

| Key | Description |
|-----|-------------|
| `api-key` | Your Bitmovin API key ([get one here](https://dashboard.bitmovin.com/account)) |
| `organization` | Active tenant organization ID |
| `default-region` | Default cloud region for encodings |

## License

MIT
