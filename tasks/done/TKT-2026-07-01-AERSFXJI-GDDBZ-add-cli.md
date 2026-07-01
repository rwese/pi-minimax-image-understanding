---
id: TKT-2026-07-01-AERSFXJI-GDDBZ
title: Add CLI for npx standalone use
status: done
created: 2026-07-01
---

# Add CLI for npx standalone use

## Goal

Ship the MiniMax image-understanding capability as an `npx`-runnable CLI
in addition to the existing pi extension. The pi-extension registration
and tool TUI must remain functional.

## Result

Implemented and verified on branch `feat/cli`.

### What landed

- `bin/minimax-image-understanding` (executable, shebang
  `#!/usr/bin/env -S npx -y tsx`) — registered via the package's `bin`
  field. Pure JS bootstrap, delegates to `src/cli.ts`.
- `src/cli.ts` — `parseCliArgs` (uses `node:util.parseArgs`, no extra
  dep), `validateArgs`, `run()`. Flags: `--prompt` (required), `--json`,
  `-o`/`--output`, `--quiet`, `-h`/`--help`, `-v`/`--version`. Exit
  codes: `0` ok, `1` usage, `2` config, `3` api/network.
- `src/config.ts`, `src/image.ts`, `src/vlm.ts` — pure, no pi imports,
  unit-testable. `getConfig` throws `ConfigError`; `callVlm` throws
  `VlmError`; both are caught and translated to clean stderr messages
  in the CLI and the extension.
- `extensions/index.ts` — refactored to import from `src/`. Tool
  contract (name, parameters, renderers) byte-for-byte unchanged.
- `tests/` — 37 vitest tests across `config`, `image`, `vlm`, `cli`
  (20 tests covering every `run()` path), and a new
  `extension-loader` integration test that loads
  `extensions/index.ts` through the same `@mariozechner/jiti` loader
  pi uses, asserting the `image_understanding` tool registers.
- `vitest.config.ts` — wires the new `tests/` directory.
- `eslint.config.mjs` — extends to `src/` and `tests/`; globals for
  `RequestInit`/`AbortController`; loosens `require-await` and
  `no-explicit-any` for test files.
- `package.json` — adds `bin`, `dependencies.tsx@4.21.0` (runtime),
  exact-pinned devDeps, includes `bin/` and `src/` in `files`.
- `LICENSE` (MIT) added (was referenced in `files` but missing — caught
  by reviewer).
- `README.md` — CLI usage section with flag table, examples, exit
  codes, platform notes (Windows). CHANGELOG entry under `[Unreleased]`.

### Quality gates

`npm run validate` (typecheck + lint + 37 tests) passes.

### Smoke tests performed

- `./bin/minimax-image-understanding --help` → exit 0, prints usage to
  stdout.
- `./bin/minimax-image-understanding --version` → exit 0, prints
  `1.0.0\n`.
- `./bin/minimax-image-understanding` (no args) → exit 1, stderr
  `--prompt is required and must be non-empty` + HELP.
- `./bin/minimax-image-understanding --prompt "x"` → exit 1, stderr
  `image path is required (positional argument)`.
- `./bin/minimax-image-understanding --prompt "x" /no/such.png` →
  exit 1, stderr `failed to read image: ENOENT: …`.
- (No live API call: `MINIMAX_API_KEY` not set in the review env.)
- `npm pack` round-trip: tarball contains `bin/minimax-image-understanding`
  (mode preserved), `extensions/index.ts`, `LICENSE`, `README.md`,
  `package.json`, and `src/{cli,config,image,vlm}.ts`.

### Reviewer

`reviewer` subagent ran a full diff review on commit-prep state.
Verdict was `PARTIAL` with one Critical (`LICENSE` missing) and three
Warnings (`tsx` duplicated across dep/devDep, jiti loader
un-exercised, `--quiet` cannot suppress tsx's `DEP0205` warning). All
addressed before commit:

- Added `LICENSE` (MIT, 2026, rwese).
- Removed `tsx` from `devDependencies` (still in `dependencies` as a
  runtime dep).
- Added a README footnote acknowledging the `DEP0205` warning is from
  the tsx loader, not the CLI.
- Added `tests/extension-loader.test.ts` that loads the extension
  through `@mariozechner/jiti` and asserts the tool registers.

### Follow-ups (not done, not blocking)

- Live end-to-end test with a real `MINIMAX_API_KEY`.
- `tsx` upgrade once it switches off `module.register()`.
- Windows `.cmd` shim.
- Interactive / stdin prompt modes.