import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from './route'
import * as usersService from '@/lib/users/users.service'
import { generateToken } from '@/lib/auth/jwt'
import { AppError } from '@/lib/errors/AppError'
import type { AuthUser } from '@/types'
import type { ListUsersResult, UserItem } from '@/lib/users/users.service'

vi.mock('@/lib/users/users.service', () => ({
  listUsers: vi.fn(),
  createUser: vi.fn(),
}))

vi.mock('@/lib/auth/blacklist', () => ({
  isBlacklisted: vi.fn().mockReturnValue(false),
}))

const mockListUsers = vi.mocked(usersService.listUsers)
const mockCreateUser = vi.mocked(usersService.createUser)

// ─── Test users ──────────────────────────────────────────────────────────────

const salesUser: AuthUser = {
  id: '11111111-1111-1111-1111-111111111111',
  name: '山田 太郎',
  email: 'yamada@test.com',
  role: 'sales',
}

const managerUser: AuthUser = {
  id: '33333333-3333-3333-3333-333333333333',
  name: '田中 部長',
  email: 'tanaka@test.com',
  role: 'manager',
}

const adminUser: AuthUser = {
  id: '44444444-4444-4444-4444-444444444444',
  name: '管理 太郎',
  email: 'admin@test.com',
  role: 'admin',
}

// ─── Sample data ─────────────────────────────────────────────────────────────

const sampleUser: UserItem = {
  id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  name: '山田 太郎',
  email: 'yamada@test.com',
  role: 'sales',
  created_at: '2026-04-29T09:00:00.000Z',
  updated_at: '2026-04-29T09:00:00.000Z',
}

const defaultListResult: ListUsersResult = {
  data: [sampleUser],
  meta: { total: 1, page: 1, per_page: 20 },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeGetRequest(user: AuthUser, queryString = ''): NextRequest {
  return new NextRequest(`http://localhost/api/users${queryString}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${generateToken(user)}` },
  })
}

function makePostRequest(user: AuthUser, body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/users', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${generateToken(user)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

const validBody = {
  name: '山田 太郎',
  email: 'yamada@test.com',
  password: 'Test1234!',
  role: 'sales',
}

// ─── GET /api/users ───────────────────────────────────────────────────────────

describe('GET /api/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('認証・認可', () => {
    it('Authorizationヘッダーがない場合は401を返す', async () => {
      const req = new NextRequest('http://localhost/api/users', { method: 'GET' })
      const res = await GET(req, {})
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })

    it('salesユーザーは403を返す', async () => {
      const req = makeGetRequest(salesUser)
      const res = await GET(req, {})
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('managerユーザーは403を返す（admin専用）', async () => {
      const req = makeGetRequest(managerUser)
      const res = await GET(req, {})

      expect(res.status).toBe(403)
      const body = await res.json()
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('adminユーザーで200を返す', async () => {
      mockListUsers.mockResolvedValueOnce(defaultListResult)

      const req = makeGetRequest(adminUser)
      const res = await GET(req, {})

      expect(res.status).toBe(200)
    })
  })

  describe('USR-001: ユーザー一覧を取得できる', () => {
    it('ユーザー一覧とmetaを返す', async () => {
      mockListUsers.mockResolvedValueOnce(defaultListResult)

      const req = makeGetRequest(adminUser)
      const res = await GET(req, {})
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data).toHaveLength(1)
      expect(body.meta).toEqual({ total: 1, page: 1, per_page: 20 })
    })

    it('レスポンスにパスワードハッシュが含まれない', async () => {
      mockListUsers.mockResolvedValueOnce(defaultListResult)

      const req = makeGetRequest(adminUser)
      const res = await GET(req, {})
      const body = await res.json()

      expect(body.data[0]).not.toHaveProperty('password_hash')
      expect(body.data[0]).not.toHaveProperty('passwordHash')
    })
  })

  describe('roleフィルタ', () => {
    it('roleパラメータがlistUsersに渡される', async () => {
      mockListUsers.mockResolvedValueOnce({ data: [], meta: { total: 0, page: 1, per_page: 20 } })

      const req = makeGetRequest(adminUser, '?role=sales')
      await GET(req, {})

      expect(mockListUsers).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'sales' }),
      )
    })

    it('無効なrole値は400を返す', async () => {
      const req = makeGetRequest(adminUser, '?role=invalid')
      const res = await GET(req, {})
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('ページネーション', () => {
    it('デフォルト値（page=1, per_page=20）が使われる', async () => {
      mockListUsers.mockResolvedValueOnce(defaultListResult)

      const req = makeGetRequest(adminUser)
      await GET(req, {})

      expect(mockListUsers).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, per_page: 20 }),
      )
    })

    it('per_pageが101の場合は400を返す', async () => {
      const req = makeGetRequest(adminUser, '?per_page=101')
      const res = await GET(req, {})
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('エラーハンドリング', () => {
    it('サービスが予期しないエラーを投げた場合は500を返す', async () => {
      mockListUsers.mockRejectedValueOnce(new Error('DB error'))

      const req = makeGetRequest(adminUser)
      const res = await GET(req, {})
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error.code).toBe('INTERNAL_SERVER_ERROR')
    })
  })
})

// ─── POST /api/users ──────────────────────────────────────────────────────────

describe('POST /api/users', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('認証・認可', () => {
    it('Authorizationヘッダーがない場合は401を返す', async () => {
      const req = new NextRequest('http://localhost/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validBody),
      })
      const res = await POST(req, {})
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })

    it('salesユーザーは403を返す', async () => {
      const req = makePostRequest(salesUser, validBody)
      const res = await POST(req, {})
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('managerユーザーは403を返す', async () => {
      const req = makePostRequest(managerUser, validBody)
      const res = await POST(req, {})
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.error.code).toBe('FORBIDDEN')
    })
  })

  describe('USR-002: adminがユーザーを作成できる', () => {
    it('201と作成されたユーザーを返す', async () => {
      mockCreateUser.mockResolvedValueOnce(sampleUser)

      const req = makePostRequest(adminUser, validBody)
      const res = await POST(req, {})
      const body = await res.json()

      expect(res.status).toBe(201)
      expect(body.data).toMatchObject({ name: '山田 太郎', email: 'yamada@test.com' })
    })

    it('レスポンスにパスワードハッシュが含まれない', async () => {
      mockCreateUser.mockResolvedValueOnce(sampleUser)

      const req = makePostRequest(adminUser, validBody)
      const res = await POST(req, {})
      const body = await res.json()

      expect(body.data).not.toHaveProperty('password_hash')
      expect(body.data).not.toHaveProperty('passwordHash')
    })
  })

  describe('バリデーション', () => {
    it('nameが未指定の場合は400を返す', async () => {
      const { name: _omit, ...body } = validBody
      const req = makePostRequest(adminUser, body)
      const res = await POST(req, {})
      const resBody = await res.json()

      expect(res.status).toBe(400)
      expect(resBody.error.code).toBe('VALIDATION_ERROR')
    })

    it('emailが不正な形式の場合は400を返す', async () => {
      const req = makePostRequest(adminUser, { ...validBody, email: 'invalid' })
      const res = await POST(req, {})
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('passwordが7文字の場合は400を返す', async () => {
      const req = makePostRequest(adminUser, { ...validBody, password: '1234567' })
      const res = await POST(req, {})
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('roleが無効な値の場合は400を返す', async () => {
      const req = makePostRequest(adminUser, { ...validBody, role: 'superuser' })
      const res = await POST(req, {})
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })
  })

  describe('USR-005: メールアドレス重複', () => {
    it('EMAIL_ALREADY_EXISTSの場合は409を返す', async () => {
      mockCreateUser.mockRejectedValueOnce(AppError.emailAlreadyExists())

      const req = makePostRequest(adminUser, validBody)
      const res = await POST(req, {})
      const body = await res.json()

      expect(res.status).toBe(409)
      expect(body.error.code).toBe('EMAIL_ALREADY_EXISTS')
    })
  })

  describe('エラーハンドリング', () => {
    it('サービスが予期しないエラーを投げた場合は500を返す', async () => {
      mockCreateUser.mockRejectedValueOnce(new Error('DB error'))

      const req = makePostRequest(adminUser, validBody)
      const res = await POST(req, {})
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error.code).toBe('INTERNAL_SERVER_ERROR')
    })
  })
})
