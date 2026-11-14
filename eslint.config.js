// ESLint flat config: TypeScript-aware, browser + node globals, Prettier handles formatting.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'coverage/**', 'test-results/**', 'playwright-report/**', '.cache/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node, ...globals.serviceworker } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // tests poke at window.__binsight
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-empty-pattern': 'off', // Playwright fixtures use ({}, testInfo)
    },
  },
);
