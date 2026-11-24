import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";

const url = process.env.DATABASE_URL ?? "postgres://kumo:kumo@localhost:5432/kumo";

const g = globalThis as unknown as { __kumoSql?: ReturnType<typeof postgres> };
// Single pool per process; serverless-friendly (Neon pooled URL, prepare=false).
export const sqlClient = g.__kumoSql ?? postgres(url, { max: 5, prepare: false });
if (process.env.NODE_ENV !== "production") g.__kumoSql = sqlClient;

export const db = drizzle(sqlClient, { schema });
export type DB = typeof db;
export { schema };
