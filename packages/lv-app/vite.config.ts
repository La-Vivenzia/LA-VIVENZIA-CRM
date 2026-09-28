import path from 'node:path';

import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

// The La Vivenzia application. It is deliberately not part of the yarn
// workspace list: it resolves react, vite and the router from the repository
// root, so it adds no install step while the interface is being built.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { src: path.resolve(__dirname, './src') },
  },
  server: {
    port: 3200,
    strictPort: true,
  },
});
