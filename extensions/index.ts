import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";

const API_HOST = "https://api.minimax.io";
const VLM_ENDPOINT = `${API_HOST}/v1/coding_plan/vlm`;

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
  const mediaType: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    gif: "image/gif",
  }[ext] || "image/jpeg";

  const data = await readFile(path);
  const base64 = data.toString("base64");
  return `data:${mediaType};base64,${base64}`;
}

async function fetchUrlAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image URL: ${url} — HTTP ${response.status}`);
  }

  const contentType = response.headers.get("Content-Type") || "image/jpeg";
  const mediaType = contentType.split(";")[0].trim();
  const validTypes: Record<string, string> = {
    "image/png": "image/png",
    "image/jpeg": "image/jpeg",
    "image/webp": "image/webp",
    "image/gif": "image/gif",
  };
  const resolvedType = validTypes[mediaType] || "image/jpeg";

  const blob = await response.arrayBuffer();
  const base64 = Buffer.from(blob).toString("base64");
  return `data:${resolvedType};base64,${base64}`;
}

async function callVLM(apiKey: string, prompt: string, imageUrl: string, apiHost: string): Promise<string> {
  const endpoint = `${apiHost}/v1/coding_plan/vlm`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, image_url: imageUrl }),
  });

  if (!response.ok) {
    let msg = `HTTP ${response.status}`;
    try {
      const err = await response.json();
      msg = err.base_resp?.status_msg || err.error?.message || msg;
    } catch {
      // ignore parse error
    }
    throw new Error(msg);
  }

  const result = await response.json();
  if (result.base_resp?.status_code !== 0) {
    throw new Error(`Error ${result.base_resp?.status_code}: ${result.base_resp?.status_msg}`);
  }

  return result.content || "";
}

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "image_understanding",
    label: "Image Understanding",
    description:
      "Analyze, describe, or extract information from images using vision-language models. " +
      "Use for describing screenshots, reading text from images, analyzing diagrams, or visual question answering.",
    promptSnippet: "Understand or extract text from images using AI",
    parameters: Type.Object({
      prompt: Type.String({
        description: "Question or instruction for the image (e.g., 'Describe this image', 'Read the text', 'What does the chart show?')",
      }),
      image: Type.Union([
        Type.Object({
          type: Type.Literal("path"),
          value: Type.String({ description: "Local path to the image file" }),
        }),
        Type.Object({
          type: Type.Literal("url"),
          value: Type.String({ description: "HTTP(S) URL to the image" }),
        }),
        Type.Object({
          type: Type.Literal("base64"),
          mediaType: Type.String({ description: "Media type (e.g., image/png, image/jpeg)" }),
          data: Type.String({ description: "Base64-encoded image data" }),
        }),
      ], { description: "Image source: local path, URL, or base64 data" }),
    }),

    async execute(_toolCallId, params, signal, onUpdate) {
      onUpdate?.({ content: [{ type: "text", text: "Processing image..." }] });

      const config = getConfig();
      let imageUrl: string;

      if (params.image.type === "path") {
        imageUrl = await loadImageAsBase64(params.image.value);
      } else if (params.image.type === "url") {
        imageUrl = await fetchUrlAsBase64(params.image.value);
      } else {
        imageUrl = `data:${params.image.mediaType};base64,${params.image.data}`;
      }

      const result = await callVLM(config.apiKey, params.prompt, imageUrl, config.apiHost);

      return {
        content: [{ type: "text", text: result }],
        details: {},
      };
    },
  });
}
