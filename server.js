/**
 * Simple development server with WebGPU support
 * Adds necessary headers for WebGPU functionality
 * Auto-restarts on file changes when using nodemon
 */

import express from 'express';
import { join, dirname } from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isDev = process.env.NODE_ENV !== 'production';

// WebGPU requires Cross-Origin Isolation
app.use((req, res, next) => {
  // Enable Cross-Origin Isolation for WebGPU
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Log requests in dev mode
  if (isDev) {
    console.log(`${new Date().toLocaleTimeString()} - ${req.method} ${req.url}`);
  }

  next();
});

// Serve static files from dist directory
app.use(express.static(join(__dirname, 'dist')));

// Handle SPA routing - serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

const server = app.listen(PORT, () => {
  console.log(`\n🚀 Server running at http://localhost:${PORT}`);
  console.log(`📱 WebGPU headers enabled for ML worker support`);
  if (isDev) {
    console.log(`👀 Watching for file changes (auto-restart enabled)`);
  }
  console.log(`\n✨ Ready to serve!\n`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n👋 SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('\n👋 SIGINT received, shutting down gracefully...');
  server.close(() => {
    console.log('✅ Server closed');
    process.exit(0);
  });
});
