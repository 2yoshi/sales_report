// @ts-check

import { dirname } from 'path'
import { fileURLToPath } from 'url'
import { FlatCompat } from '@eslint/eslintrc'
import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettier from 'eslint-config-prettier'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const compat = new FlatCompat({ baseDirectory: __dirname })

export default tseslint.config(
  // Next.js 推奨ルール（Core Web Vitals + TypeScript）
  ...compat.extends('next/core-web-vitals', 'next/typescript'),

  // JS 推奨ルール
  js.configs.recommended,

  // TypeScript ESLint 推奨ルール
  ...tseslint.configs.recommended,

  {
    rules: {
      // 未使用変数は _ プレフィックスで許可
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // any の使用を警告（エラーにしない）
      '@typescript-eslint/no-explicit-any': 'warn',
      // console.log を警告（console.error/warn は許可）
      'no-console': ['warn', { allow: ['error', 'warn'] }],
    },
  },

  {
    // テストファイルはルールを緩和
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },

  {
    ignores: ['.next/**', 'node_modules/**', 'dist/**'],
  },

  // Prettier と競合するルールを無効化（必ず最後に配置）
  prettier,
)