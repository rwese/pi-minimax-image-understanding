---
id: TKT-2026-07-01-AERSFXJI-GDDBZ
title: Add Quickstart to README and update docs
status: done
created: 2026-07-01
parent: TKT-2026-07-01-AERSFXJI-GDDBZ
---

# Add Quickstart to README and update docs

## Goal

Make the minimum working command reachable from the top of README
without scrolling past installation trivia, and bring the rest of
the docs into a consistent flow.

## Result

Landed on `main` via PR #2 (merge commit `7d2e819`).

### What landed

- `README.md`: new top-of-file **Quickstart** section leading with the
  pi extension (this is a pi-package; peer deps pin
  `@mariozechner/pi-coding-agent`), with the `npx` CLI as the
  alternative. Three lines per mode.
- `README.md`: full reorganization.
  `Quickstart → Installation → Configuration → Usage → Features →
  Development`.
- `README.md`: **Configuration** is now a `Variable | Required |
  Default` table covering `MINIMAX_API_KEY` and `MINIMAX_API_HOST`,
  with no inline `export` re-statement.
- `README.md`: supported image formats spelled out as `PNG, JPG/JPEG,
  WebP, GIF` to match `--help`.
- `CHANGELOG.md`: `[Unreleased] / Added` and `/Changed` entries
  updated.

### Reviewer

Two review rounds. First round returned **PARTIAL** with one Critical:
the Quickstart's `pi install github.com/rwese/...` (bare form) is
mis-parsed by pi `parseGitUrl`, which re-classifies it as a local
path and fails with `Path does not exist`. Fixed to
`git:github.com/rwese/...` in both Quickstart and Installation.
Second round **PASS** with no Critical or Warning.

### Verification

- `npm run validate` (typecheck + lint + 37 tests) green on the
  amended tree.
- `grep "pi install" README.md` shows both occurrences use
  `git:github.com/...`.
- Post-merge checklist: working tree clean, feature-branch commits
  landed, main tip is `7d2e819`, tests pass on `main`, agent back on
  `main`.