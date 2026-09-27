import { defineConfig } from 'vite';

// In development, signaling goes to a running Relay. CAMVIEW_RELAY points at
// it, e.g. CAMVIEW_RELAY=http://10.0.0.20:3147 pnpm dev
export default defineConfig({
  server: {
    proxy: {
      '/api': process.env.CAMVIEW_RELAY ?? 'http://127.0.0.1:3147',
    },
  },
});
