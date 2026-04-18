import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
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
    gif: "image/gif",
  };
  const mediaType = extToMime[ext] ?? "image/jpeg";

  const data = await readFile(path);
  const base64 = data.toString("base64");
  return `data:${mediaType};base64,${base64}`;
}

async function fetchUrlAsBase64(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image URL: ${url} — HTTP ${response.status}`);
  }

  const contentType = response.headers.get("Content-Type") ?? "image/jpeg";
  const mediaType = (contentType.split(";")[0] ?? "image/jpeg").trim();
  const validTypes: Record<string, string> = {
    "image/png": "image/png",
    "image/jpeg": "image/jpeg",
    "image/webp": "image/webp",
    "image/gif": "image/gif",
  };
  const resolvedType = validTypes[mediaType] ?? "image/jpeg";

  const blob = await response.arrayBuffer();
  const base64 = Buffer.from(blob).toString("base64");
  return `data:${resolvedType};base64,${base64}`;
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
    description:
      "Analyze, describe, or extract information from images using vision-language models. " +
      "Use for describing screenshots, reading text from images, analyzing diagrams, or visual question answering.",
    parameters: Type.Object({
      prompt: Type.String({
        description: "Question or instruction for the image",
        minLength: 1,
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
          data: Type.String({ description: "Base64-encoded image data (with optional data: URI prefix)" }),
        }),
      ], { description: "Image source: local path, URL, or base64 data" }),
    }),

    async execute(_toolCallId, params, signal, onUpdate) {
      onUpdate?.({ content: [{ type: "text", text: "Processing image..." }] } as Parameters<typeof onUpdate>[0]);

      const config = getConfig();

      // Defensive: handle cases where the framework passes image as a JSON string
      let imageParam: { type: "path"; value: string } | { type: "url"; value: string } | { type: "base64"; data: string } = params.image as { type: "path"; value: string } | { type: "url"; value: string } | { type: "base64"; data: string };
      if (typeof imageParam === "string") {
        try {
          imageParam = JSON.parse(imageParam) as typeof imageParam;
        } catch (_e) {
          const val = imageParam as string;
          throw new Error(`Invalid image parameter: expected object, got string "${val.slice(0, 50)}..."`);
        }
      }

      let imageUrl: string = "";

      if (imageParam.type === "path") {
        imageUrl = await loadImageAsBase64(imageParam.value);
      } else if (imageParam.type === "url") {
        imageUrl = await fetchUrlAsBase64(imageParam.value);
      } else {
        // Auto-detect MIME type from data: URI prefix or default to jpeg
        let mimeType = "image/jpeg";
        let base64Data = imageParam.data;
        const dataMatch = base64Data.match(/^data:([^;]+);base64,/);
        if (dataMatch !== null && dataMatch[1] !== undefined && dataMatch[0] !== undefined) {
          mimeType = dataMatch[1];
          base64Data = base64Data.slice(dataMatch[0].length);
        }
        imageUrl = `data:${mimeType};base64,${base64Data}`;
      }

      const result = await callVLM(config.apiKey, params.prompt, imageUrl, config.apiHost ?? API_HOST, signal);

      return {
        content: [{ type: "text", text: result }],
        details: {},
      };
    },
  });
}
