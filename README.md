# @rwese/minimax-image-understanding

MiniMax image understanding — ships as both a [pi coding agent](https://github.com/mariozechner/pi-coding-agent) extension
and a standalone CLI for `npx`.

## Installation

### As a pi extension

```bash
pi install github.com/rwese/pi-minimax-image-understanding
```

### As a standalone CLI

```bash
# one-off, no install required
npx @rwese/minimax-image-understanding --prompt "Describe this image" ./screenshot.png

# or install globally
npm install -g @rwese/minimax-image-understanding
minimax-image-understanding --prompt "Describe this image" ./screenshot.png
```

> The CLI runs TypeScript source via `tsx` at runtime — there is no build step
> in the published package. On first invocation, `npx` will fetch `tsx` (~1 MB,
> cached afterwards). Until tsx migrates off `module.register()` (it currently
> emits a `DEP0205` deprecation warning on Node 22+), `--quiet` cannot suppress
> the warning because it is printed by the loader, not by the CLI.

## Configuration

Set your MiniMax API key in the environment. Both the extension and the CLI
read the same variables:

```bash
export MINIMAX_API_KEY="your-api-key"
export MINIMAX_API_HOST="https://api.minimax.io"  # optional, defaults to api.minimax.io
```

## Usage as a pi extension

The extension registers an `image_understanding` tool for analyzing images
using vision-language models.

Example prompts:

- "Describe this image"
- "Read the text from this screenshot"
- "What does this chart show?"
- "Analyze the diagram"

## Usage as a CLI

```
minimax-image-understanding --prompt <text> <image> [options]
```

| Option                  | Description                                                         |
| ----------------------- | ------------------------------------------------------------------- |
| `--prompt <text>`       | Required. Question or instruction about the image.                  |
| `<image>`               | Required positional. Path to the image file.                        |
| `--json`                | Emit `{ "content": "..." }` instead of raw text.                    |
| `-o`, `--output <file>` | Write response to `<file>` instead of stdout.                       |
| `--quiet`               | Suppress progress messages on stderr.                              |
| `-h`, `--help`          | Show help and exit.                                                 |
| `-v`, `--version`       | Print version and exit.                                             |

### Examples

```bash
# Basic description
MINIMAX_API_KEY=... npx @rwese/minimax-image-understanding \
    --prompt "Describe this image" ./photo.png

# Pipe JSON to jq
MINIMAX_API_KEY=... npx @rwese/minimax-image-understanding \
    --prompt "Extract all text" --json screenshot.png | jq -r .content

# Save to a file (clean stdout)
MINIMAX_API_KEY=... npx @rwese/minimax-image-understanding \
    --prompt "OCR this" --quiet -o extracted.txt ./scan.jpg
```

### Exit codes

| Code | Meaning                                  |
| ---- | ---------------------------------------- |
| `0`  | Success.                                 |
| `1`  | Usage / validation error.                |
| `2`  | Configuration error (missing API key).   |
| `3`  | API or network error.                    |

### Supported image formats

PNG, JPEG, WebP, GIF. Anything else falls back to `image/jpeg`.

### Platform notes

The bin script uses a Unix shebang (`#!/usr/bin/env -S npx -y tsx`). On
Windows, invoke through `npx` directly:

```cmd
npx -y @rwese/minimax-image-understanding --prompt "describe" image.png
```

## Features

- Vision-language model via MiniMax API
- Supports local file paths
- Image format support: PNG, JPEG, WebP, GIF
- Describe screenshots, diagrams, charts, documents
- Extract text from images (OCR-style)
- Custom TUI rendering showing the query in the result header (pi extension)

## Development

```bash
npm install
npm run validate   # typecheck + lint + tests
```

The CLI's entry point is `bin/minimax-image-understanding`. Core logic
(`config`, `image`, `vlm`) lives in `src/` and is shared between the
extension and the CLI.