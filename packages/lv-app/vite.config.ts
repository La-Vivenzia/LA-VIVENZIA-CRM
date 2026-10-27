import path from 'node:path';

import react from '@vitejs/plugin-react-swc';
import { defineConfig } from 'vite';

// The La Vivenzia application. It is deliberately not part of the yarn
// workspace list. Locally it can resolve react, vite and the router from the
// repository root; its own package.json and package-lock.json pin the same
// versions so Railway can build it alone with packages/lv-app as the root.
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
