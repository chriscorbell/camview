import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    server: {
      host: '0.0.0.0',
      proxy: {
        '/api': {
          changeOrigin: true,
          target: env.VITE_GO2RTC_ORIGIN ?? 'http://127.0.0.1:1984',
          ws: true,
        },
      },
    },
  };
});
