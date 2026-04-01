import {Command} from '@oclif/core';

const SKILL = `# Bitmovin CLI

Command-line interface for Bitmovin. Use \`bitmovin\` to manage encodings, player licenses, and analytics.

## Setup

\`\`\`bash
# Set API key (get from https://dashboard.bitmovin.com/account)
bitmovin config set api-key <key>
# Or use env var: BITMOVIN_API_KEY=<key>

# List and select an organization
bitmovin config list organizations
bitmovin config set organization <org-id>
\`\`\`

## Encoding

### Templates (recommended workflow)
\`\`\`bash
bitmovin encoding templates start ./template.yaml --watch  # Start encoding from YAML template
bitmovin encoding templates list                           # List stored templates
bitmovin encoding templates get <id>                       # Get template details
bitmovin encoding templates create ./file.yaml --name "X"  # Store template
bitmovin encoding templates delete <id>
bitmovin encoding templates validate ./template.yaml       # Validate YAML against schema
\`\`\`

### Jobs
\`\`\`bash
bitmovin encoding jobs list [--status RUNNING|FINISHED|ERROR] [--limit 25] [--offset 0]
bitmovin encoding jobs get <id>
bitmovin encoding jobs status <id> [--watch]   # --watch polls with progress bar
bitmovin encoding jobs start <id> [--watch]
bitmovin encoding jobs stop <id>
bitmovin encoding jobs delete <id>
\`\`\`

### Inputs
\`\`\`bash
bitmovin encoding inputs list [--type s3|gcs|http|https|azure]
bitmovin encoding inputs get <id>
bitmovin encoding inputs create s3 --name "X" --bucket <b> --access-key <ak> --secret-key <sk>
bitmovin encoding inputs create gcs --name "X" --bucket <b> --access-key <ak> --secret-key <sk>
bitmovin encoding inputs create https --name "X" --host <host>
bitmovin encoding inputs delete <id>
\`\`\`

### Outputs
\`\`\`bash
bitmovin encoding outputs list [--type s3|gcs|azure]
bitmovin encoding outputs get <id>
bitmovin encoding outputs create s3 --name "X" --bucket <b> --access-key <ak> --secret-key <sk>
bitmovin encoding outputs create gcs --name "X" --bucket <b> --access-key <ak> --secret-key <sk>
bitmovin encoding outputs delete <id>
\`\`\`

### Codecs
\`\`\`bash
bitmovin encoding codecs list [--type video|audio] [--codec h264|h265|av1|aac|opus]
bitmovin encoding codecs get <id>             # auto-detects codec type
bitmovin encoding codecs create h264 --name "X" --bitrate <bps> [--height 1080] [--profile HIGH]
bitmovin encoding codecs create h265 --name "X" --bitrate <bps> [--height 2160]
bitmovin encoding codecs create aac --name "X" --bitrate <bps> [--sample-rate 48000]
bitmovin encoding codecs delete <id>           # auto-detects codec type
\`\`\`

### Manifests
\`\`\`bash
bitmovin encoding manifests list [--type dash|hls|smooth]
bitmovin encoding manifests get <id> --type dash
bitmovin encoding manifests delete <id> --type dash
\`\`\`

### Stats
\`\`\`bash
bitmovin encoding stats                        # Overall statistics
bitmovin encoding stats --from 2024-01-01 --to 2024-03-31  # Date range
\`\`\`

## Player

\`\`\`bash
bitmovin player licenses list
bitmovin player licenses get <id>
bitmovin player licenses create --name "X"
bitmovin player licenses update <id> --name "X"

# Domains accept license ID, license key, or name
bitmovin player domains list <license>
bitmovin player domains add <license> --url https://example.com
bitmovin player domains remove <license> <domain-id>

bitmovin player analytics activate <license-id> --analytics-key <key>
bitmovin player analytics deactivate <license-id>
\`\`\`

## Analytics

\`\`\`bash
bitmovin analytics licenses list
bitmovin analytics licenses get <id>
bitmovin analytics licenses create --name "X" [--timezone Europe/Vienna]
bitmovin analytics licenses update <id> [--name "X"] [--ignore-dnt] [--timezone UTC]

# Domains accept license ID, license key, or name
bitmovin analytics domains list <license>
bitmovin analytics domains add <license> --url https://example.com
bitmovin analytics domains remove <license> <domain-id>
\`\`\`

## Account

\`\`\`bash
bitmovin account info
\`\`\`

## Output Flags

All commands support these flags:

| Flag | Description |
|------|-------------|
| \`--json\` / \`-j\` | Output JSON to stdout |
| \`--fields f1,f2\` | Select JSON fields (implies --json) |
| \`--jq <expr>\` | Filter with jq expression (implies --json) |
| \`--format table\` | Force table output in non-TTY |
| \`--api-key <key>\` | Override API key |
| \`--quiet\` / \`-q\` | Suppress status messages |

## Scripting Examples

\`\`\`bash
# Get all failed encoding IDs
bitmovin encoding jobs list --jq '[.[] | select(.status == "ERROR")] | .[].id'

# Get encoding status as JSON
bitmovin encoding jobs status <id> --json

# List player license keys
bitmovin player licenses list --fields name,licenseKey

# Pipe-friendly: TSV output when not a TTY
bitmovin encoding jobs list | grep FINISHED | awk '{print $1}'
\`\`\`
`;

export default class Skill extends Command {
  static override description = 'Output CLI reference as markdown (for AI assistants)';
  static override hidden = true;

  async run(): Promise<void> {
    process.stdout.write(SKILL);
  }
}
