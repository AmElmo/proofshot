import { defineConfig } from 'vite';
import { resolve } from 'path';

/** Simple request-logging plugin so proofshot captures server activity. */
function requestLogger() {
  return {
    name: 'request-logger',
    configureServer(server) {
      console.log('[server] localhost:cafe dev server starting...');
      console.log('[server] Loading routes: /, /dashboard.html, /settings.html');
      console.log('[server] HMR websocket ready');

      server.middlewares.use((req, res, next) => {
        const start = Date.now();
        res.on('finish', () => {
          const ms = Date.now() - start;
          const status = res.statusCode;
          console.log(`[server] ${req.method} ${req.url} → ${status} (${ms}ms)`);
          if (status >= 400) {
            console.error(`[server] Error: ${req.method} ${req.url} returned ${status}`);
          }
        });
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [requestLogger()],
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
        settings: resolve(__dirname, 'settings.html'),
      },
    },
  },
});
