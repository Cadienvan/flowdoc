import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules',
      'dist',
      'out'
    ]
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      'no-console': 'warn',
      'no-debugger': 'error',
      'no-var': 'error',
      'no-unused-vars': 'off',
      "@typescript-eslint/no-unused-vars": "warn",
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-types': 'off',
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
    }
  }
);
