import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs/promises";
import path from "node:path";
import { INGREDIENTS_TOOL, ORDER_FORM_TOOL } from "./schemas";
import { SYSTEM_PROMPT, ingredientsPrompt, orderFormPrompt } from "./prompts";
import type { Extraction, UploadKind } from "./types";

export type ModelInputFile = { data: Buffer; mimeType: string };

export class ExtractionError extends Error {}
export class MissingApiKeyError extends ExtractionError {
  constructor() {
    super("No Anthropic API key configured. Add ANTHROPIC_API_KEY to .env.local, or enter the details by hand.");
  }
}

type ClientLike = Pick<Anthropic, "messages">;
let clientFactory: (() => ClientLike) | null = null;

/** Tests: inject a fake Anthropic client. Pass null to restore the real one. */
export function setAnthropicClientFactory(f: (() => ClientLike) | null) {
  clientFactory = f;
}

function getClient(): ClientLike {
  if (clientFactory) return clientFactory();
  if (!process.env.ANTHROPIC_API_KEY?.trim()) throw new MissingApiKeyError();
  return new Anthropic();
}

function contentBlocks(files: ModelInputFile[]): Anthropic.ContentBlockParam[] {
  return files.map((f): Anthropic.ContentBlockParam => {
    const data = f.data.toString("base64");
    if (f.mimeType === "application/pdf") {
      return { type: "document", source: { type: "base64", media_type: "application/pdf", data } };
    }
    return {
      type: "image",
      source: {
        type: "base64",
        media_type: f.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        data,
      },
    };
  });
}

/**
 * Send the upload to Claude with a tool whose input schema is the extraction schema,
 * and return the tool input as the structured extraction.
 *
 * Only the document contents are sent — no child names or other app data.
 */
export async function extractWithClaude(kind: UploadKind, files: ModelInputFile[], model: string): Promise<Extraction> {
  const mockDir = process.env.LUNCHBOX_MOCK_EXTRACTION_DIR;
  if (mockDir && !clientFactory) {
    const raw = await fs.readFile(path.resolve(mockDir, `${kind}.json`), "utf8");
    return JSON.parse(raw) as Extraction;
  }

  const client = getClient();
  const tool = kind === "order_form" ? ORDER_FORM_TOOL : INGREDIENTS_TOOL;
  const prompt = kind === "order_form" ? orderFormPrompt() : ingredientsPrompt();

  // tool_choice "auto" + an explicit instruction works on every current model
  // (some newer models reject forced tool_choice); the result is validated below.
  const stream = client.messages.stream({
    model,
    max_tokens: 64000,
    system: SYSTEM_PROMPT,
    tools: [tool],
    tool_choice: { type: "auto", disable_parallel_tool_use: true },
    messages: [
      {
        role: "user",
        content: [
          ...contentBlocks(files),
          { type: "text", text: `${prompt}\n\nRespond only by calling the ${tool.name} tool.` },
        ],
      },
    ],
  });
  const message = await stream.finalMessage();

  if (message.stop_reason === "refusal") {
    throw new ExtractionError("The model declined to read this document.");
  }
  if (message.stop_reason === "max_tokens") {
    throw new ExtractionError("The document was too long to read in one go. Try splitting it into smaller uploads.");
  }
  const toolUse = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === tool.name,
  );
  if (!toolUse) {
    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join(" ")
      .slice(0, 300);
    throw new ExtractionError(`The model did not return structured data.${text ? ` It said: ${text}` : ""}`);
  }
  return toolUse.input as Extraction;
}

export function describeApiError(err: unknown): string {
  if (err instanceof Anthropic.AuthenticationError) return "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in .env.local.";
  if (err instanceof Anthropic.NotFoundError) return "The configured model was not found. Check the model name in Settings.";
  if (err instanceof Anthropic.RateLimitError) return "Rate limited by the Anthropic API — wait a minute and retry.";
  if (err instanceof Anthropic.BadRequestError) return `The API rejected the request: ${err.message}`;
  if (err instanceof Anthropic.APIError) return `Anthropic API error${err.status ? ` ${err.status}` : ""}: ${err.message}`;
  if (err instanceof Error) return err.message;
  return String(err);
}

/** Settings page: verify the key and model with a cheap metadata call. */
export async function checkApiKey(model: string): Promise<{ ok: boolean; message: string }> {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) return { ok: false, message: "ANTHROPIC_API_KEY is not set." };
  try {
    const m = await new Anthropic().models.retrieve(model);
    return { ok: true, message: `Key works. Model: ${m.display_name ?? m.id}` };
  } catch (err) {
    return { ok: false, message: describeApiError(err) };
  }
}
