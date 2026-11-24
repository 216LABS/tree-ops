import postgres from 'postgres';

/**
 * Database access with postgres.js and plain SQL (docs/DECISIONS.md T-3: no ORM layer; the schema lives in migrations).
 * - db(): the server connection. It bypasses RLS, so every query through it filters by tenant explicitly.
 * - withUser(): a transaction as the signed-in user, where Postgres RLS decides what they can see and change.
 */
export type Sql = postgres.Sql<{}>;
export type Tx = postgres.TransactionSql<{}>;
export type Q = Sql | Tx;

const g = globalThis as unknown as { __treeSql?: Sql };

export function db(): Sql {
  if (!g.__treeSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    g.__treeSql = postgres(url, {
      prepare: false,
      max: Number(process.env.DB_POOL_MAX ?? 10),
      onnotice: () => {},
      transform: { undefined: null },
      types: {
        // numeric and bigint as JS numbers (money is integer cents; quantities are small); dates stay 'YYYY-MM-DD'.
        numeric: { to: 1700, from: [1700], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) },
        bigint: { to: 20, from: [20], serialize: (x: unknown) => String(x), parse: (x: string) => Number(x) },
        date: { to: 1082, from: [1082], serialize: (x: unknown) => String(x), parse: (x: string) => x },
      },
    }) as unknown as Sql;
  }
  return g.__treeSql;
}

export async function closeDb() {
  await g.__treeSql?.end({ timeout: 5 });
  g.__treeSql = undefined;
}

/** Runs `fn` as the signed-in Supabase user with RLS enforced. Office requests read and write through this. */
export async function withUser<T>(userId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return (await db().begin(async (tx) => {
    const claims = JSON.stringify({ sub: userId, role: 'authenticated' });
    await tx`select set_config('request.jwt.claims', ${claims}, true), set_config('role', 'authenticated', true)`;
    return fn(tx);
  })) as T;
}

/** A transaction on the server connection (token links, webhooks, jobs). The caller filters by tenant. */
export async function asService<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return (await db().begin((tx) => fn(tx))) as T;
}

export { postgres };
