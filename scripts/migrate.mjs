#!/usr/bin/env node
// Applies the versioned SQL files in /migrations to the database in
// DATABASE_URL. Each file runs inside its own transaction and is recorded in
// schema_migrations with a checksum, so it is applied exactly once.
//
//   npm run db:migrate            apply pending migrations
//   npm run db:migrate -- --status list applied / pending migrations

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, neonConfig } from "@neondatabase/serverless";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
for (const file of [".env.local", ".env"]) {
  const path = join(root, file);
  if (existsSync(path)) process.loadEnvFile(path);
}

let url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não definida. Copie .env.example para .env.local e preencha a string de conexão do Neon.");
  process.exit(1);
}
// Migrations use a session-level advisory lock, which needs a direct
// connection: Neon's "-pooler" endpoint is transaction-pooled.
url = url.replace(/(@[^/@]*?)-pooler\./, "$1.");

// Optional: local Postgres behind Neon's wsproxy (development/testing only).
if (process.env.NEON_LOCAL_WSPROXY) {
  neonConfig.wsProxy = () => process.env.NEON_LOCAL_WSPROXY;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
  neonConfig.pipelineConnect = false;
}

const migrationsDir = join(root, "migrations");
const files = readdirSync(migrationsDir)
  .filter((f) => /^\d{4}_[\w-]+\.sql$/.test(f))
  .sort();

const pool = new Pool({ connectionString: url });
const client = await pool.connect();
const statusOnly = process.argv.includes("--status");

try {
  await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    checksum   TEXT NOT NULL,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
  )`);
  // Prevent two concurrent runs from applying the same migration.
  await client.query("SELECT pg_advisory_lock(727274)");

  const { rows } = await client.query("SELECT version, checksum FROM schema_migrations");
  const applied = new Map(rows.map((r) => [r.version, r.checksum]));

  let count = 0;
  for (const file of files) {
    const sql = readFileSync(join(migrationsDir, file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const version = file.replace(/\.sql$/, "");

    if (applied.has(version)) {
      if (applied.get(version) !== checksum) {
        console.warn(`⚠  ${version}: o arquivo foi alterado depois de aplicado. Crie uma nova migration em vez de editar esta.`);
      } else if (statusOnly) {
        console.log(`✓  ${version}`);
      }
      continue;
    }
    if (statusOnly) {
      console.log(`·  ${version} (pendente)`);
      continue;
    }

    process.stdout.write(`→  aplicando ${version} … `);
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)", [version, checksum]);
      await client.query("COMMIT");
      count += 1;
      console.log("ok");
    } catch (error) {
      await client.query("ROLLBACK");
      console.log("falhou");
      throw error;
    }
  }
  if (!statusOnly) console.log(count ? `${count} migration(s) aplicada(s).` : "Banco já está atualizado.");
} catch (error) {
  console.error("Erro ao executar migrations:", error instanceof Error ? error.message : error);
  process.exitCode = 1;
} finally {
  await client.query("SELECT pg_advisory_unlock(727274)").catch(() => {});
  client.release();
  await pool.end();
}
