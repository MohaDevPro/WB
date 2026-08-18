import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/.next/**', '**/coverage/**', '**/dist/**', '**/node_modules/**'],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          fixStyle: 'separate-type-imports',
          prefer: 'type-imports',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
