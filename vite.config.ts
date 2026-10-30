import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig, Plugin } from 'vite';

function apiMiddlewarePlugin(): Plugin {
  return {
    name: 'api-server-middleware',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url && req.url.startsWith('/api')) {
          try {
            const anyRes = res as any;
            if (!anyRes.status) {
              anyRes.status = function (code: number) {
                anyRes.statusCode = code;
                return anyRes;
              };
            }
            if (!anyRes.json) {
              anyRes.json = function (data: any) {
                if (!anyRes.headersSent) {
                  anyRes.setHeader('Content-Type', 'application/json');
                }
                anyRes.end(JSON.stringify(data));
                return anyRes;
              };
            }

            const appModule = await import('./api/index.ts');
            const app = appModule.default;
            app(req as any, anyRes, next);
          } catch (err) {
            console.error('API Middleware error:', err);
            res.statusCode = 500;
            res.end(JSON.stringify({ error: 'Internal API Server Error' }));
          }
        } else {
          next();
        }
      });
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), apiMiddlewarePlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
