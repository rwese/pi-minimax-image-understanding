import { describe, expect, it } from 'vitest';

import { ConfigError, DEFAULT_API_HOST, getConfig } from '../src/config.js';

describe('getConfig', () => {
	it('returns apiKey and default host when only MINIMAX_API_KEY is set', () => {
		const cfg = getConfig({ MINIMAX_API_KEY: 'test-key' });
		expect(cfg.apiKey).toBe('test-key');
		expect(cfg.apiHost).toBe(DEFAULT_API_HOST);
	});

	it('uses MINIMAX_API_HOST override when provided', () => {
		const cfg = getConfig({
			MINIMAX_API_KEY: 'test-key',
			MINIMAX_API_HOST: 'https://example.test',
		});
		expect(cfg.apiHost).toBe('https://example.test');
	});

	it('throws ConfigError when MINIMAX_API_KEY is missing', () => {
		expect(() => getConfig({})).toThrow(ConfigError);
	});

	it('throws ConfigError when MINIMAX_API_KEY is empty string', () => {
		expect(() => getConfig({ MINIMAX_API_KEY: '' })).toThrow(ConfigError);
	});

	it('DEFAULT_API_HOST points at minimax.io', () => {
		expect(DEFAULT_API_HOST).toBe('https://api.minimax.io');
	});
});
