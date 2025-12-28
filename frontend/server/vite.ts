// server/vite.ts - Utilities for Express server
import express, { type Express } from "express";
import path from 'path';

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}

// Serve static files for built frontend
export function serveStatic(app: Express) {
  log("Setting up static file serving...");
  const publicDistPath = path.resolve(process.cwd(), 'dist', 'public');

  log(`Serving static files from directory: ${publicDistPath}`);

  app.use(express.static(publicDistPath, { index: false }));
  log(`Express static middleware configured for ${publicDistPath}`);

  // SPA Fallback: always serve index.html for unmatched routes
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(publicDistPath, 'index.html'));
  });
  log("SPA fallback configured.");
}