import { config as loadEnv } from "dotenv";
loadEnv(); // Load environment variables from .env

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from "@shared/schema";

// Check for required DATABASE_URL
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create PostgreSQL connection and initialize Drizzle ORM
const client = postgres(process.env.DATABASE_URL!, {
  ssl: process.env.NODE_ENV === 'production' 
    ? { rejectUnauthorized: false } // For managed databases like RDS/Neon
    : 'prefer', // Use SSL if available in development
  max: 20,
  idle_timeout: 30,
  max_lifetime: 60 * 30,
});
export const db = drizzle(client, { schema });
