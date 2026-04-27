# 営業日報システム (Sales Daily Report System)

営業担当者の日次報告を管理する Web アプリケーションです。

## 技術スタック

| 項目 | 技術 |
|------|------|
| 言語 | TypeScript |
| フレームワーク | Next.js 15 (App Router) |
| UI コンポーネント | shadcn/ui + Tailwind CSS v4 |
| DB スキーマ | Prisma + PostgreSQL |
| API スキーマ検証 | Zod |
| テスト | Vitest + Testing Library |
| デプロイ | Google Cloud Run |

## 前提条件

- Node.js 20 以上
- Docker / Docker Compose
- （ローカル実行の場合）PostgreSQL 16

## セットアップ

### 1. リポジトリのクローン

```bash
git clone https://github.com/2yoshi/sales_report.git
cd sales_report
```

### 2. 環境変数の設定

```bash
cp .env.example .env
# .env を編集して各値を設定
```

### 3. Docker Compose で起動（推奨）

```bash
# 依存パッケージのインストール & 開発サーバー起動
make dev
```

初回は Docker イメージのビルドが行われます。

### 4. ローカル直接実行（任意）

```bash
npm install
npx prisma migrate dev
npm run dev
```

ブラウザで [http://localhost:3000](http://localhost:3000) を開きます。

## 開発コマンド

```bash
# 開発サーバー起動
npm run dev

# ビルド
npm run build

# テスト（ウォッチモード）
npm run test

# テスト（単発実行）
npm run test:run

# カバレッジ計測
npm run test:coverage

# Lint
npm run lint

# フォーマット
npm run format
```

## データベース操作

```bash
# マイグレーション実行（開発）
npx prisma migrate dev

# スキーマ変更を反映（本番）
npx prisma migrate deploy

# Prisma Studio 起動
npx prisma studio

# クライアント生成
npx prisma generate
```

Make コマンド経由（Docker Compose 内で実行）:

```bash
make migrate       # マイグレーション
make studio        # Prisma Studio
make test          # テスト
make coverage      # カバレッジ
```

## プロジェクト構成

```
sales_report/
├── src/
│   ├── app/           # Next.js App Router
│   │   ├── layout.tsx
│   │   ├── page.tsx
│   │   └── globals.css
│   ├── components/
│   │   └── ui/        # shadcn/ui コンポーネント
│   ├── lib/
│   │   ├── prisma.ts  # Prisma クライアント（シングルトン）
│   │   └── utils.ts   # ユーティリティ関数
│   ├── hooks/         # カスタム React Hooks
│   └── types/         # 型定義
├── prisma/
│   ├── schema.prisma  # DB スキーマ
│   └── migrations/    # マイグレーションファイル
├── tests/
│   └── setup.ts       # テストセットアップ
├── doc/               # 仕様書
├── .env.example       # 環境変数サンプル
├── components.json    # shadcn/ui 設定
├── docker-compose.yml
├── Dockerfile
└── Makefile
```

## shadcn/ui コンポーネントの追加

```bash
npx shadcn@latest add button
npx shadcn@latest add input
npx shadcn@latest add form
# など
```

## ロール

| ロール | 権限概要 |
|--------|---------|
| `sales` | 自分の日報の作成・編集・削除 |
| `manager` | 全日報の閲覧・コメント投稿 |
| `admin` | 全操作（ユーザー管理・顧客削除含む） |

## 環境変数

| 変数名 | 説明 |
|--------|------|
| `DATABASE_URL` | PostgreSQL 接続文字列 |
| `JWT_SECRET` | JWT 署名シークレット（**本番環境では必ず強いランダム文字列に変更**） |
| `JWT_EXPIRES_IN` | JWT 有効期限（秒）デフォルト: `86400` |
| `NEXT_PUBLIC_API_BASE_URL` | API ベース URL |
