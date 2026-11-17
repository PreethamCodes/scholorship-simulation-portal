import {Client, Pool, type PoolClient} from "pg";

const SETUP = "SET search_path = scholarship, pg_catalog; SET statement_timeout = 12000";

/**
 * A connection that is configured before the pool hands it out. The settings are sent as a query rather than as
 * start-up options because pooled hosted databases (for example Supabase's pooler) can reject start-up options.
 */
class ScholarshipClient extends Client {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  connect(callback?: any): any {
    if (!callback) return super.connect().then(() => this.query(SETUP)).then(() => undefined);
    super.connect((error?: Error) => {
      if (error) return callback(error);
      this.query(SETUP, (setupError?: Error) => callback(setupError));
    });
  }
}

const cache = globalThis as typeof globalThis & { scholarshipPool?: Pool };
export function db() {
  if (!process.env.DATABASE_URL) throw new Error("Database unavailable");
  return cache.scholarshipPool ??= new Pool({connectionString:process.env.DATABASE_URL, max:6, connectionTimeoutMillis:4000,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Client: ScholarshipClient as any});
}
export async function transaction<T>(fn:(client:PoolClient)=>Promise<T>) {
  const c=await db().connect();
  try { await c.query("BEGIN"); const result=await fn(c); await c.query("COMMIT"); return result; }
  catch(err) { await c.query("ROLLBACK"); throw err; } finally { c.release(); }
}
