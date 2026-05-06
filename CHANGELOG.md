# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Added `bitmovin encoding jobs live <id>` to show live encoding connection details, with JSON output support. Surfaces every assigned stream key (including the per-static-ingest-point keys used by redundant RTMP) and the SRT mode/host/port/path for SRT inputs.

  JSON shape note for anyone tracking the unreleased branch: the `--json` output now reports `streamKeys: [{value, ingestPointId, status}]` instead of the singular `streamKey` field that earlier iterations exposed. A `streamKey` alias is still emitted (equal to `streamKeys[0]?.value`) for one-off scripts; redundant RTMP setups should read `streamKeys[]` to get every per-ingest-point key.
- CI workflow that builds standalone tarballs (macOS, Linux, Windows) plus macOS `.pkg` (signed with Developer ID Installer) and Windows `.exe` installers via `oclif pack` and uploads them as workflow artifacts for internal testing. macOS `.pkg` signature is verified via `pkgutil --check-signature` in CI. npm publishing and macOS notarization will follow in subsequent changes.
- Tag-pushed `v*` runs now also create a draft GitHub Release with the tarballs, `.exe`, and signed `.pkg` files attached as individual downloadable assets. Drafts are invisible to non-maintainers; "Publish release" in the Releases UI flips visibility once contents are reviewed.

### Changed

- **BREAKING:** `bitmovin account info --json` now masks API key values and other secrets by default. Consumers that need plaintext secrets must opt in with `--show-secrets`.
- **BREAKING:** `bitmovin config show --json` now returns `null` for unset values and includes a new `apiKeySource` field. Consumers parsing the previous JSON shape may need to update their tooling.

### Fixed

- `bitmovin config show` now reports the effective API key source while keeping values masked consistently.

### Fixed

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
