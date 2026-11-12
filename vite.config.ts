import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Project site: https://<user>.github.io/computer-sim/
export default defineConfig({
  base: '/computer-sim/',
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1300,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
