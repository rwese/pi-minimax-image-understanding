import type { ExtensionAPI } from '@mariozechner/pi-coding-agent';
import { Text } from '@mariozechner/pi-tui';
import { Type } from '@sinclair/typebox';

import { ConfigError, getConfig } from '../src/config.js';
import { loadImageAsBase64 } from '../src/image.js';
import { VlmError, callVlm } from '../src/vlm.js';

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: 'image_understanding',
		label: 'Image Understanding',
		description: 'Analyze local images: screenshots, diagrams, charts, or any image file.',
		parameters: Type.Object({
			prompt: Type.String({
				minLength: 1,
				description: 'Question or instruction about the image',
			}),
			image: Type.String({ minLength: 1, description: 'Path to the image file' }),
		}),

		async execute(_toolCallId, params, signal, onUpdate) {
			onUpdate?.({
				content: [{ type: 'text', text: 'Processing image...' }],
			} as Parameters<typeof onUpdate>[0]);

			let config;
			try {
				config = getConfig();
			} catch (err) {
				if (err instanceof ConfigError) {
					throw new Error(`Configuration error: ${err.message}`);
				}
				throw err;
			}

			const imageUrl = await loadImageAsBase64(params.image);

			try {
				const { content } = await callVlm(config, params.prompt, imageUrl, signal);
				return {
					content: [{ type: 'text', text: content }],
					details: { query: params.prompt },
				};
			} catch (err) {
				if (err instanceof VlmError) {
					throw new Error(`API error: ${err.message}`);
				}
				throw err;
			}
		},

		renderCall(args, theme, _context) {
			const text = new Text('', 0, 0);
			let content = theme.fg('toolTitle', theme.bold('image_understanding '));
			content += theme.fg('muted', `"${args.prompt}"`);
			text.setText(content);
			return text;
		},

		renderResult(result, { isPartial }, theme, _context) {
			if (isPartial) {
				return new Text(theme.fg('warning', 'Processing image...'), 0, 0);
			}

			const text = new Text('', 0, 0);
			const query = (result.details as { query?: string } | undefined)?.query;
			let content = theme.fg('success', '✓ Image Understanding');
			if (query) {
				content += '\n' + theme.fg('dim', `Query: ${query}`);
			}
			content += '\n';
			// Append the actual result text
			const resultText = result.content?.[0]?.type === 'text' ? result.content[0].text : '';
			content += resultText;
			text.setText(content);
			return text;
		},
	});
}
