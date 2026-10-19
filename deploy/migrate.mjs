// pgcrypto es prerequisito de los uuid defaultRandom(); drizzle-kit no gestiona extensiones.
import postgres from "postgres";
import { execSync } from "node:child_process";

const sql = postgres(process.env.DATABASE_URL);
await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
await sql.end();
execSync("npx drizzle-kit migrate", { stdio: "inherit" });
