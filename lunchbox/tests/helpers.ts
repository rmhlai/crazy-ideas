import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDb, setDbForTesting } from "@/lib/db";
import { setAnthropicClientFactory } from "@/lib/extraction/claude";

export function freshDb() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "lunchbox-test-"));
  process.env.LUNCHBOX_DATA_DIR = dir;
  const db = openDb(":memory:");
  setDbForTesting(db);
  return { db, dir };
}

export function loadFixture<T = unknown>(name: string): T {
  return JSON.parse(fs.readFileSync(path.resolve("fixtures/samples", name), "utf8")) as T;
}

/** A fake Anthropic client whose stream() resolves to a tool_use with `input`. */
export function mockClaude(input: unknown, toolName: string) {
  const calls: unknown[] = [];
  setAnthropicClientFactory(() => ({
    messages: {
      stream: (params: unknown) => {
        calls.push(params);
        return {
          finalMessage: async () => ({
            stop_reason: "tool_use",
            content: [{ type: "tool_use", id: "tu_1", name: toolName, input }],
          }),
        };
      },
    } as never,
  }));
  return calls;
}
