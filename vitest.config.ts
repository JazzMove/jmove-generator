import { defineConfig } from 'vitest/config';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'));

export default defineConfig({
  define: {
    __GENERATOR_VERSION__: JSON.stringify(pkg.version),
  },
  test: {
    globals: true,
    include: ['tests/**/*.test.ts'],
  },
});
