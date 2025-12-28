/**
 * Environment variable configuration for the server
 * Self-hosted open-source version
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables from .env file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '.env') });

// Export the environment variables
export const env = {
  PORT: parseInt(process.env.PORT || '3000', 10),

  // OpenAI API Key (required for AI features)
  OPENAI_API_KEY: process.env.OPENAI_API_KEY!,

  // Semantic Scholar API Key (optional - increases rate limits)
  SERVER_SEMANTIC_SCHOLAR_API_KEY: process.env.SERVER_SEMANTIC_SCHOLAR_API_KEY,
};

// Validate required environment variables
if (!env.OPENAI_API_KEY) {
  console.error('CRITICAL ERROR: OPENAI_API_KEY is not set. AI features will not work.');
  process.exit(1);
}
