import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { loadImageAsBase64, mimeForPath } from '../src/image.js';

describe('mimeForPath', () => {
	it('maps known extensions to MIME types', () => {
		expect(mimeForPath('/x/y.png')).toBe('image/png');
		expect(mimeForPath('/x/y.PNG')).toBe('image/png');
		expect(mimeForPath('/x/y.jpg')).toBe('image/jpeg');
		expect(mimeForPath('/x/y.jpeg')).toBe('image/jpeg');
		expect(mimeForPath('/x/y.webp')).toBe('image/webp');
		expect(mimeForPath('/x/y.gif')).toBe('image/gif');
	});

	it('falls back to image/jpeg for unknown extensions', () => {
		expect(mimeForPath('/x/y.bmp')).toBe('image/jpeg');
		expect(mimeForPath('/x/y')).toBe('image/jpeg');
	});
});

describe('loadImageAsBase64', () => {
	let dir: string;

	beforeEach(async () => {
		dir = await mkdtemp(join(tmpdir(), 'img-test-'));
	});

	afterEach(async () => {
		await rm(dir, { recursive: true, force: true });
	});

	it('reads a PNG and returns a data URL with the right prefix', async () => {
		const p = join(dir, 'a.png');
		const bytes = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
		await writeFile(p, bytes);
		const url = await loadImageAsBase64(p);
		expect(url.startsWith('data:image/png;base64,')).toBe(true);
		expect(url).toBe(`data:image/png;base64,${bytes.toString('base64')}`);
	});

	it('propagates ENOENT when the file does not exist', async () => {
		await expect(loadImageAsBase64(join(dir, 'missing.png'))).rejects.toThrow();
	});
});
