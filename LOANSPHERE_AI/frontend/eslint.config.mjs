// eslint.config.mjs
import js from '@eslint/js';
import reactRecommended from 'eslint-plugin-react/configs/recommended.js';

export default [
  js.configs.recommended,
  reactRecommended,
  {
    rules: {
      'react/jsx-filename-extension': [1, { extensions: ['.jsx'] }],
      'react/react-in-jsx-scope': 'off'
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module'
    }
  }
];
