import {Pool, type PoolClient} from "pg";
const cache = globalThis as typeof globalThis & { scholarshipPool?: Pool };
export function db() {
  if (!process.env.DATABASE_URL) throw new Error("Database unavailable");
  return cache.scholarshipPool ??= new Pool({connectionString:process.env.DATABASE_URL, max:6, connectionTimeoutMillis:4000,
    options:"-c search_path=scholarship,pg_catalog -c statement_timeout=12000"});
}
export async function transaction<T>(fn:(client:PoolClient)=>Promise<T>) {
  const c=await db().connect();
  try { await c.query("BEGIN"); const result=await fn(c); await c.query("COMMIT"); return result; }
  catch(err) { await c.query("ROLLBACK"); throw err; } finally { c.release(); }
}
