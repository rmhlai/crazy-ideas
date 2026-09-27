import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import fs from "node:fs";
import path from "node:path";
import * as schema from "./schema";

export type DB = BetterSQLite3Database<typeof schema> & { $client: Database.Database };

export function dataDir(): string {
  // the data folder lives outside the build; keep Turbopack from tracing it
  return path.resolve(/* turbopackIgnore: true */ process.cwd(), process.env.LUNCHBOX_DATA_DIR ?? "data");
}

export function uploadsDir(): string {
  return path.join(dataDir(), "uploads");
}

export function dbPath(): string {
  return path.join(dataDir(), "lunchbox.db");
}

/** Open (and migrate) a database. Pass ":memory:" in tests. */
export function openDb(file: string): DB {
  if (file !== ":memory:") fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  const db = drizzle(sqlite, { schema }) as DB;
  migrate(db, { migrationsFolder: path.resolve(/* turbopackIgnore: true */ process.cwd(), "drizzle") });
  return db;
}

const globalForDb = globalThis as unknown as { __lunchboxDb?: DB };

export function getDb(): DB {
  if (!globalForDb.__lunchboxDb) {
    globalForDb.__lunchboxDb = openDb(dbPath());
  }
  return globalForDb.__lunchboxDb;
}

/** Tests: swap in an isolated database. */
export function setDbForTesting(db: DB | undefined) {
  globalForDb.__lunchboxDb = db;
}

export { schema };
