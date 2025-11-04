import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Custom plugin to modify CSP headers
function cspHeaders() {
  return {
    name: 'csp-headers',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        // Set the proper CSP header without conflicting 'none' directive
        res.setHeader(
          'Content-Security-Policy',
          "default-src 'self'; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval' translate.googleapis.com translate.google.com www.google.com www.gstatic.com chrome-extension://bfdogplmndidlpjfhoijckpakkdjkkil/ https://pay.lenco.co https://accounts.google.com/gsi/client https://cdn.tailwindcss.com; " +
          "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com https://accounts.google.com; " +
          "font-src 'self' https://fonts.gstatic.com; " +
          "img-src 'self' data: https:; " +
          "connect-src 'self' https: http://localhost:4000; " +
          "media-src 'self'; " +
          "frame-src 'self' https://pay.lenco.co https://accounts.google.com; " +
          "object-src 'none'; " +
          "base-uri 'self';"
        );
        next();
      });
    },
  };
}

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:4000',
            changeOrigin: true,
            secure: false,
          },
        },
      },
      build: {
        outDir: 'dist',
        sourcemap: false,
        minify: 'esbuild',
        rollupOptions: {
          output: {
            assetFileNames: (assetInfo) => {
              let extType = assetInfo.name.split('.').at(1);
              if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(extType)) {
                extType = 'img';
              }
              return `assets/${extType}/[name]-[hash][extname]`;
            },
            chunkFileNames: 'assets/js/[name]-[hash].js',
            entryFileNames: 'assets/js/[name]-[hash].js',
          }
        }
      },
      plugins: [react(), cspHeaders()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
