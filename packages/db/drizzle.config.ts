import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/schema.ts',
  out: './drizzle',
  // Only the commands that talk to a database read this; `generate` does not.
  dbCredentials: { url: process.env.DATABASE_URL ?? 'postgres://localhost:5432/jobbdjungeln' },
  casing: 'snake_case',
  strict: true,
  verbose: true,
});
