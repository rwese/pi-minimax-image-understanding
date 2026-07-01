/**
 * MiniMax API configuration loaded from environment variables.
 *
 * Shared between the pi-extension tool and the standalone CLI.
 */

export const DEFAULT_API_HOST = 'https://api.minimax.io';

export interface MiniMaxConfig {
	apiKey: string;
	apiHost: string;
}

export class ConfigError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ConfigError';
	}
}

/**
 * Read config from process.env. Throws ConfigError when MINIMAX_API_KEY
 * is missing. The extension and the CLI both rely on the same env names
 * so user setup is portable.
 *
 * The env parameter is typed loosely so the function is trivially
 * testable and ESLint does not need the NodeJS namespace declared.
 */
export function getConfig(env: Record<string, string | undefined> = process.env): MiniMaxConfig {
	const apiKey = env.MINIMAX_API_KEY;
	if (!apiKey) {
		throw new ConfigError('MINIMAX_API_KEY environment variable is not set');
	}
	return {
		apiKey,
		apiHost: env.MINIMAX_API_HOST || DEFAULT_API_HOST,
	};
}
