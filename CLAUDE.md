# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a **営業日報システム (Sales Daily Report System)**. The repository currently contains only specification documents in `doc/`. No implementation exists yet.

- `@doc/erd.mermaid` — ER design
- `@doc/api_specification.md` — REST API design (endpoints, request/response schemas, error codes)
- `@doc/screen_definition.md` — UI screen layouts, navigation flow, role-based display rules
- `@doc/test_specification.md` — 148 test cases covering functional, API, permission, validation, and non-functional tests

## Architecture (Spec-Level)

**Authentication:** JWT Bearer tokens, 24-hour expiry, server-side invalidation on logout. Token required on all endpoints except `POST /auth/login`.

**Base URL:** `https://api.example.com/v1`

**Three roles with strict access control:**

| Role | Key Permissions |
|------|----------------|
| `sales` | Create/edit/delete own reports only; view own reports only |
| `manager` | Read all reports; post/delete own comments |
| `admin` | Full access to users; delete customers; delete any comment |

## Key Domain Rules

**Reports (`/reports`)**
- Only `sales` can create reports (`POST /reports` → 403 for manager/admin)
- Only the report author can edit/delete their own report
- One report per user per date — duplicate returns `409 DUPLICATE_REPORT`
- `PUT /reports/:id` replaces all `visit_records` wholesale (not diff)
- `report_date` cannot be changed on update
- `sales` can only view their own reports; `manager`/`admin` see all

**Visit Records** — always embedded in report create/update; individual endpoint `GET /reports/:report_id/visit_records` exists for read-only access.

**Comments (`/reports/:report_id/comments`)**
- Only `manager` and `admin` can post comments
- `sales` cannot post comments (403)
- Delete: comment author (manager) or `admin` only; other managers cannot delete each other's comments

**Customers (`/customers`)**
- All roles can read/create/update customers
- Only `admin` can delete; blocked if customer is referenced in any visit record (`409 CUSTOMER_IN_USE`)

**Users (`/users`)**
- All operations restricted to `admin`
- Cannot delete a user who has associated reports (`409 USER_IN_USE`)
- Email must be unique system-wide (`409 EMAIL_ALREADY_EXISTS`)
- Password: 8+ characters, stored hashed

## API Response Conventions

```json
// Success (with pagination)
{ "data": [...], "meta": { "total": 100, "page": 1, "per_page": 20 } }

// Success (single resource)
{ "data": { ... } }

// Error
{ "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [...] } }
```

- Datetimes: ISO 8601 UTC (`2026-04-19T09:00:00Z`)
- Dates: `YYYY-MM-DD`
- IDs: UUID v4
- Pagination defaults: `page=1`, `per_page=20` (max 100)

## Validation Constraints

| Field | Constraint |
|-------|-----------|
| `visit_records[].content` | max 1000 chars |
| `problem`, `plan`, comment `body` | max 2000 chars |
| customer `name` | max 100 chars, required |
| customer `company` | max 200 chars, optional |
| customer `email` | email format, optional |
| user `name` | max 100 chars |
| user `email` | email format, required, unique |
| user `password` | 8+ chars |
| `report_date` | must not be future date |
| `visit_records` | at least 1 required per report |

## UI Behaviour Rules

- `sales` role: "新規作成" button visible, no 担当者 filter shown
- `manager`/`admin`: 担当者 filter visible, no "新規作成" button
- Detail screen edit/delete buttons: visible only to report author
- Comment input: visible only to `manager`/`admin`
- Visit record delete button: hidden when only 1 row remains
- Dashboard default filter: last 30 days
- 訪問先 display: 2 customers shown by name, 3+ shown as "〇〇、〇〇 他N社"
- `report_date` default: today's date

## Screen URLs

| URL | Screen |
|-----|--------|
| `/login` | SCR-001 Login |
| `/` | SCR-002 Dashboard |
| `/reports/new` | SCR-003 Create Report |
| `/reports/:id` | SCR-004 Report Detail/Edit |
| `/customers` | SCR-005 Customer List |
| `/customers/new`, `/customers/:id/edit` | SCR-006 Customer Form |
| `/users` | SCR-007 User List (admin only) |
| `/users/new`, `/users/:id/edit` | SCR-008 User Form (admin only) |

## Test Data (from spec)

| ID | Name | Email | Role |
|----|------|-------|------|
| USER-01 | 山田 太郎 | yamada@test.com | sales |
| USER-02 | 鈴木 一郎 | suzuki@test.com | sales |
| USER-03 | 田中 部長 | tanaka@test.com | manager |
| USER-04 | 管理 太郎 | admin@test.com | admin |

All test passwords: `Test1234!`

## 使用技術
**言語** TypeScript
**フレームワーク** Next.js
**UIコンポーネント** shadcn/ui
**APIスキーマ** OpenAPI(Zodによる検証)
**DBスキーマ** Prisma
**テスト** ViTest
**デプロイ** Google Cloud Run