# 営業日報システム API仕様書

**バージョン:** 1.0  
**作成日:** 2026-04-19  
**ベースURL:** `https://api.example.com/v1`  
**フォーマット:** JSON  
**文字コード:** UTF-8

---

## 目次

1. [共通仕様](#1-共通仕様)
2. [認証 API](#2-認証-api)
3. [日報 API](#3-日報-api)
4. [訪問記録 API](#4-訪問記録-api)
5. [コメント API](#5-コメント-api)
6. [顧客マスタ API](#6-顧客マスタ-api)
7. [ユーザー API](#7-ユーザー-api)
8. [エラーコード一覧](#8-エラーコード一覧)

---

## 1. 共通仕様

### 認証方式

JWT（JSON Web Token）による Bearer 認証を使用する。

```
Authorization: Bearer <access_token>
```

ログイン API で取得した `access_token` をすべてのリクエストヘッダーに付与すること（認証 API を除く）。

### リクエストヘッダー

| ヘッダー名 | 必須 | 値 |
|-----------|------|-----|
| Authorization | ○ | `Bearer <access_token>` |
| Content-Type | ○（POST/PUT/PATCH時） | `application/json` |

### レスポンス共通構造

**成功時**

```json
{
  "data": { /* リソースオブジェクト or 配列 */ },
  "meta": {
    "total": 100,
    "page": 1,
    "per_page": 20
  }
}
```

`meta` はページネーションが存在する一覧取得時のみ返却する。

**エラー時**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "入力値が不正です",
    "details": [
      { "field": "email", "message": "メール形式で入力してください" }
    ]
  }
}
```

`details` はバリデーションエラー時のみ返却する。

### ページネーション

一覧取得 API は以下のクエリパラメータでページネーションを制御する。

| パラメータ | 型 | デフォルト | 説明 |
|-----------|-----|-----------|------|
| page | integer | 1 | ページ番号（1始まり） |
| per_page | integer | 20 | 1ページあたりの件数（最大100） |

### 日時フォーマット

すべての日時は ISO 8601 形式（UTC）で返却する。

```
2026-04-19T09:00:00Z
```

日付のみのフィールドは `YYYY-MM-DD` 形式とする。

### ロール定義

| ロール値 | 説明 |
|---------|------|
| `sales` | 営業担当者 |
| `manager` | 上長 |
| `admin` | 管理者 |

---

## 2. 認証 API

### POST /auth/login

ログイン処理。メールアドレスとパスワードで認証し、アクセストークンを返す。

**認証:** 不要

**リクエストボディ**

```json
{
  "email": "yamada@example.com",
  "password": "password123"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| email | string | ○ | メールアドレス |
| password | string | ○ | パスワード |

**レスポンス `200 OK`**

```json
{
  "data": {
    "access_token": "eyJhbGciOiJIUzI1NiIs...",
    "token_type": "Bearer",
    "expires_in": 86400,
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "山田 太郎",
      "email": "yamada@example.com",
      "role": "sales"
    }
  }
}
```

| フィールド | 型 | 説明 |
|-----------|-----|------|
| access_token | string | JWT アクセストークン |
| token_type | string | `Bearer` 固定 |
| expires_in | integer | トークン有効期間（秒） |
| user | object | ログインユーザー情報 |

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 401 | `INVALID_CREDENTIALS` | メールアドレスまたはパスワードが不正 |

---

### POST /auth/logout

ログアウト処理。サーバー側でトークンを無効化する。

**認証:** 必要

**リクエストボディ:** なし

**レスポンス `200 OK`**

```json
{
  "data": {
    "message": "ログアウトしました"
  }
}
```

---

## 3. 日報 API

### GET /reports

日報一覧を取得する。営業は自分の日報のみ、上長・管理者は全員分を取得できる。

**認証:** 必要（全ロール）

**クエリパラメータ**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| user_id | string (UUID) | ✕ | ユーザーIDで絞り込み（上長・管理者のみ有効） |
| date_from | string (date) | ✕ | 対象日の開始日（例: `2026-04-01`） |
| date_to | string (date) | ✕ | 対象日の終了日（例: `2026-04-30`） |
| page | integer | ✕ | ページ番号（デフォルト: 1） |
| per_page | integer | ✕ | 1ページの件数（デフォルト: 20） |

**レスポンス `200 OK`**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "report_date": "2026-04-19",
      "problem": "株式会社Aの予算承認フローが不明。",
      "plan": "株式会社Aへフォローアップメールを送付する。",
      "user": {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "山田 太郎"
      },
      "visit_records": [
        {
          "id": "550e8400-e29b-41d4-a716-446655440010",
          "customer": {
            "id": "550e8400-e29b-41d4-a716-446655440020",
            "name": "山田 次郎",
            "company": "株式会社A"
          },
          "content": "定例ミーティング。新製品の提案を実施。",
          "sort_order": 1
        }
      ],
      "comments_count": 1,
      "created_at": "2026-04-19T09:00:00Z",
      "updated_at": "2026-04-19T09:00:00Z"
    }
  ],
  "meta": {
    "total": 45,
    "page": 1,
    "per_page": 20
  }
}
```

---

### POST /reports

日報を新規作成する。

**認証:** 必要（`sales` ロールのみ）

**リクエストボディ**

```json
{
  "report_date": "2026-04-19",
  "problem": "株式会社Aの予算承認フローが不明。意思決定者へのアプローチ方法を相談したい。",
  "plan": "株式会社Aへフォローアップメールを送付する。\n有限会社Bの契約書ドラフトを作成する。",
  "visit_records": [
    {
      "customer_id": "550e8400-e29b-41d4-a716-446655440020",
      "content": "定例ミーティング。新製品の提案を実施。",
      "sort_order": 1
    },
    {
      "customer_id": "550e8400-e29b-41d4-a716-446655440021",
      "content": "契約更新の打ち合わせ。来週中に回答予定。",
      "sort_order": 2
    }
  ]
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| report_date | string (date) | ○ | 対象日。同一ユーザー・日付の重複不可 |
| problem | string | ○ | 課題・相談（最大2000文字） |
| plan | string | ○ | 明日やること（最大2000文字） |
| visit_records | array | ○ | 訪問記録（1件以上必須） |
| visit_records[].customer_id | string (UUID) | ○ | 顧客ID |
| visit_records[].content | string | ○ | 訪問内容（最大1000文字） |
| visit_records[].sort_order | integer | ○ | 表示順（1始まり） |

**レスポンス `201 Created`**

作成した日報オブジェクトを返す（`GET /reports/:id` と同じ構造）。

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 400 | `VALIDATION_ERROR` | 入力値不正 |
| 403 | `FORBIDDEN` | 営業ロール以外からのリクエスト |
| 409 | `DUPLICATE_REPORT` | 同一ユーザー・日付の日報が既に存在する |

---

### GET /reports/:id

日報を1件取得する。

**認証:** 必要（全ロール）

**パスパラメータ**

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| id | string (UUID) | 日報ID |

**レスポンス `200 OK`**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440001",
    "report_date": "2026-04-19",
    "problem": "株式会社Aの予算承認フローが不明。",
    "plan": "株式会社Aへフォローアップメールを送付する。",
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "山田 太郎",
      "role": "sales"
    },
    "visit_records": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440010",
        "customer": {
          "id": "550e8400-e29b-41d4-a716-446655440020",
          "name": "山田 次郎",
          "company": "株式会社A"
        },
        "content": "定例ミーティング。新製品の提案を実施。",
        "sort_order": 1
      }
    ],
    "comments": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440030",
        "body": "株式会社Aは購買部門の鈴木さんが決裁権限を持っています。",
        "commenter": {
          "id": "550e8400-e29b-41d4-a716-446655440002",
          "name": "田中 部長"
        },
        "created_at": "2026-04-19T18:32:00Z"
      }
    ],
    "created_at": "2026-04-19T09:00:00Z",
    "updated_at": "2026-04-19T09:00:00Z"
  }
}
```

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 403 | `FORBIDDEN` | アクセス権限なし（他人の日報を営業が参照しようとした場合など） |
| 404 | `NOT_FOUND` | 日報が存在しない |

---

### PUT /reports/:id

日報を更新する。訪問記録は全件洗い替え（差分更新ではない）。

**認証:** 必要（日報作成者本人のみ）

**パスパラメータ**

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| id | string (UUID) | 日報ID |

**リクエストボディ**

`POST /reports` と同じ構造。`report_date` は変更不可。

```json
{
  "problem": "（更新後のテキスト）",
  "plan": "（更新後のテキスト）",
  "visit_records": [
    {
      "customer_id": "550e8400-e29b-41d4-a716-446655440020",
      "content": "（更新後の訪問内容）",
      "sort_order": 1
    }
  ]
}
```

**レスポンス `200 OK`**

更新後の日報オブジェクトを返す。

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 400 | `VALIDATION_ERROR` | 入力値不正 |
| 403 | `FORBIDDEN` | 本人以外からのリクエスト |
| 404 | `NOT_FOUND` | 日報が存在しない |

---

### DELETE /reports/:id

日報を削除する。

**認証:** 必要（日報作成者本人のみ）

**パスパラメータ**

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| id | string (UUID) | 日報ID |

**レスポンス `204 No Content`**

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 403 | `FORBIDDEN` | 本人以外からのリクエスト |
| 404 | `NOT_FOUND` | 日報が存在しない |

---

## 4. 訪問記録 API

訪問記録は日報作成・更新時（`POST /reports`、`PUT /reports/:id`）に日報と一体で操作することを基本とする。以下は個別操作が必要な場合のエンドポイント。

### GET /reports/:report_id/visit_records

指定した日報の訪問記録一覧を取得する。

**認証:** 必要（全ロール）

**レスポンス `200 OK`**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440010",
      "customer": {
        "id": "550e8400-e29b-41d4-a716-446655440020",
        "name": "山田 次郎",
        "company": "株式会社A"
      },
      "content": "定例ミーティング。新製品の提案を実施。",
      "sort_order": 1
    }
  ]
}
```

---

## 5. コメント API

### GET /reports/:report_id/comments

指定した日報のコメント一覧を取得する。

**認証:** 必要（全ロール）

**レスポンス `200 OK`**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440030",
      "body": "株式会社Aは購買部門の鈴木さんが決裁権限を持っています。",
      "commenter": {
        "id": "550e8400-e29b-41d4-a716-446655440002",
        "name": "田中 部長",
        "role": "manager"
      },
      "created_at": "2026-04-19T18:32:00Z",
      "updated_at": "2026-04-19T18:32:00Z"
    }
  ]
}
```

---

### POST /reports/:report_id/comments

コメントを投稿する。

**認証:** 必要（`manager` または `admin` ロールのみ）

**パスパラメータ**

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| report_id | string (UUID) | 日報ID |

**リクエストボディ**

```json
{
  "body": "株式会社Aは購買部門の鈴木さんが決裁権限を持っています。明日の訪問で紹介してもらいましょう。"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| body | string | ○ | コメント本文（最大2000文字） |

**レスポンス `201 Created`**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440031",
    "body": "株式会社Aは購買部門の鈴木さんが決裁権限を持っています。明日の訪問で紹介してもらいましょう。",
    "commenter": {
      "id": "550e8400-e29b-41d4-a716-446655440002",
      "name": "田中 部長",
      "role": "manager"
    },
    "created_at": "2026-04-19T18:45:00Z",
    "updated_at": "2026-04-19T18:45:00Z"
  }
}
```

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 400 | `VALIDATION_ERROR` | 入力値不正 |
| 403 | `FORBIDDEN` | 営業ロールからのリクエスト |
| 404 | `NOT_FOUND` | 日報が存在しない |

---

### DELETE /reports/:report_id/comments/:id

コメントを削除する。

**認証:** 必要（コメント投稿者本人または `admin` のみ）

**パスパラメータ**

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| report_id | string (UUID) | 日報ID |
| id | string (UUID) | コメントID |

**レスポンス `204 No Content`**

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 403 | `FORBIDDEN` | 本人・管理者以外からのリクエスト |
| 404 | `NOT_FOUND` | コメントが存在しない |

---

## 6. 顧客マスタ API

### GET /customers

顧客一覧を取得する。

**認証:** 必要（全ロール）

**クエリパラメータ**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| q | string | ✕ | 顧客名・会社名の部分一致検索 |
| page | integer | ✕ | ページ番号（デフォルト: 1） |
| per_page | integer | ✕ | 1ページの件数（デフォルト: 20） |

**レスポンス `200 OK`**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440020",
      "name": "山田 次郎",
      "company": "株式会社A",
      "phone": "03-1234-5678",
      "email": "yamada.j@company-a.co.jp",
      "created_at": "2026-01-10T10:00:00Z",
      "updated_at": "2026-01-10T10:00:00Z"
    }
  ],
  "meta": {
    "total": 80,
    "page": 1,
    "per_page": 20
  }
}
```

---

### POST /customers

顧客を新規登録する。

**認証:** 必要（全ロール）

**リクエストボディ**

```json
{
  "name": "山田 次郎",
  "company": "株式会社A",
  "phone": "03-1234-5678",
  "email": "yamada.j@company-a.co.jp"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| name | string | ○ | 顧客名（最大100文字） |
| company | string | ✕ | 会社名（最大200文字） |
| phone | string | ✕ | 電話番号 |
| email | string | ✕ | メールアドレス |

**レスポンス `201 Created`**

作成した顧客オブジェクトを返す。

---

### GET /customers/:id

顧客を1件取得する。

**認証:** 必要（全ロール）

**レスポンス `200 OK`**

顧客オブジェクトを返す（`GET /customers` の1要素と同じ構造）。

---

### PUT /customers/:id

顧客情報を更新する。

**認証:** 必要（全ロール）

**リクエストボディ**

`POST /customers` と同じ構造。

**レスポンス `200 OK`**

更新後の顧客オブジェクトを返す。

---

### DELETE /customers/:id

顧客を削除する。訪問記録に紐づいている顧客は削除不可。

**認証:** 必要（`admin` ロールのみ）

**レスポンス `204 No Content`**

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 403 | `FORBIDDEN` | 管理者以外からのリクエスト |
| 409 | `CUSTOMER_IN_USE` | 訪問記録に紐づいているため削除不可 |

---

## 7. ユーザー API

### GET /users

ユーザー一覧を取得する。

**認証:** 必要（`admin` ロールのみ）

**クエリパラメータ**

| パラメータ | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| role | string | ✕ | ロールで絞り込み（`sales` / `manager` / `admin`） |
| page | integer | ✕ | ページ番号（デフォルト: 1） |
| per_page | integer | ✕ | 1ページの件数（デフォルト: 20） |

**レスポンス `200 OK`**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "山田 太郎",
      "email": "yamada@example.com",
      "role": "sales",
      "created_at": "2026-01-01T09:00:00Z",
      "updated_at": "2026-01-01T09:00:00Z"
    }
  ],
  "meta": {
    "total": 15,
    "page": 1,
    "per_page": 20
  }
}
```

---

### POST /users

ユーザーを新規登録する。

**認証:** 必要（`admin` ロールのみ）

**リクエストボディ**

```json
{
  "name": "鈴木 一郎",
  "email": "suzuki@example.com",
  "password": "securePass123",
  "role": "sales"
}
```

| フィールド | 型 | 必須 | 説明 |
|-----------|-----|------|------|
| name | string | ○ | 氏名（最大100文字） |
| email | string | ○ | メールアドレス（システム内一意） |
| password | string | ○ | パスワード（8文字以上） |
| role | string | ○ | `sales` / `manager` / `admin` のいずれか |

**レスポンス `201 Created`**

作成したユーザーオブジェクトを返す（`password` は含まない）。

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 400 | `VALIDATION_ERROR` | 入力値不正 |
| 403 | `FORBIDDEN` | 管理者以外からのリクエスト |
| 409 | `EMAIL_ALREADY_EXISTS` | メールアドレスが既に使用されている |

---

### GET /users/:id

ユーザーを1件取得する。

**認証:** 必要（`admin` ロールのみ、または本人）

**レスポンス `200 OK`**

ユーザーオブジェクトを返す（`GET /users` の1要素と同じ構造）。

---

### PUT /users/:id

ユーザー情報を更新する。

**認証:** 必要（`admin` ロールのみ）

**リクエストボディ**

```json
{
  "name": "鈴木 一郎",
  "email": "suzuki@example.com",
  "role": "manager"
}
```

`password` は省略可（省略した場合は変更しない）。

**レスポンス `200 OK`**

更新後のユーザーオブジェクトを返す。

---

### DELETE /users/:id

ユーザーを削除する。

**認証:** 必要（`admin` ロールのみ）

**レスポンス `204 No Content`**

**エラーレスポンス**

| ステータス | コード | 説明 |
|-----------|--------|------|
| 403 | `FORBIDDEN` | 管理者以外からのリクエスト |
| 409 | `USER_IN_USE` | 日報が紐づいているため削除不可 |

---

## 8. エラーコード一覧

### HTTPステータスコードと意味

| ステータスコード | 意味 |
|----------------|------|
| 200 OK | 正常取得・更新 |
| 201 Created | 正常作成 |
| 204 No Content | 正常削除 |
| 400 Bad Request | リクエスト不正（バリデーションエラー等） |
| 401 Unauthorized | 未認証（トークンなし・期限切れ） |
| 403 Forbidden | 権限なし |
| 404 Not Found | リソースが存在しない |
| 409 Conflict | リソースの競合（重複・参照整合性違反） |
| 500 Internal Server Error | サーバー内部エラー |

### アプリケーションエラーコード一覧

| コード | HTTPステータス | 説明 |
|--------|--------------|------|
| `VALIDATION_ERROR` | 400 | 入力バリデーション失敗 |
| `INVALID_CREDENTIALS` | 401 | 認証情報が不正 |
| `UNAUTHORIZED` | 401 | 未認証またはトークン期限切れ |
| `FORBIDDEN` | 403 | アクセス権限なし |
| `NOT_FOUND` | 404 | 対象リソースが存在しない |
| `DUPLICATE_REPORT` | 409 | 同一ユーザー・日付の日報が既に存在する |
| `EMAIL_ALREADY_EXISTS` | 409 | メールアドレスが既に使用されている |
| `CUSTOMER_IN_USE` | 409 | 顧客が訪問記録に紐づいているため削除不可 |
| `USER_IN_USE` | 409 | ユーザーが日報に紐づいているため削除不可 |
| `INTERNAL_SERVER_ERROR` | 500 | サーバー内部エラー |

---

## 付録: エンドポイント一覧

| メソッド | パス | 説明 | 必要ロール |
|---------|------|------|-----------|
| POST | `/auth/login` | ログイン | 不要 |
| POST | `/auth/logout` | ログアウト | 全員 |
| GET | `/reports` | 日報一覧 | 全員 |
| POST | `/reports` | 日報作成 | sales |
| GET | `/reports/:id` | 日報取得 | 全員 |
| PUT | `/reports/:id` | 日報更新 | sales（本人） |
| DELETE | `/reports/:id` | 日報削除 | sales（本人） |
| GET | `/reports/:report_id/visit_records` | 訪問記録一覧 | 全員 |
| GET | `/reports/:report_id/comments` | コメント一覧 | 全員 |
| POST | `/reports/:report_id/comments` | コメント投稿 | manager / admin |
| DELETE | `/reports/:report_id/comments/:id` | コメント削除 | manager（本人）/ admin |
| GET | `/customers` | 顧客一覧 | 全員 |
| POST | `/customers` | 顧客作成 | 全員 |
| GET | `/customers/:id` | 顧客取得 | 全員 |
| PUT | `/customers/:id` | 顧客更新 | 全員 |
| DELETE | `/customers/:id` | 顧客削除 | admin |
| GET | `/users` | ユーザー一覧 | admin |
| POST | `/users` | ユーザー作成 | admin |
| GET | `/users/:id` | ユーザー取得 | admin / 本人 |
| PUT | `/users/:id` | ユーザー更新 | admin |
| DELETE | `/users/:id` | ユーザー削除 | admin |

---

*以上*
