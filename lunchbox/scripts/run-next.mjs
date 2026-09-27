// Starts `next dev` / `next start` bound to 127.0.0.1 unless ALLOW_LAN=true.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

for (const f of [".env.local", ".env"]) {
  if (existsSync(f)) {
    try {
      process.loadEnvFile(f);
    } catch {}
  }
}

const mode = process.argv[2] ?? "dev";
const host = process.env.ALLOW_LAN === "true" ? "0.0.0.0" : "127.0.0.1";
const port = process.env.PORT ?? "3000";
const args = [mode, "-H", host, "-p", port, ...process.argv.slice(3)];
console.log(`LunchBox: next ${args.join(" ")}${host === "0.0.0.0" ? "  (LAN access enabled)" : ""}`);
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", ...args], { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 0));
