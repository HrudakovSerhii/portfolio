# Development Server Setup

## Overview
The development server now includes auto-restart functionality for improved developer experience.

## Commands

### Development Mode (Recommended)
```bash
npm run dev
```
This command:
1. Builds the project
2. Starts file watchers for SCSS and HTML
3. Starts the server with auto-restart on file changes

### Serve Only (with auto-restart)
```bash
npm run serve
```
- Uses nodemon to watch `dist/` directory
- Auto-restarts server when files change
- Logs requests in development mode
- Graceful shutdown on CTRL+C

### Production Mode
```bash
npm run serve:prod
```
- Runs server without nodemon
- No auto-restart
- Minimal logging
- Use for production deployments

### Legacy Mode
```bash
npm run serve:legacy
```
- Uses live-server (old method)
- Kept for backward compatibility

## Configuration

### nodemon.json
Controls auto-restart behavior:
- **watch**: Monitors `dist/` directory
- **ext**: Watches `.html`, `.css`, `.js`, `.json` files
- **delay**: 500ms delay before restart (prevents multiple restarts)
- **ignore**: Excludes `node_modules`, `test`, `.git`

### server.js Features
- **WebGPU Support**: Required headers for ML workers
- **Security Headers**: X-Content-Type-Options, X-Frame-Options, X-XSS-Protection
- **Request Logging**: Logs all requests in dev mode
- **Graceful Shutdown**: Handles SIGTERM and SIGINT signals
- **SPA Routing**: Serves index.html for all routes

## Workflow

### Typical Development Flow
1. Start dev server: `npm run dev`
2. Edit source files in `src/`
3. Watch scripts automatically rebuild to `dist/`
4. Server auto-restarts when `dist/` changes
5. Refresh browser to see changes

### File Change Flow
```
src/ files → watch scripts → dist/ files → nodemon detects → server restarts
```

## Benefits
- ✅ No manual server restarts
- ✅ Fast feedback loop
- ✅ Automatic rebuild and reload
- ✅ Clean console output
- ✅ Graceful shutdown handling

## Troubleshooting

### Server not restarting?
- Check nodemon.json configuration
- Ensure files are being written to `dist/`
- Look for nodemon logs in console

### Too many restarts?
- Increase delay in nodemon.json
- Check if watch scripts are triggering multiple builds

### Port already in use?
- Change PORT environment variable: `PORT=3001 npm run serve`
- Kill existing process: `lsof -ti:3000 | xargs kill`
