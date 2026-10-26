import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'test-results', 'playwright-report', 'trayecto.html'] },
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
  {
    // Módulos JavaScript de la fase 2; se convierten a TypeScript en la fase 3.
    files: ['src/**/*.js'],
    languageOptions: { globals: { maplibregl: 'readonly' } },
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off',
      'no-useless-assignment': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  prettier,
);
