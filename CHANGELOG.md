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
  and execution (37 tests, vitest, including a jiti-loader integration
  test that confirms the pi extension registers through the loader pi
  actually uses).
- `vitest.config.ts` to wire up the new `tests/` directory.
- MIT `LICENSE` file (was referenced in `package.json#files` but
  missing).
- README **Quickstart** section at the top, leading with the pi
  extension (the primary packaging form), with the CLI as a
  one-off-via-`npx` alternative. The minimum path to "it works" is now
  reachable without scrolling past installation trivia.
- README **Configuration** table for env vars (`MINIMAX_API_KEY`,
  `MINIMAX_API_HOST`) and a JPG/JPEG clarification in the supported
  formats list.

### Changed

- `extensions/index.ts` refactored to import from `src/config`,
  `src/image`, and `src/vlm` instead of inlining the API call.
- `package.json` adds `bin`, a `tsx` runtime `dependencies` entry, and an
  exact-pinned set of dev dependencies; the `files` allow-list now includes
  `bin/` and `src/`.
- ESLint config now lints `src/` and `tests/` in addition to
  `extensions/`.
- README reorganized: Quickstart → Installation → Configuration →
  Usage (extension + CLI) → Features → Development. The `Configuration`
  section now leads with an env-var table; the `Usage as a pi extension`
  section clarifies that pi calls the tool automatically rather than
  the user invoking it.
- README `pi install` command corrected to `git:github.com/...` (the
  bare `github.com/...` form is mis-parsed by pi as a local path and
  fails — caught in review).

## [1.0.0] - 2026-04-24

### Added

- Initial release: pi extension registering the `image_understanding`
  tool, with custom TUI rendering of the query in the result header.