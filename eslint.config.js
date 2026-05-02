import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: [
      'node_modules/**',
      'backend/node_modules/**',
      'cypress/screenshots/**',
      'cypress/videos/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.mocha,
        L: 'readonly',
        Highcharts: 'readonly',
        moment: 'readonly',
        $: 'readonly',
        jQuery: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['cypress/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        cy: 'readonly',
        Cypress: 'readonly',
        expect: 'readonly',
      },
    },
  },
  {
    files: ['eslint.config.js', 'cypress.config.js', 'cypress/support/**/*.js', 'generate-env.js'],
    languageOptions: {
      sourceType: 'module',
    },
  },
  {
    files: ['backend/**/*.js'],
    languageOptions: {
      sourceType: 'script',
      globals: {
        ...globals.node,
      },
    },
  },
];
