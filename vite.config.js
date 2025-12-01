import { defineConfig } from 'vite';

export default defineConfig({
  base: '/portfolio/',
  root: 'src',
  publicDir: '../public',
  server: {
    port: 3000,
    open: true,
    watch: {
      // Watch for changes in public directory
      usePolling: false,
      ignored: ['**/node_modules/**', '**/dist/**']
    }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: 'terser',
    rollupOptions: {
      input: {
        main: './src/index.html'
      }
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "base/_variables.scss"; @import "base/_mixins.scss";`
      }
    }
  }
});
