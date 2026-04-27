import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

function createDatabase(connectionString: string) {
  const client = postgres(connectionString, {
    max: 1,
    idle_timeout: 20,
    prepare: false,
  });

  return drizzle({ client, schema });
}

type NoraCareDb = ReturnType<typeof createDatabase>;

declare global {
  var __noracareDb: NoraCareDb | undefined;
}

export function getDb() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is not set.");
  }

  if (!globalThis.__noracareDb) {
    globalThis.__noracareDb = createDatabase(connectionString);
  }

  return globalThis.__noracareDb;
}
