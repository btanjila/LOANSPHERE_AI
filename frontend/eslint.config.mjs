import js from '@eslint/js';
import reactRecommended from 'eslint-plugin-react/configs/recommended.js';
import globals from 'globals';
import jestPlugin from 'eslint-plugin-jest';

export default [
  js.configs.recommended,
  {
    ...reactRecommended,
    settings: {
      react: {
        version: '18.2.0' // Set your React version
      }
    }
  },
  {
    files: ['**/*.test.js'],
    plugins: {
      jest: jestPlugin
    },
    languageOptions: {
      globals: {
        ...globals.jest
      }
    }
  },
  {
    rules: {
      'react/jsx-filename-extension': [1, { extensions: ['.jsx'] }],
      'react/react-in-jsx-scope': 'off'
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        process: 'readonly',
        localStorage: 'readonly',
        window: 'readonly',
        document: 'readonly'
      }
    }
  }
];