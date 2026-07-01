import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { MiniMaxConfig } from '../src/config.js';
import { VlmError, callVlm } from '../src/vlm.js';

const config: MiniMaxConfig = { apiKey: 'k', apiHost: 'https://api.test' };

function mockFetchOnce(
	body: unknown,
	init: { status?: number; ok?: boolean } = {},
): ReturnType<typeof vi.fn> {
	const fn = vi.fn().mockResolvedValueOnce({
		ok: init.ok ?? (init.status === undefined || (init.status >= 200 && init.status < 300)),
		status: init.status ?? 200,
		json: async () => body,
	});
	vi.stubGlobal('fetch', fn);
	return fn;
}

describe('callVlm', () => {
	beforeEach(() => {
		vi.restoreAllMocks();
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('POSTs to /v1/coding_plan/vlm with the expected body and headers', async () => {
		const fetchMock = mockFetchOnce({
			base_resp: { status_code: 0, status_msg: 'ok' },
			content: 'hello',
		});

		const out = await callVlm(config, 'describe', 'data:image/png;base64,AAA');
		expect(out.content).toBe('hello');

		expect(fetchMock).toHaveBeenCalledOnce();
		const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
		expect(url).toBe('https://api.test/v1/coding_plan/vlm');
		expect(init.method).toBe('POST');
		const headers = init.headers as Record<string, string>;
		expect(headers.Authorization).toBe('Bearer k');
		expect(headers['Content-Type']).toBe('application/json');
		expect(JSON.parse(init.body as string)).toEqual({
			prompt: 'describe',
			image_url: 'data:image/png;base64,AAA',
		});
	});

	it('returns empty content when API omits it', async () => {
		mockFetchOnce({ base_resp: { status_code: 0 } });
		const out = await callVlm(config, 'p', 'data:url');
		expect(out.content).toBe('');
	});

	it('throws VlmError when base_resp.status_code is non-zero', async () => {
		vi.stubGlobal(
			'fetch',
			vi.fn().mockResolvedValue({
				ok: true,
				status: 200,
				json: async () => ({
					base_resp: { status_code: 1001, status_msg: 'rate limited' },
					content: '',
				}),
			}),
		);
		await expect(callVlm(config, 'p', 'data:url')).rejects.toThrowError(VlmError);
		await expect(callVlm(config, 'p', 'data:url')).rejects.toThrow(/rate limited/);
	});

	it('throws VlmError on non-2xx with base_resp.status_msg', async () => {
		mockFetchOnce({ base_resp: { status_msg: 'forbidden' } }, { status: 403, ok: false });
		try {
			await callVlm(config, 'p', 'data:url');
			throw new Error('should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(VlmError);
			expect((err as VlmError).message).toBe('forbidden');
			expect((err as VlmError).status).toBe(403);
		}
	});

	it('throws VlmError on non-2xx with error.message body', async () => {
		mockFetchOnce({ error: { message: 'boom' } }, { status: 500, ok: false });
		try {
			await callVlm(config, 'p', 'data:url');
			throw new Error('should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(VlmError);
			expect((err as VlmError).message).toBe('boom');
		}
	});

	it('falls back to HTTP status text on non-JSON error body', async () => {
		const fn = vi.fn().mockResolvedValueOnce({
			ok: false,
			status: 502,
			json: async () => {
				throw new Error('not json');
			},
		});
		vi.stubGlobal('fetch', fn);
		try {
			await callVlm(config, 'p', 'data:url');
			throw new Error('should have thrown');
		} catch (err) {
			expect(err).toBeInstanceOf(VlmError);
			expect((err as VlmError).message).toBe('HTTP 502');
		}
	});

	it('forwards AbortSignal to fetch', async () => {
		const ctrl = new AbortController();
		const fn = vi.fn().mockResolvedValueOnce({
			ok: true,
			status: 200,
			json: async () => ({ base_resp: { status_code: 0 }, content: 'ok' }),
		});
		vi.stubGlobal('fetch', fn);
		await callVlm(config, 'p', 'data:url', ctrl.signal);
		const [, init] = fn.mock.calls[0] as [string, RequestInit];
		expect(init.signal).toBe(ctrl.signal);
	});
});
