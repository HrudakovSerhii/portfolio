import { defineConfig } from 'vite';
import { ViteMinifyPlugin } from 'vite-plugin-minify';
import purgecss from 'vite-plugin-purgecss';

export default defineConfig({
  plugins: [
    purgecss({
      content: ['./src/**/*.html', './src/**/*.js'],
      safelist: {
        standard: [/^js-/, /active/, /visible/, /hidden/, /open/, /closed/],
        deep: [/^data-/, /^section-/, /^#section-/],
        greedy: [/section/]
      }
    }),
    ViteMinifyPlugin({
      collapseWhitespace: true,
      removeComments: true,
      removeRedundantAttributes: true,
      removeScriptTypeAttributes: true,
      removeStyleLinkTypeAttributes: true,
      minifyCSS: true,
      minifyJS: true
    })
  ],
  base: '',
  root: 'src',
  publicDir: '../public',
  server: {
    port: 4000,
    open: true,
    watch: {
      usePolling: false,
      ignored: ['**/node_modules/**', '**/dist/**']
    }
  },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false,
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info', 'console.debug']
      },
      mangle: true,
      format: {
        comments: false
      }
    },
    assetsInlineLimit: 4096,
    reportCompressedSize: false,
    cssMinify: 'lightningcss',
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
        additionalData: `@use "sass:math"; @use "base/variables" as *; @use "base/mixins" as *;`
      }
    }
  }
});
