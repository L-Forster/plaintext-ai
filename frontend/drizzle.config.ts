// frontend/drizzle.config.ts
import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

// Ensure dotenv loads the .env file correctly from the 'frontend' directory
dotenv.config({ path: '.env' });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  // Throw an error during config parsing if the URL isn't set.
  // This prevents cryptic errors later in drizzle-kit.
  throw new Error("DATABASE_URL environment variable is not set or is empty.");
}

export default {
  schema: '../shared/schema.ts', // Double-check this path relative to drizzle.config.ts
  out: './drizzle',              // Migration output directory
  connectionString: connectionString,
} satisfies Config;