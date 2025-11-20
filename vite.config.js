import { defineConfig } from 'vite';

export default defineConfig({
  root: 'src',
  publicDir: '../public',
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: true,
    minify: 'terser',
    rollupOptions: {
      input: {
        main: './src/index.html'  // Specify entry point
      }
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@import "./styles/_variables.scss";`  // Fixed path
      }
    }
  }
});
