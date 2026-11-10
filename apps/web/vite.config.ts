import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // Vite czyta pliki .env z katalogu aplikacji (apps/web), a sekret proxy
  // trzymany jest w .env w korzeniu monorepo, skąd go biorą serwer i agent.
  const env = loadEnv(mode, '../..', '');

  return {
    plugins: [react()],
    envDir: '../..',
    server: {
      port: Number(env.WEB_PORT ?? 5173),
      strictPort: true,
    },
    preview: {
      port: Number(env.WEB_PORT ?? 5173),
    },
  };
});
