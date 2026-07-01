import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Writable } from 'node:stream';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
	EXIT_API,
	EXIT_CONFIG,
	EXIT_OK,
	EXIT_USAGE,
	parseCliArgs,
	run,
	validateArgs,
} from '../src/cli.js';

class MemoryStream extends Writable {
	chunks: string[] = [];
	override _write(chunk: Buffer | string, _enc: string, cb: () => void): void {
		this.chunks.push(typeof chunk === 'string' ? chunk : chunk.toString('utf8'));
		cb();
	}
	get text(): string {
		return this.chunks.join('');
	}
	reset(): void {
		this.chunks = [];
	}
}

describe('parseCliArgs', () => {
	it('extracts --prompt, image positional, and flags', () => {
		const out = parseCliArgs(['--prompt', 'describe', './img.png', '--json', '--quiet']);
		expect(out.prompt).toBe('describe');
		expect(out.positional).toEqual(['./img.png']);
		expect(out.json).toBe(true);
		expect(out.quiet).toBe(true);
	});

	it('accepts -o short form', () => {
		const out = parseCliArgs(['-o', 'out.txt', '--prompt', 'p', 'img.png']);
		expect(out.output).toBe('out.txt');
	});

	it('returns defaults when nothing is passed', () => {
		const out = parseCliArgs([]);
		expect(out.prompt).toBeUndefined();
		expect(out.json).toBe(false);
		expect(out.quiet).toBe(false);
		expect(out.help).toBe(false);
		expect(out.version).toBe(false);
		expect(out.positional).toEqual([]);
	});

	it('rejects unknown flags', () => {
		expect(() => parseCliArgs(['--nope'])).toThrow();
	});
});

describe('validateArgs', () => {
	it('returns prompt, image, output when valid', () => {
		const out = validateArgs({
			prompt: 'describe',
			json: false,
			quiet: false,
			help: false,
			version: false,
			positional: ['img.png'],
		});
		expect(out.prompt).toBe('describe');
		expect(out.image.endsWith('img.png')).toBe(true);
		expect(out.output).toBeUndefined();
	});

	it('throws UsageError on missing prompt', () => {
		expect(() =>
			validateArgs({
				prompt: undefined,
				json: false,
				quiet: false,
				help: false,
				version: false,
				positional: ['img.png'],
			}),
		).toThrow(/--prompt is required/);
	});

	it('throws UsageError on empty prompt', () => {
		expect(() =>
			validateArgs({
				prompt: '   ',
				json: false,
				quiet: false,
				help: false,
				version: false,
				positional: ['img.png'],
			}),
		).toThrow(/--prompt is required/);
	});

	it('throws UsageError on missing positional image', () => {
		expect(() =>
			validateArgs({
				prompt: 'p',
				json: false,
				quiet: false,
				help: false,
				version: false,
				positional: [],
			}),
		).toThrow(/image path is required/);
	});

	it('throws UsageError on extra positionals', () => {
		expect(() =>
			validateArgs({
				prompt: 'p',
				json: false,
				quiet: false,
				help: false,
				version: false,
				positional: ['a.png', 'b.png'],
			}),
		).toThrow(/unexpected extra positional/);
	});
});

describe('run()', () => {
	let dir: string;
	let imgPath: string;
	let stdout: MemoryStream;
	let stderr: MemoryStream;

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'cli-test-'));
		imgPath = join(dir, 'img.png');
		// 1x1 transparent PNG
		const png = Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=',
			'base64',
		);
		await writeFile(imgPath, png);
		stdout = new MemoryStream();
		stderr = new MemoryStream();
	});

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
		vi.restoreAllMocks();
		vi.unstubAllGlobals();
		delete process.env.MINIMAX_API_KEY;
		delete process.env.MINIMAX_API_HOST;
	});

	function ctx() {
		return { stdout, stderr, version: '0.0.0-test' };
	}

	it('--help prints usage to stdout and exits 0', async () => {
		const code = await run(['--help'], ctx());
		expect(code).toBe(EXIT_OK);
		expect(stdout.text).toContain('Usage:');
		expect(stdout.text).toContain('--prompt');
	});

	it('--version prints version to stdout and exits 0', async () => {
		const code = await run(['--version'], ctx());
		expect(code).toBe(EXIT_OK);
		expect(stdout.text).toBe('0.0.0-test\n');
	});

	it('returns EXIT_USAGE on missing prompt', async () => {
		const code = await run([imgPath], ctx());
		expect(code).toBe(EXIT_USAGE);
		expect(stderr.text).toMatch(/--prompt/);
	});

	it('returns EXIT_USAGE on missing image positional', async () => {
		const code = await run(['--prompt', 'p'], ctx());
		expect(code).toBe(EXIT_USAGE);
		expect(stderr.text).toMatch(/image path is required/);
	});

	it('returns EXIT_USAGE when image file does not exist', async () => {
		const code = await run(['--prompt', 'p', join(dir, 'nope.png')], ctx());
		expect(code).toBe(EXIT_USAGE);
		expect(stderr.text).toMatch(/failed to read image/);
	});

	it('returns EXIT_CONFIG when MINIMAX_API_KEY is missing', async () => {
		const code = await run(['--prompt', 'p', imgPath], ctx());
		expect(code).toBe(EXIT_CONFIG);
		expect(stderr.text).toMatch(/MINIMAX_API_KEY/);
	});

	it('returns EXIT_OK with plain text output on success', async () => {
		process.env.MINIMAX_API_KEY = 'k';
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => ({
					base_resp: { status_code: 0 },
					content: 'this is a chart',
				}),
			}),
		);

		const code = await run(['--prompt', 'describe', imgPath, '--quiet'], ctx());
		expect(code).toBe(EXIT_OK);
		expect(stdout.text).toBe('this is a chart\n');
		expect(stderr.text).toBe('');
	});

	it('--json wraps output as { content }', async () => {
		process.env.MINIMAX_API_KEY = 'k';
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => ({ base_resp: { status_code: 0 }, content: 'x' }),
			}),
		);

		const code = await run(['--prompt', 'p', imgPath, '--json', '--quiet'], ctx());
		expect(code).toBe(EXIT_OK);
		const parsed = JSON.parse(stdout.text) as { content: string };
		expect(parsed.content).toBe('x');
	});

	it('-o writes response to file instead of stdout', async () => {
		process.env.MINIMAX_API_KEY = 'k';
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => ({ base_resp: { status_code: 0 }, content: 'saved' }),
			}),
		);

		const outFile = join(dir, 'out.txt');
		const code = await run(['--prompt', 'p', imgPath, '-o', outFile, '--quiet'], ctx());
		expect(code).toBe(EXIT_OK);
		expect(stdout.text).toBe('');
		const { readFile } = await import('node:fs/promises');
		expect(await readFile(outFile, 'utf8')).toBe('saved\n');
	});

	it('returns EXIT_API on VlmError', async () => {
		process.env.MINIMAX_API_KEY = 'k';
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: false,
				status: 503,
				json: async () => ({ base_resp: { status_msg: 'down' } }),
			}),
		);

		const code = await run(['--prompt', 'p', imgPath, '--quiet'], ctx());
		expect(code).toBe(EXIT_API);
		expect(stderr.text).toMatch(/API error/);
	});

	it('returns EXIT_API on thrown fetch (network error)', async () => {
		process.env.MINIMAX_API_KEY = 'k';
		vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));

		const code = await run(['--prompt', 'p', imgPath, '--quiet'], ctx());
		expect(code).toBe(EXIT_API);
		expect(stderr.text).toMatch(/network error/);
	});
});
