/**
 * Integration tests run against a REAL Postgres (docker-compose), not a
 * mock — this is deliberate: the whole point of these tests is proving that
 * Row-Level Security actually rejects cross-tenant reads, which a mocked DB
 * layer could never verify. This file resets the schema to a known state
 * before the suite runs.
 */
import { Pool } from "pg";
import { readFileSync } from "fs";
import { join } from "path";

export async function resetTestDatabase(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set to run integration tests");
  }

  const pool = new Pool({ connectionString });
  try {
    await pool.query("drop schema public cascade");
    await pool.query("create schema public");
    const sql = readFileSync(
      join(__dirname, "../../../../packages/db/sandbox-init.sql"),
      "utf-8",
    );
    await pool.query(sql);
  } finally {
    await pool.end();
  }
}
