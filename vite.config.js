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
    sourcemap: false,
    minify: 'terser',
    assetsInlineLimit: 4096,
    reportCompressedSize: false,
    rollupOptions: {
      input: {
        main: './src/index.html'
      },
      output: {
        entryFileNames: '[name].[hash].js',
        chunkFileNames: '[name].[hash].js',
        assetFileNames: '[name].[hash][extname]'
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
