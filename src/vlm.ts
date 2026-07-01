/**
 * Thin client for the MiniMax `/v1/coding_plan/vlm` endpoint.
 *
 * Throws VlmError on non-2xx responses or when the API reports a
 * non-zero base_resp status_code so callers (extension + CLI) can surface
 * a clean error.
 */

import type { MiniMaxConfig } from './config.js';

export interface VlmResponse {
	content: string;
}

export class VlmError extends Error {
	readonly status: number | undefined;
	constructor(message: string, status?: number) {
		super(message);
		this.name = 'VlmError';
		this.status = status;
	}
}

interface ApiErrorBody {
	base_resp?: { status_code?: number; status_msg?: string };
	error?: { message?: string };
}

interface ApiSuccessBody {
	base_resp?: { status_code?: number; status_msg?: string };
	content?: string;
}

function extractErrorMessage(body: ApiErrorBody, fallback: string): string {
	return body.base_resp?.status_msg ?? body.error?.message ?? fallback;
}

export async function callVlm(
	config: MiniMaxConfig,
	prompt: string,
	imageUrl: string,
	signal?: AbortSignal,
): Promise<VlmResponse> {
	const endpoint = `${config.apiHost}/v1/coding_plan/vlm`;

	const response = await fetch(endpoint, {
		method: 'POST',
		headers: {
			Authorization: `Bearer ${config.apiKey}`,
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({ prompt, image_url: imageUrl }),
		signal,
	});

	if (!response.ok) {
		let msg = `HTTP ${response.status}`;
		try {
			const err = (await response.json()) as ApiErrorBody;
			msg = extractErrorMessage(err, msg);
		} catch {
			// body wasn't JSON; keep the HTTP-status fallback
		}
		throw new VlmError(msg, response.status);
	}

	const result = (await response.json()) as ApiSuccessBody;
	if (result.base_resp?.status_code !== 0) {
		throw new VlmError(
			`Error ${result.base_resp?.status_code ?? '?'}: ${result.base_resp?.status_msg ?? 'unknown'}`,
			response.status,
		);
	}

	return { content: result.content ?? '' };
}
