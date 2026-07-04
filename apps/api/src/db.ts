import { readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgres://combackhome:change_me@localhost:5432/combackhome",
});

// 간단한 쿼리 헬퍼
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: unknown[]
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as never);
}

/**
 * migrations 폴더의 *.sql 파일을 이름순으로 적용.
 * 이미 적용된 파일은 schema_migrations 로 추적해 스킵.
 */
export async function migrate(): Promise<void> {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const dir = join(__dirname, "migrations");

  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name       text PRIMARY KEY,
      applied_at timestamptz DEFAULT now()
    );
  `);

  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql")).sort();

  for (const file of files) {
    const done = await query(`SELECT 1 FROM schema_migrations WHERE name = $1`, [
      file,
    ]);
    if ((done.rowCount ?? 0) > 0) continue;

    const sql = await readFile(join(dir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query(`INSERT INTO schema_migrations (name) VALUES ($1)`, [
        file,
      ]);
      await client.query("COMMIT");
      console.log(`[migrate] applied ${file}`);
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`[migrate] failed ${file}`, err);
      throw err;
    } finally {
      client.release();
    }
  }
}
