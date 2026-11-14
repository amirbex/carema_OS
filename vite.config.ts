import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';

export default defineConfig(() => {
  const hmrDisabled = process.env.DISABLE_HMR === 'true';

  return {
    // GitHub Pages serves the app from `/<repo>/`, so the build needs a
    // matching asset prefix. `VITE_BASE` lets CI set it without affecting
    // local dev (which keeps `/`).
    base: process.env.VITE_BASE || '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // `npm run dev` serves through Express, but these keep `vite` standalone
      // usable from a container/preview host as well.
      host: true,
      allowedHosts: true,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      hmr: !hmrDisabled,
      watch: hmrDisabled ? null : {},
    },
    preview: {
      host: true,
      allowedHosts: true,
      // `vite preview` does not mount the Express API; proxy it so the chat and
      // voice features keep working in a preview build.
      proxy: {
        '/api': { target: 'http://127.0.0.1:3000', changeOrigin: true },
        '/live': { target: 'ws://127.0.0.1:3000', ws: true },
      },
    },
    build: {
      // The original build shipped one 1.4 MB bundle; splitting the heavy
      // dependencies makes first paint noticeably faster.
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('firebase') || id.includes('@firebase')) return 'firebase';
            if (
              id.includes('react-markdown') ||
              id.includes('remark') ||
              id.includes('micromark') ||
              id.includes('mdast') ||
              id.includes('unified')
            ) {
              return 'markdown';
            }
            if (id.includes('date-fns') || id.includes('react-date-object') || id.includes('react-multi-date-picker')) {
              return 'dates';
            }
            if (id.includes('lucide-react')) return 'icons';
            if (id.includes('react-router')) return 'router';
            // Keep React and its scheduler together: splitting them produced a
            // circular vendor -> react -> vendor chunk graph.
            if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'react';
            return undefined;
          },
        },
      },
    },
  };
});
