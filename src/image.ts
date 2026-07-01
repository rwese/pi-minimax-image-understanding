/**
 * Image loading: read a local image file and return a data: URL suitable
 * for the VLM endpoint's `image_url` field.
 *
 * Supported extensions: png, jpg, jpeg, webp. Anything else falls back
 * to image/jpeg — the API accepts the data URL regardless.
 */

import { extname } from 'node:path';
import { readFile } from 'node:fs/promises';

const EXT_TO_MIME: Record<string, string> = {
	png: 'image/png',
	jpg: 'image/jpeg',
	jpeg: 'image/jpeg',
	webp: 'image/webp',
	gif: 'image/gif',
};

export function mimeForPath(path: string): string {
	const ext = extname(path).toLowerCase().slice(1);
	return EXT_TO_MIME[ext] ?? 'image/jpeg';
}

export async function loadImageAsBase64(path: string): Promise<string> {
	const data = await readFile(path);
	const base64 = data.toString('base64');
	return `data:${mimeForPath(path)};base64,${base64}`;
}
