import "server-only";
import { Pool, neonConfig, types, type PoolClient } from "@neondatabase/serverless";

/**
 * Server-only access to Neon PostgreSQL.
 *
 * The connection string is read from DATABASE_URL at runtime and never leaves
 * the server. Calendar dates (DATE) are returned as `YYYY-MM-DD` strings, so
 * they are never converted through a JavaScript Date and shifted by timezone.
 */

types.setTypeParser(1082, (v: string) => v); // DATE → 'YYYY-MM-DD'
types.setTypeParser(20, (v: string) => Number(v)); // BIGINT / COUNT → number
types.setTypeParser(1700, (v: string) => Number(v)); // NUMERIC → number
types.setTypeParser(1184, (v: string) => new Date(v).toISOString()); // TIMESTAMPTZ → ISO string

if (process.env.NEON_LOCAL_WSPROXY) {
  // Local Postgres behind Neon's wsproxy, for development and tests only.
  const proxy = process.env.NEON_LOCAL_WSPROXY;
  neonConfig.wsProxy = () => proxy;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
}

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super("DATABASE_URL não está configurada.");
    this.name = "DatabaseNotConfiguredError";
  }
}

const globalForDb = globalThis as unknown as { fisioPool?: Pool };

function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new DatabaseNotConfiguredError();
  if (!globalForDb.fisioPool) {
    globalForDb.fisioPool = new Pool({ connectionString, max: 5 });
    globalForDb.fisioPool.on("error", () => {
      // Idle-client errors are handled by the pool; avoid logging connection details.
    });
  }
  return globalForDb.fisioPool;
}

export type Queryable = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[]; rowCount: number | null }>;
};

/** Runs a parameterized query outside a transaction. */
export async function query<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await getPool().query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Runs `fn` inside a single transaction; rolls back on any error. */
export async function withTransaction<T>(fn: (tx: Queryable) => Promise<T>): Promise<T> {
  const client: PoolClient = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client as unknown as Queryable);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}

export const db: Queryable = {
  async query<T>(text: string, params?: unknown[]) {
    const result = await getPool().query(text, params);
    return { rows: result.rows as T[], rowCount: result.rowCount };
  },
};
