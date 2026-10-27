import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/**
 * Regla de dependencias (de abajo hacia arriba):
 *   shared  →  data  →  maps  →  features  →  app
 * Cada capa solo importa de las anteriores. Las funcionalidades no se importan entre sí:
 * se comunican por los repositorios (*.repo) y cálculos (*.calc) públicos y por los eventos del store.
 * Los imports de solo tipos están permitidos en cualquier dirección.
 */
const layer = (files, banned, message, regex) => ({
  files,
  rules: {
    '@typescript-eslint/no-restricted-imports': [
      'error',
      {
        patterns: [
          ...(banned.length ? [{ group: banned, message, allowTypeImports: true }] : []),
          ...(regex ? [{ regex, message, allowTypeImports: true }] : []),
        ],
      },
    ],
  },
});

export default tseslint.config(
  {
    ignores: ['tools', 'dist', 'node_modules', 'test-results', 'playwright-report'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      'no-empty': ['error', { allowEmptyCatch: true }],
      '@typescript-eslint/no-unused-vars': ['error', { args: 'none', caughtErrors: 'none' }],
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  layer(
    ['src/shared/**/*.ts'],
    ['@/data/**', '@/maps/**', '@/features/**', '@/app/**'],
    'shared no depende de data, maps, features ni app.',
  ),
  layer(
    ['src/data/**/*.ts'],
    ['@/maps/**', '@/features/**', '@/app/**'],
    'data solo depende de shared.',
  ),
  layer(['src/maps/**/*.ts'], ['@/features/**', '@/app/**'], 'maps solo depende de shared y data.'),
  layer(
    ['src/features/**/*.ts'],
    ['@/app/**'],
    'Una funcionalidad no importa a otra: usa su repositorio (*.repo) o su cálculo (*.calc), o los eventos del store.',
    '^@/features/[^/]+/(?![^/]*[.](repo|calc)$)',
  ),
  prettier,
);
