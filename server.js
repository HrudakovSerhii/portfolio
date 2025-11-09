/**
 * Simple development server with WebGPU support
 * Adds necessary headers for WebGPU functionality
 */

import express from 'express';
import { join, dirname } from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// WebGPU requires Cross-Origin Isolation
app.use((req, res, next) => {
  // Enable Cross-Origin Isolation for WebGPU
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');

  // Additional security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  next();
});

// Serve static files from dist directory
app.use(express.static(join(__dirname, 'dist')));

// Handle SPA routing - serve index.html for all routes
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
  console.log(`📱 WebGPU headers enabled for ML worker support`);
});
