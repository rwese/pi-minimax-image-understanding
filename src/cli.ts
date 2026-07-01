/**
 * Standalone CLI entry for MiniMax image understanding.
 *
 * The shebang lives in bin/minimax-image-understanding which calls
 * run() with process.argv. This module is pure and unit-testable.
 *
 * Run via `npx @rwese/minimax-image-understanding --prompt <text> <image>`
 * or after global install as `minimax-image-understanding`.
 *
 * Exit codes:
 *   0  success
 *   1  usage / validation error
 *   2  configuration error (missing env var)
 *   3  API / network error
 */

import { parseArgs } from 'node:util';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

import { ConfigError, getConfig } from './config.js';
import { loadImageAsBase64 } from './image.js';
import { VlmError, callVlm } from './vlm.js';

export const EXIT_OK = 0;
export const EXIT_USAGE = 1;
export const EXIT_CONFIG = 2;
export const EXIT_API = 3;

/**
 * Minimal writable surface used by run(). Anything implementing
 * `write(chunk)` is accepted — this keeps tests free of the full
 * NodeJS.WriteStream interface and keeps the dependency graph small.
 */
export interface WritableLike {
	write(chunk: string | Uint8Array): boolean | void;
}

const HELP = `minimax-image-understanding — analyze images via MiniMax VLM

Usage:
  minimax-image-understanding --prompt <text> <image> [options]

Arguments:
  <image>                      Path to the image file (png/jpg/jpeg/webp/gif)

Options:
  --prompt <text>              Question or instruction about the image (required)
  --json                       Emit \\{ "content": "..." \\} instead of raw text
  -o, --output <file>          Write response to <file> instead of stdout
  --quiet                      Suppress progress messages on stderr
  -h, --help                   Show this help and exit
  -v, --version                Print version and exit

Environment:
  MINIMAX_API_KEY              Required. MiniMax API key.
  MINIMAX_API_HOST             Optional. Defaults to https://api.minimax.io

Examples:
  MINIMAX_API_KEY=... npx @rwese/minimax-image-understanding \\
      --prompt "Describe this image" ./screenshot.png

  MINIMAX_API_KEY=... npx @rwese/minimax-image-understanding \\
      --prompt "Extract all text" --json screenshot.png | jq -r .content
`;

export interface ParsedArgs {
	prompt?: string;
	json: boolean;
	quiet: boolean;
	output?: string;
	help: boolean;
	version: boolean;
	positional: string[];
}

export function parseCliArgs(argv: readonly string[]): ParsedArgs {
	const { values, positionals } = parseArgs({
		args: argv,
		allowPositionals: true,
		options: {
			prompt: { type: 'string' },
			json: { type: 'boolean', default: false },
			output: { type: 'string', short: 'o' },
			quiet: { type: 'boolean', default: false },
			help: { type: 'boolean', short: 'h', default: false },
			version: { type: 'boolean', short: 'v', default: false },
		},
		strict: true,
	});

	return {
		prompt: values.prompt,
		json: values.json,
		quiet: values.quiet,
		output: values.output,
		help: values.help,
		version: values.version,
		positional: positionals,
	};
}

export class UsageError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'UsageError';
	}
}

export function validateArgs(args: ParsedArgs): { prompt: string; image: string; output?: string } {
	if (!args.prompt || args.prompt.trim() === '') {
		throw new UsageError('--prompt is required and must be non-empty');
	}
	const [first, ...rest] = args.positional;
	if (first === undefined) {
		throw new UsageError('image path is required (positional argument)');
	}
	if (rest.length > 0) {
		throw new UsageError(`unexpected extra positional arguments: ${rest.join(' ')}`);
	}
	const image = resolve(first);
	return {
		prompt: args.prompt,
		image,
		...(args.output !== undefined ? { output: args.output } : {}),
	};
}

function log(stderr: WritableLike, quiet: boolean, msg: string): void {
	if (!quiet) {
		stderr.write(`${msg}\n`);
	}
}

export async function run(
	argv: readonly string[],
	ctx: { stdout: WritableLike; stderr: WritableLike; version: string },
): Promise<number> {
	let parsed: ParsedArgs;
	try {
		parsed = parseCliArgs(argv);
	} catch (err) {
		ctx.stderr.write(`${(err as Error).message}\n\n${HELP}`);
		return EXIT_USAGE;
	}

	if (parsed.help) {
		ctx.stdout.write(HELP);
		return EXIT_OK;
	}

	if (parsed.version) {
		ctx.stdout.write(`${ctx.version}\n`);
		return EXIT_OK;
	}

	let validated: { prompt: string; image: string; output?: string };
	try {
		validated = validateArgs(parsed);
	} catch (err) {
		if (err instanceof UsageError) {
			ctx.stderr.write(`${err.message}\n\n${HELP}`);
			return EXIT_USAGE;
		}
		throw err;
	}

	log(ctx.stderr, parsed.quiet, `→ loading ${validated.image}`);
	let imageUrl: string;
	try {
		imageUrl = await loadImageAsBase64(validated.image);
	} catch (err) {
		ctx.stderr.write(`failed to read image: ${(err as Error).message}\n`);
		return EXIT_USAGE;
	}

	let config;
	try {
		config = getConfig();
	} catch (err) {
		if (err instanceof ConfigError) {
			ctx.stderr.write(`${err.message}\n`);
			return EXIT_CONFIG;
		}
		throw err;
	}

	log(ctx.stderr, parsed.quiet, '→ calling MiniMax VLM');
	let result;
	try {
		result = await callVlm(config, validated.prompt, imageUrl);
	} catch (err) {
		if (err instanceof VlmError) {
			ctx.stderr.write(`API error: ${err.message}\n`);
			return EXIT_API;
		}
		ctx.stderr.write(`network error: ${(err as Error).message}\n`);
		return EXIT_API;
	}

	const body = parsed.json
		? `${JSON.stringify({ content: result.content }, null, 2)}\n`
		: `${result.content}\n`;
	if (validated.output !== undefined) {
		await writeFile(validated.output, body, 'utf8');
		log(ctx.stderr, parsed.quiet, `→ wrote ${validated.output}`);
	} else {
		ctx.stdout.write(body);
	}
	return EXIT_OK;
}
