# @wese/pi-minimax-image-understanding

MiniMax Image Understanding extension for pi coding agent.

## Installation

```bash
pi install git:github.com/rwese/pi-minimax-image-understanding
```

## Configuration

Set your MiniMax API key:

```bash
export MINIMAX_API_KEY="your-api-key"
export MINIMAX_API_HOST="https://api.minimax.io"  # optional, defaults to api.minimax.io
```

## Usage

The extension registers an `image_understanding` tool for analyzing images using vision-language models.

Example prompts:
- "Describe this image"
- "Read the text from this screenshot"
- "What does this chart show?"
- "Analyze the diagram"

## Features

- Vision-language model via MiniMax API
- Supports local file paths
- Image format support: PNG, JPEG, WebP, GIF
- Describe screenshots, diagrams, charts, documents
- Extract text from images (OCR-style)
