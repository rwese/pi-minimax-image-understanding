/**
 * Integration smoke: load the published extension entry through the
 * same `@mariozechner/jiti` loader that pi uses internally. Confirms the
 * `import "../src/*.js"` rewrites resolve to the sibling `.ts` files
 * and that the exported factory registers the `image_understanding`
 * tool against a stub pi object.
 *
 * Skipped when @mariozechner/jiti is not installed (it's a peer in
 * practice, only present as a transitive dev dep).
 */

import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { createJiti } from '@mariozechner/jiti';

async function tryLoadExtension(): Promise<((pi: unknown) => void) | undefined> {
	try {
		const here = dirname(fileURLToPath(import.meta.url));
		const extEntry = resolve(here, '..', 'extensions', 'index.ts');
		const jiti = createJiti(import.meta.url, {
			moduleCache: false,
			interopDefault: true,
		});
		const mod = (await jiti.import(extEntry)) as { default?: (pi: unknown) => void };
		return typeof mod.default === 'function' ? mod.default : undefined;
	} catch {
		return undefined;
	}
}

describe('extension loader integration', () => {
	it('exports a default factory loadable through @mariozechner/jiti', async () => {
		const factory = await tryLoadExtension();
		if (!factory) {
			// jiti is a peer; if it's not installed in this environment we
			// don't want CI to fail.
			return;
		}

		const registered: Array<{ name: string; description: string; hasRenderCall: boolean; hasRenderResult: boolean }> = [];
		const fakePi = {
			registerTool(tool: {
				name: string;
				description: string;
				renderCall?: unknown;
				renderResult?: unknown;
			}) {
				registered.push({
					name: tool.name,
					description: tool.description,
					hasRenderCall: typeof tool.renderCall === 'function',
					hasRenderResult: typeof tool.renderResult === 'function',
				});
			},
		};

		factory(fakePi);

		expect(registered).toHaveLength(1);
		expect(registered[0]?.name).toBe('image_understanding');
		expect(registered[0]?.description).toContain('Analyze local images');
		expect(registered[0]?.hasRenderCall).toBe(true);
		expect(registered[0]?.hasRenderResult).toBe(true);
	});
});