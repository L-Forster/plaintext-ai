/**
 * Environment variables utility for client-side code.
 * Vite exposes env vars prefixed with VITE_ to the client.
 * Self-hosted open-source version
 */

// API URL - defaults to same origin
export const API_URL = import.meta.env.VITE_API_URL || '';

// Semantic Scholar API Key (Optional, for higher rate limits)
export const SEMANTIC_SCHOLAR_API_KEY = import.meta.env.VITE_SEMANTIC_SCHOLAR_API_KEY;
