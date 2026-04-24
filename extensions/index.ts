import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Text } from "@mariozechner/pi-tui";
import { Type } from "@sinclair/typebox";

const API_HOST = "https://api.minimax.io";

interface MiniMaxConfig {
  apiKey: string;
  apiHost?: string;
}

function getConfig(): MiniMaxConfig {
  const apiKey = process.env.MINIMAX_API_KEY;
  if (!apiKey) {
    throw new Error("MINIMAX_API_KEY environment variable is not set");
  }
  return {
    apiKey,
    apiHost: process.env.MINIMAX_API_HOST || API_HOST,
  };
}

async function loadImageAsBase64(path: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const { extname } = await import("node:path");

  const ext = extname(path).toLowerCase().slice(1);
  const extToMime: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
  };
  const mediaType = extToMime[ext] ?? "image/jpeg";

  const data = await readFile(path);
  const base64 = data.toString("base64");
  return `data:${mediaType};base64,${base64}`;
}

async function callVLM(apiKey: string, prompt: string, imageUrl: string, apiHost: string, signal?: AbortSignal): Promise<string> {
  const endpoint = `${apiHost}/v1/coding_plan/vlm`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, image_url: imageUrl }),
    signal,
  });

  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try {
      const err = (await response.json()) as { base_resp?: { status_msg?: string }; error?: { message?: string } };
      msg = err.base_resp?.status_msg ?? err.error?.message ?? msg;
    } catch {
      // ignore parse error
    }
    throw new Error(msg);
  }

  const result = (await response.json()) as { base_resp?: { status_code?: number; status_msg?: string }; content?: string };
  if (result.base_resp?.status_code !== 0) {
    throw new Error(`Error ${result.base_resp?.status_code}: ${result.base_resp?.status_msg}`);
  }

  return result.content ?? "";
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "image_understanding",
    label: "Image Understanding",
    description: "Analyze local images: screenshots, diagrams, charts, or any image file.",
    parameters: Type.Object({
      prompt: Type.String({ minLength: 1, description: "Question or instruction about the image" }),
      image: Type.String({ minLength: 1, description: "Path to the image file" }),
    }),

    async execute(_toolCallId, params, signal, onUpdate) {
      onUpdate?.({ content: [{ type: "text", text: "Processing image..." }] } as Parameters<typeof onUpdate>[0]);

      const config = getConfig();
      const imageUrl = await loadImageAsBase64(params.image);
      const result = await callVLM(config.apiKey, params.prompt, imageUrl, config.apiHost ?? API_HOST, signal);

      return {
        content: [{ type: "text", text: result }],
        details: { query: params.prompt },
      };
    },

    renderCall(args, theme, _context) {
      const text = new Text("", 0, 0);
      let content = theme.fg("toolTitle", theme.bold("image_understanding "));
      content += theme.fg("muted", `"${args.prompt}"`);
      text.setText(content);
      return text;
    },

    renderResult(result, { isPartial }, theme, _context) {
      if (isPartial) {
        return new Text(theme.fg("warning", "Processing image..."), 0, 0);
      }

      const text = new Text("", 0, 0);
      const query = (result.details as { query?: string } | undefined)?.query;
      let content = theme.fg("success", "✓ Image Understanding");
      if (query) {
        content += "\n" + theme.fg("dim", `Query: ${query}`);
      }
      content += "\n";
      // Append the actual result text
      const resultText = result.content?.[0]?.type === "text" ? result.content[0].text : "";
      content += resultText;
      text.setText(content);
      return text;
    },
  });
}
