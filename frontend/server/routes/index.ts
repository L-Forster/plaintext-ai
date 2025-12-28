import { Express } from 'express';
import aiAssistantRoutes from './aiAssistantRoutes';
import { log } from '../vite';

/**
 * Registers all application routes.
 * @param app The Express application instance.
 */
export async function registerRoutes(app: Express): Promise<void> {
  log('Registering API routes...');

  // Debug log to check if aiAssistantRoutes is valid
  log(`aiAssistantRoutes is ${typeof aiAssistantRoutes === 'function' ? 'a function' :
    typeof aiAssistantRoutes === 'object' && aiAssistantRoutes !== null ? 'an object' :
      'INVALID - ' + typeof aiAssistantRoutes}`);

  if (aiAssistantRoutes) {
    // Inspect what's in the router
    log(`aiAssistantRoutes methods: ${Object.keys(aiAssistantRoutes).join(', ')}`);
  }

  // Middleware to log requests specifically before AI assistant routes
  app.use('/api', (req, res, next) => {
    log(`[RoutesIndex] Request to /api received. Path: ${req.path}, Method: ${req.method}, OriginalURL: ${req.originalUrl}`);
    next();
  });

  try {
    // Register the AI Assistant routes
    app.use('/api', aiAssistantRoutes); // Mounts AI routes like /api/scholar-ai-query
    log('AI Assistant routes registered under /api.');

    // Log available routes
    log('Available API endpoints:');
    log('- POST /api/scholar-ai-query - LLM-assisted paper search');
    log('- GET /api/available-models - Get available AI models');
    log('- POST /api/test - Test route');
    log('- POST /api/contradiction-checker - Contradiction checker');
  } catch (err) {
    log(`ERROR registering API routes: ${err}`);
  }


  // Catch-all for unhandled API routes (optional, good for debugging)
  app.use(/\/api\/.*/, (req, res) => {
    log(`[API Catch-all 404] Path not found in /api routes: ${req.method} ${req.originalUrl}`); // More specific log
    res.status(404).json({
      source: 'api_catch_all_404_handler',
      message: 'API endpoint not found within /api routing structure.',
      path: req.originalUrl
    });
  });

  log('Route registration complete.');
} 