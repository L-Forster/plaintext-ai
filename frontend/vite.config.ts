import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import themePlugin from "@replit/vite-plugin-shadcn-theme-json";
import { fileURLToPath } from 'url';
import * as path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env variables
const env = loadEnv('', process.cwd(), '');

const pythonBackendUrl = env.PYTHON_BACKEND_URL || 'http://localhost:5000';

// console.log(`[vite.config.ts] Python backend proxy target: ${pythonBackendUrl}`);

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    // themePlugin() // Temporarily commented out
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@shared": path.resolve(__dirname, "./shared"),
      "@assets": path.resolve(__dirname, "./attached_assets"),
    },
  },
  root: path.resolve(__dirname, "./client"),
  build: {
    outDir: path.resolve(__dirname, "./dist/public"),
    emptyOutDir: true,
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    proxy: {
      // Proxy requests for user, papers, search, subscription to the Node.js backend
      '/user': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false, // Keep false for localhost HTTP
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Vite proxy error:', err);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Vite proxyRes:', proxyRes.statusCode, req.url);
          });
        }
      },
      '/papers': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Vite proxy error:', err);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Vite proxyRes:', proxyRes.statusCode, req.url);
          });
        }
      },
      '/search': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Vite proxy error:', err);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Vite proxyRes:', proxyRes.statusCode, req.url);
          });
        }
      },
      // Add proxy for semantic-scholar
      '/semantic-scholar': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Vite proxy error:', err);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Vite proxyRes:', proxyRes.statusCode, req.url);
          });
        }
      },
      // Proxy for all other /api routes to the Node.js backend
      '/api': {
        target: 'http://127.0.0.1:3000', // Node.js backend
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Vite proxy error (/api):', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Vite proxyReq (/api):', req.method, req.url);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('Vite proxyRes (/api):', proxyRes.statusCode, req.url);
            // You can also log headers here if needed
            // console.log('Vite proxyRes headers (/api):', proxyRes.headers);
          });
        }
      }
      // Removed the old '/api' proxy to pythonBackendUrl unless needed for something else
      // '/api': {
      //   target: pythonBackendUrl,
      //   changeOrigin: true,
      //   secure: false,
      //   rewrite: (path) => path.replace(/^\/api/, ''),
      // }
    }
  }
});
