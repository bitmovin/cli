# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `bitmovin account organizations list` shows every visible organization with its `type` (`ROOT_ORGANIZATION` / `SUB_ORGANIZATION`), `parentId`, and whether it is the active one, ordering sub-organizations directly under their parent. `--type root|sub` and `--parent <org-id>` narrow the listing.
- `bitmovin support tickets list | get | create | comment` for Bitmovin support tickets. `--organization <org-id>` (alias `--tenant-org`) scopes any of them to a sub-organization via `X-Tenant-Org-Id`, and `create` always sends a body `organizationId` matching that header because the API rejects a mismatch.
  - `create` and `comment` are irreversible: both print the exact payload to stderr — always, including under `--json`, so a scripted run still records what was filed and against which organization — state that Bitmovin support engineers will see it and that it cannot be withdrawn via the API, and require an explicit confirmation. `--yes` / `--confirm` skips the prompt and is required for non-interactive use — without a TTY (or in `--json` mode) the commands refuse to send instead of silently filing a ticket.
  - `comment` reads the ticket's `modifiedAt` and sends it as the API-required `updatedStamp` collision stamp, so callers never see the misleading `1004 … Check your JSON syntax` error that a missing stamp produces. The ticket's newest comment is shown in the confirmation, so the stamp corresponds to the state the user actually saw.
  - `list` rejects an `--offset` that is not `0` or a multiple of `--limit` (the API silently serves an earlier page otherwise), plus invalid `--search` text, filter values, and `--sort` expressions, before making a request. Filter spacing is normalized, since the API splits on `,` without trimming.
  - `get` hides attachment download URLs unless `--show-secrets` is passed: the URL alone grants access to the file to anyone holding the link. Ticket subjects and comment bodies are stripped of control characters before printing, so customer-supplied text cannot rewrite the rendered conversation or forge the `(Bitmovin)` agent attribution.
  - An empty `--organization ""` is rejected rather than silently falling back, which would otherwise widen a write from the intended sub-organization to the credential's own organization.
  - `--allow-file-access` requires `--category encoding`, and `--body-file` is capped at 65,536 characters with a head-and-tail preview. The API accepts a mismatched category and silently drops the field, so the check has to be local.

### Changed

- `bitmovin config list organizations` now derives sub-organizations from the `parentId` of the flat organization listing instead of calling the per-organization `sub-organizations` endpoint, which reports `1001 An organization with the given id does not exist` for organization ids that the listing returns. The JSON keys are unchanged, but rows are now deduplicated and ordered parent-first, so sub-organizations render under their parent instead of flat at top level.
- Organizations are paged through in full. The generated SDK's `organizations.list()` accepts no query parameters and so returned only the API's default first page — on a larger account, sub-organizations whose parent sat on a later page were rendered as roots, and `--parent` reported a visible organization as invisible. A short page while the API reports more now fails loudly rather than returning a truncated list.
- The `403 Access denied` hint now names the organization the failed request was actually scoped to (including one passed via `--organization`) and points at `bitmovin account organizations list`.

## [0.4.0] - 2026-05-26

### Added

- `bitmovin login` and `bitmovin logout` for browser-based OAuth (PKCE). The CLI stores the resulting session in `~/.config/bitmovin/config.json` (mode `0600`), uses `Authorization: Bearer …` when calling the Bitmovin API, and refreshes access tokens silently. Credential resolution priority is now `--api-key` flag > `BITMOVIN_API_KEY` env > stored OAuth session > `api-key` in config. `--print-url` skips opening a browser for headless / SSH use. Endpoints, client ID, scope, and the loopback port are env-overridable (`BITMOVIN_OAUTH_*`).
- `bitmovin config show` now reports the OAuth user, expiry, and whether a refresh token is present (text + `--json`).
- `bitmovin skills list / find / add / remove` for installing Bitmovin AI assistant skills from the [`bitmovin/skills`](https://github.com/bitmovin/skills) archive. Skill management delegates to the `npx skills` installer and supports the `pi`, `claude-code`, `codex`, and `gemini-cli` agents via `--agent`.

## [0.3.0] - 2026-05-07

### Added

- Added `bitmovin encoding jobs live <id>` to show live encoding connection details, with JSON output support. Surfaces every assigned stream key (including the per-static-ingest-point keys used by redundant RTMP) and the SRT mode/host/port/path for SRT inputs.

  JSON shape note for anyone tracking the unreleased branch: the `--json` output now reports `streamKeys: [{value, ingestPointId, status}]` instead of the singular `streamKey` field that earlier iterations exposed. A `streamKey` alias is still emitted (equal to `streamKeys[0]?.value`) for one-off scripts; redundant RTMP setups should read `streamKeys[]` to get every per-ingest-point key.
- CI workflow that builds standalone tarballs (macOS, Linux, Windows) plus macOS `.pkg` (signed with Developer ID Installer) and Windows `.exe` installers via `oclif pack` and uploads them as workflow artifacts for internal testing. macOS `.pkg` signature is verified via `pkgutil --check-signature` in CI. npm publishing and macOS notarization will follow in subsequent changes.
- Tag-pushed `v*` runs now also create a draft GitHub Release with the tarballs, `.exe`, and signed `.pkg` files attached as individual downloadable assets, plus a `SHA256SUMS` file so users can verify downloads. Release creation is gated on a `ci-passed` job that asserts `ci.yml` (lint, build, tests) succeeded on the tagged commit. Drafts are invisible to non-maintainers; "Publish release" in the Releases UI flips visibility once contents are reviewed.

### Changed

- **BREAKING:** `bitmovin account info --json` now masks API key values and other secrets by default. Consumers that need plaintext secrets must opt in with `--show-secrets`.
- **BREAKING:** `bitmovin config show --json` now returns `null` for unset values and includes a new `apiKeySource` field. Consumers parsing the previous JSON shape may need to update their tooling.

### Fixed

- `bitmovin config show` now reports the effective API key source while keeping values masked consistently.
- Fixed encoding template validation for the upstream JSON Schema 2020-12 schema and OpenAPI `double` formats.

## [0.2.0] - 2026-04-15

### Added

- CI, ESLint, type safety checks, and expanded test coverage.

### Changed

- Bumped the minimum supported Node.js version to 20.

### Fixed

- Attached the original cause when re-throwing `jq` errors.

## [0.1.0] - 2026-04-01

### Added

- Initial Bitmovin CLI release.
- Tests, GitHub-style output, and friendly API error handling.
- Internal beta install instructions.
- `bitmovin skill` command for AI assistant context.
- Shell autocomplete support for zsh, bash, and PowerShell.
- `prepare` script so installing from GitHub triggers a build.

### Changed

- Improved consistency based on code review feedback.

### Fixed

- Bug fixes from initial code review.
- Reverted committing `dist/` for global npm installs from GitHub.
