import type { Plugin } from 'vite';
import { defineConfig } from 'vitest/config';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { existsSync, renameSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** El HTML construido se llama trayecto.html (el de entrada del proyecto es index.html). */
function renameOutput(): Plugin {
  let outDir = 'dist';
  return {
    name: 'trayecto-rename-output',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir);
    },
    closeBundle() {
      const from = resolve(outDir, 'index.html');
      if (existsSync(from)) renameSync(from, resolve(outDir, 'trayecto.html'));
    },
  };
}

export default defineConfig({
  plugins: [viteSingleFile(), renameOutput()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    emptyOutDir: true,
    chunkSizeWarningLimit: 4000,
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
  },
});
