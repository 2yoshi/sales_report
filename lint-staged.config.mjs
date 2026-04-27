import path from 'path'

// Next.js の next lint は --file オプションでステージ済みファイルのみ検査できる
const buildEslintCommand = (filenames) =>
  `next lint --fix --file ${filenames
    .map((f) => path.relative(process.cwd(), f))
    .join(' --file ')}`

/** @type {import('lint-staged').Configuration} */
export default {
  // TypeScript / TSX: ESLint 自動修正 + 型チェック
  '**/*.{ts,tsx}': [buildEslintCommand, () => 'tsc -p tsconfig.json --noEmit'],

  // JS / JSX: ESLint 自動修正のみ
  '**/*.{js,jsx,mjs}': [buildEslintCommand],
}