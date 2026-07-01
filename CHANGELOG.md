# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Standalone `npx`-runnable CLI command `minimax-image-understanding`
  registered via the package's `bin` field.
- `--prompt`, `--json`, `-o`/`--output`, `--quiet`, `-h`/`--help`, and
  `-v`/`--version` flags.
- Exit codes: `0` success, `1` usage, `2` config, `3` API.
- Shared core modules in `src/` (`config`, `image`, `vlm`, `cli`) so
  the pi extension and the CLI consume the same code path.
- Tests for config, image loading, VLM client, and CLI argument parsing
  and execution (36 tests, vitest).
- `vitest.config.ts` to wire up the new `tests/` directory.

### Changed

- `extensions/index.ts` refactored to import from `src/config`,
  `src/image`, and `src/vlm` instead of inlining the API call.
- `package.json` adds `bin`, a `tsx` runtime `dependencies` entry, and an
  exact-pinned set of dev dependencies; the `files` allow-list now includes
  `bin/` and `src/`.
- ESLint config now lints `src/` and `tests/` in addition to
  `extensions/`.

## [1.0.0] - 2026-04-24

### Added

- Initial release: pi extension registering the `image_understanding`
  tool, with custom TUI rendering of the query in the result header.