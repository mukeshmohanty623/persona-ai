import { createClient } from "@libsql/client";

const DAILY_LIMIT = parseInt(
  process.env.RATE_LIMIT_PER_DAY ?? import.meta.env.RATE_LIMIT_PER_DAY ?? "20",
  10,
);

// Lazily initialised — one client per process lifetime (warm instances reuse it)
let db: ReturnType<typeof createClient> | null = null;

function getDb() {
  if (db) return db;

  const url = process.env.TURSO_DATABASE_URL ?? import.meta.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN ?? import.meta.env.TURSO_AUTH_TOKEN;

  if (!url) {
    throw new Error("TURSO_DATABASE_URL is not configured.");
  }

  db = createClient({ url, authToken });
  return db;
}

async function ensureTable(client: ReturnType<typeof createClient>) {
  await client.execute(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      ip    TEXT NOT NULL,
      date  TEXT NOT NULL,
      count INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (ip, date)
    )
  `);
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  limit: number;
}

/**
 * Check and increment the rate limit counter for the given IP.
 * Returns { allowed, remaining, limit }.
 */
export async function checkRateLimit(ip: string): Promise<RateLimitResult> {
  const client = getDb();
  await ensureTable(client);

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC

  // Upsert: insert or increment
  await client.execute({
    sql: `
      INSERT INTO rate_limits (ip, date, count)
      VALUES (?, ?, 1)
      ON CONFLICT (ip, date)
      DO UPDATE SET count = count + 1
    `,
    args: [ip, today],
  });

  const row = await client.execute({
    sql: `SELECT count FROM rate_limits WHERE ip = ? AND date = ?`,
    args: [ip, today],
  });

  const count = Number(row.rows[0]?.count ?? 1);
  const allowed = count <= DAILY_LIMIT;
  const remaining = Math.max(0, DAILY_LIMIT - count);

  return { allowed, remaining, limit: DAILY_LIMIT };
}
