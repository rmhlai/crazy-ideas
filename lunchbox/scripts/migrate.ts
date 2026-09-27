import { getDb, dbPath } from "../src/lib/db";

getDb();
console.log(`Database ready at ${dbPath()}`);
