// server/index.ts - Self-hosted open-source version
import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import { createServer } from 'http';
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./vite";
import { env } from "./env";
import cors from 'cors';
import compression from 'compression';
// @ts-ignore: missing types for cookie-parser
import cookieParser from 'cookie-parser';

const app = express();

// Enable Gzip/Brotli compression for all responses
app.use(compression());
app.use(cookieParser());

// Helper to set Cache-Control headers
function cacheControl(maxAgeSeconds: number) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.set('Cache-Control', `public, max-age=${maxAgeSeconds}`);
    next();
  };
}

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// --- CORS Configuration - Allow all origins for self-hosted ---
const corsOptions: cors.CorsOptions = {
  origin: true, // Allow all origins
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  credentials: true,
  maxAge: 86400,
};

log('Configuring CORS to allow all origins for self-hosted deployment.');
app.use(cors(corsOptions));

// --- Main Application Setup ---
(async () => {
  const server = createServer(app);

  log("Registering application API routes...");

  // Test routes
  app.post('/api/test-direct-route', (req, res) => {
    res.json({ success: true, message: "Direct test route reached successfully!" });
  });

  app.post('/api/test-like-ai-route', (req, res) => {
    res.json({
      llmResponseText: "This is a test response mimicking the AI route response format",
      papers: [],
      success: true
    });
  });

  await registerRoutes(app);
  log("Application routes registered.");

  // Apply caching middleware
  app.use('/papers', cacheControl(300));
  app.use('/papers/:id', cacheControl(300));
  app.use('/papers/:id/connections', cacheControl(300));
  app.use('/search', cacheControl(60));
  app.use('/semantic-scholar/search', cacheControl(900));

  // --- Vite Dev Server setup ---
  log('Setting up Vite server...');
  try {
    const { setupVite } = await import("./vite.dev");
    await setupVite(app, server);
    log('Vite middleware setup complete.');
  } catch (e) {
    log(`ERROR setting up Vite: ${e}`);
    console.error(e);
    // Fallback to static serving if Vite fails
    serveStatic(app);
  }

  // --- Global Error Handler ---
  app.use((err: any, req: Request, res: Response, next: NextFunction) => {
    log(`ERROR: ${err.status || 500} - ${err.message} - ${req.originalUrl} - ${req.method} - ${req.ip}`);
    console.error(err.stack);
    const status = err.status || 500;
    res.status(status).json({
      message: err.message,
      stack: err.stack
    });
  });

  // --- Start the Server ---
  const PORT = env.PORT || 3000;
  server.listen(PORT, () => {
    log(`Server listening on http://localhost:${PORT}`);
  });

})();