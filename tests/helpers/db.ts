import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { Pool, neonConfig } from "@neondatabase/serverless";

/**
 * Database tests run only when TEST_DATABASE_URL points to a disposable
 * database (its public schema is dropped and recreated). Never point it to
 * the production database.
 */
export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL;
export const hasTestDatabase = Boolean(TEST_DATABASE_URL);

if (TEST_DATABASE_URL) process.env.DATABASE_URL = TEST_DATABASE_URL;

export async function resetDatabase() {
  if (process.env.NEON_LOCAL_WSPROXY) {
    const proxy = process.env.NEON_LOCAL_WSPROXY;
    neonConfig.wsProxy = () => proxy;
    neonConfig.useSecureWebSocket = false;
    neonConfig.pipelineTLS = false;
    neonConfig.pipelineConnect = false;
  }
  const pool = new Pool({ connectionString: TEST_DATABASE_URL });
  try {
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public;");
    const dir = join(process.cwd(), "migrations");
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
      await pool.query(readFileSync(join(dir, file), "utf8"));
    }
  } finally {
    await pool.end();
  }
}
