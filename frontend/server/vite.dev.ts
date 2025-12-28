// server/vite.dev.ts
import type { Express } from "express";
import type { Server } from "http";
import { log } from './vite'; // Import log from the main vite.ts

// Vite dev server setup
export async function setupVite(app: Express, server: Server) {
  log("Attempting to set up Vite Dev Server...", "vite-dev-setup"); // Changed log source

  // --- DYNAMICALLY IMPORT VITE AND its config HERE ---
  let createViteServer: typeof import('vite').createServer;
  let viteLogger: import('vite').Logger;
  let viteConfig: import('vite').InlineConfig;

  try {
    const viteModule = await import('vite'); // Import vite itself
    createViteServer = viteModule.createServer;
    viteLogger = viteModule.createLogger();
    log("Successfully imported Vite module.", "vite-dev-setup");

    // Dynamically import the config file
    // Adjust path relative to THIS file (vite.dev.ts)
    const configModule = await import('../vite.config');
    viteConfig = configModule.default;
    log("Successfully imported Vite config dynamically.", "vite-dev-setup");

  } catch (err) {
    log(`FATAL: Failed to dynamically import 'vite' OR '../vite.config'. Error: ${err}`, "vite-dev-setup");
    console.error(err);
    process.exit(1);
  }
  // --- End Dynamic Imports ---

  const serverOptions: import('vite').ServerOptions = {
    middlewareMode: true,
    hmr: { server },
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  log("Vite server instance created.", "vite-dev-setup");
  app.use(vite.middlewares);
  log("Vite middlewares attached.", "vite-dev-setup");

  // Serve index.html for all non-API routes
  app.get(/^(?!\/api).*/, async (req, res, next) => {
    // Skip API routes
    if (req.originalUrl.startsWith('/api')) {
      return next();
    }

    try {
      const fs = await import('fs');
      const path = await import('path');
      const url = req.originalUrl;

      // Read and transform index.html
      const indexPath = path.resolve(process.cwd(), 'client', 'index.html');
      let template = fs.readFileSync(indexPath, 'utf-8');
      template = await vite.transformIndexHtml(url, template);

      res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
    } catch (e: any) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
  log("Vite HTML serving configured.", "vite-dev-setup");
}