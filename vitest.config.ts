import path from 'path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom でブラウザ環境をエミュレート
    environment: 'jsdom',

    // describe / it / expect をグローバルで使用可能に
    globals: true,

    // 各テスト実行前のセットアップ
    setupFiles: [path.resolve(__dirname, './tests/setup.ts')],

    // テスト対象ファイルパターン
    include: ['**/*.{test,spec}.{ts,tsx}'],
    exclude: ['node_modules/**', '.next/**', 'dist/**', 'issue-*/**'],

    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 80,
        statements: 80,
      },
    },

    // 各テスト後にモックをリセット
    clearMocks: true,
    restoreMocks: true,

    // タイムアウト設定
    testTimeout: 10000,
    hookTimeout: 10000,
  },

  resolve: {
    // Next.js の @ エイリアスに合わせる
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})