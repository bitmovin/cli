# Bitmovin CLI (Public Beta)

The official command-line interface for [Bitmovin](https://bitmovin.com). Manage encodings, player licenses, analytics, and more — from your terminal.

> **Public Beta** — This CLI is under active development. Commands and flags may change. Feedback and contributions are welcome!

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
bitmovin encoding templates start ./my-encoding.yaml --watch
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
bitmovin encoding templates start ./template.yaml --watch   # Start from file
bitmovin encoding templates start --id <id> --watch         # Start stored template
bitmovin encoding templates create ./template.yaml --name "Standard VOD"
bitmovin encoding templates list
bitmovin encoding templates get <id>
bitmovin encoding templates delete <id>
bitmovin encoding templates validate ./template.yaml        # Validate against schema
```

### Encoding — Jobs

```bash
bitmovin encoding jobs list [--status running|finished|error]
bitmovin encoding jobs get <id>
bitmovin encoding jobs status <id> [--watch]    # Live progress bar with --watch
bitmovin encoding jobs start <id> [--watch]
bitmovin encoding jobs stop <id>
bitmovin encoding jobs delete <id>
```

### Encoding — Inputs & Outputs

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

### Encoding — Codec Configs

```bash
bitmovin encoding codecs list [--type video|audio] [--codec h264|h265|av1|aac|opus]
bitmovin encoding codecs get <id>              # auto-detects codec type
bitmovin encoding codecs create h264 --name "1080p" --bitrate 4800000 --height 1080 --profile HIGH
bitmovin encoding codecs create h265 --name "4K HEVC" --bitrate 8000000 --height 2160
bitmovin encoding codecs create aac --name "Stereo 128k" --bitrate 128000
bitmovin encoding codecs delete <id>            # auto-detects codec type
```

### Encoding — Manifests & Stats

```bash
bitmovin encoding manifests list [--type dash|hls|smooth]
bitmovin encoding manifests get <id> --type dash
bitmovin encoding manifests delete <id> --type dash

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

## Global Flags

| Flag | Description |
|------|-------------|
| `--json` / `-j` | Output JSON to stdout |
| `--jq <expr>` | Filter JSON with a jq expression |
| `--api-key <key>` | Override the configured API key |
| `--quiet` / `-q` | Suppress non-essential output |

## Configuration

Config is stored in `~/.config/bitmovin/config.json`. You can also set the API key via the `BITMOVIN_API_KEY` environment variable.

**Priority:** `--api-key` flag > `BITMOVIN_API_KEY` env var > config file.

| Key | Description |
|-----|-------------|
| `api-key` | Your Bitmovin API key ([get one here](https://dashboard.bitmovin.com/account)) |
| `organization` | Active tenant organization ID |
| `default-region` | Default cloud region for encodings |

## License

MIT
