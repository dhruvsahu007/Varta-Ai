import { config as loadEnv } from "dotenv";
loadEnv(); // Load environment variables from .env

import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import * as schema from "@shared/schema";

// Check for required DATABASE_URL
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create SQLite connection and initialize Drizzle ORM
const sqlite = new Database(process.env.DATABASE_URL.replace('file:', ''));
export const db = drizzle(sqlite, { schema });
