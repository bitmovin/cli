# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- **BREAKING:** `bitmovin account info --json` now masks API key values and other secrets by default. Consumers that need plaintext secrets must opt in with `--show-secrets`.
- **BREAKING:** `bitmovin config show --json` now returns `null` for unset values and includes a new `apiKeySource` field. Consumers parsing the previous JSON shape may need to update their tooling.

### Fixed
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
