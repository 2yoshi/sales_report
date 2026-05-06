import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, PUT, DELETE } from './route'
import * as usersService from '@/lib/users/users.service'
import { generateToken } from '@/lib/auth/jwt'
import { AppError } from '@/lib/errors/AppError'
import type { AuthUser } from '@/types'
import type { UserItem } from '@/lib/users/users.service'

vi.mock('@/lib/users/users.service', () => ({
  getUser: vi.fn(),
  updateUser: vi.fn(),
  deleteUser: vi.fn(),
}))

vi.mock('@/lib/auth/blacklist', () => ({
  isBlacklisted: vi.fn().mockReturnValue(false),
}))

const mockGetUser = vi.mocked(usersService.getUser)
const mockUpdateUser = vi.mocked(usersService.updateUser)
const mockDeleteUser = vi.mocked(usersService.deleteUser)

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

const USER_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

const sampleUser: UserItem = {
  id: USER_ID,
  name: '山田 太郎',
  email: 'yamada@test.com',
  role: 'sales',
  created_at: '2026-04-29T09:00:00.000Z',
  updated_at: '2026-04-29T09:00:00.000Z',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeGetRequest(user: AuthUser, id = USER_ID): NextRequest {
  return new NextRequest(`http://localhost/api/users/${id}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${generateToken(user)}` },
  })
}

function makePutRequest(user: AuthUser, id: string, body: unknown): NextRequest {
  return new NextRequest(`http://localhost/api/users/${id}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${generateToken(user)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

function makeDeleteRequest(user: AuthUser, id = USER_ID): NextRequest {
  return new NextRequest(`http://localhost/api/users/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${generateToken(user)}` },
  })
}

const validUpdateBody = {
  name: '山田 次郎',
  email: 'yamada2@test.com',
  role: 'manager',
}

// ─── GET /api/users/[id] ─────────────────────────────────────────────────────

describe('GET /api/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('認証', () => {
    it('Authorizationヘッダーがない場合は401を返す', async () => {
      const req = new NextRequest(`http://localhost/api/users/${USER_ID}`, { method: 'GET' })
      const res = await GET(req, { params: Promise.resolve({ id: USER_ID }) })
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })
  })

  describe('USR-003: adminは任意のユーザーを取得できる', () => {
    it('adminで200を返す', async () => {
      mockGetUser.mockResolvedValueOnce(sampleUser)

      const req = makeGetRequest(adminUser)
      const res = await GET(req, { params: Promise.resolve({ id: USER_ID }) })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data).toMatchObject({ id: USER_ID, name: '山田 太郎' })
    })
  })

  describe('本人はアクセス可能', () => {
    it('salesユーザーが自分のプロフィールを取得できる', async () => {
      mockGetUser.mockResolvedValueOnce(sampleUser)

      const req = makeGetRequest(salesUser, salesUser.id)
      const res = await GET(req, { params: Promise.resolve({ id: salesUser.id }) })

      expect(res.status).toBe(200)
    })
  })

  describe('他人のプロフィール → FORBIDDENはservice層で処理', () => {
    it('serviceがFORBIDDENを投げた場合は403を返す', async () => {
      mockGetUser.mockRejectedValueOnce(AppError.forbidden())

      const req = makeGetRequest(salesUser)
      const res = await GET(req, { params: Promise.resolve({ id: USER_ID }) })
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.error.code).toBe('FORBIDDEN')
    })
  })

  describe('404ケース', () => {
    it('存在しないIDの場合は404を返す', async () => {
      mockGetUser.mockRejectedValueOnce(AppError.notFound('ユーザー'))

      const req = makeGetRequest(adminUser)
      const res = await GET(req, { params: Promise.resolve({ id: USER_ID }) })
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('UUID形式でないIDは404を返す', async () => {
      const req = makeGetRequest(adminUser, 'not-a-uuid')
      const res = await GET(req, { params: Promise.resolve({ id: 'not-a-uuid' }) })
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error.code).toBe('NOT_FOUND')
      expect(mockGetUser).not.toHaveBeenCalled()
    })
  })
})

// ─── PUT /api/users/[id] ─────────────────────────────────────────────────────

describe('PUT /api/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('認証・認可', () => {
    it('Authorizationヘッダーがない場合は401を返す', async () => {
      const req = new NextRequest(`http://localhost/api/users/${USER_ID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validUpdateBody),
      })
      const res = await PUT(req, { params: Promise.resolve({ id: USER_ID }) })
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })

    it('salesユーザーは403を返す', async () => {
      const req = makePutRequest(salesUser, USER_ID, validUpdateBody)
      const res = await PUT(req, { params: Promise.resolve({ id: USER_ID }) })
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.error.code).toBe('FORBIDDEN')
    })

    it('managerユーザーは403を返す', async () => {
      const req = makePutRequest(managerUser, USER_ID, validUpdateBody)
      const res = await PUT(req, { params: Promise.resolve({ id: USER_ID }) })
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.error.code).toBe('FORBIDDEN')
    })
  })

  describe('USR-004: adminがユーザーを更新できる', () => {
    it('200と更新されたユーザーを返す', async () => {
      const updated = { ...sampleUser, name: '山田 次郎' }
      mockUpdateUser.mockResolvedValueOnce(updated)

      const req = makePutRequest(adminUser, USER_ID, validUpdateBody)
      const res = await PUT(req, { params: Promise.resolve({ id: USER_ID }) })
      const body = await res.json()

      expect(res.status).toBe(200)
      expect(body.data.name).toBe('山田 次郎')
    })
  })

  describe('バリデーション', () => {
    it('nameが未指定の場合は400を返す', async () => {
      const { name: _omit, ...body } = validUpdateBody
      const req = makePutRequest(adminUser, USER_ID, body)
      const res = await PUT(req, { params: Promise.resolve({ id: USER_ID }) })
      const resBody = await res.json()

      expect(res.status).toBe(400)
      expect(resBody.error.code).toBe('VALIDATION_ERROR')
    })

    it('emailが不正な形式の場合は400を返す', async () => {
      const req = makePutRequest(adminUser, USER_ID, { ...validUpdateBody, email: 'invalid' })
      const res = await PUT(req, { params: Promise.resolve({ id: USER_ID }) })
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('passwordが7文字の場合は400を返す', async () => {
      const req = makePutRequest(adminUser, USER_ID, { ...validUpdateBody, password: '1234567' })
      const res = await PUT(req, { params: Promise.resolve({ id: USER_ID }) })
      const body = await res.json()

      expect(res.status).toBe(400)
      expect(body.error.code).toBe('VALIDATION_ERROR')
    })

    it('passwordは省略可能（200を返す）', async () => {
      mockUpdateUser.mockResolvedValueOnce(sampleUser)

      const req = makePutRequest(adminUser, USER_ID, validUpdateBody)
      const res = await PUT(req, { params: Promise.resolve({ id: USER_ID }) })

      expect(res.status).toBe(200)
    })
  })

  describe('404・409ケース', () => {
    it('UUID形式でないIDは404を返す', async () => {
      const req = makePutRequest(adminUser, 'not-a-uuid', validUpdateBody)
      const res = await PUT(req, { params: Promise.resolve({ id: 'not-a-uuid' }) })
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error.code).toBe('NOT_FOUND')
      expect(mockUpdateUser).not.toHaveBeenCalled()
    })

    it('存在しないIDの場合は404を返す', async () => {
      mockUpdateUser.mockRejectedValueOnce(AppError.notFound('ユーザー'))

      const req = makePutRequest(adminUser, USER_ID, validUpdateBody)
      const res = await PUT(req, { params: Promise.resolve({ id: USER_ID }) })
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('メールアドレス重複の場合は409を返す', async () => {
      mockUpdateUser.mockRejectedValueOnce(AppError.emailAlreadyExists())

      const req = makePutRequest(adminUser, USER_ID, validUpdateBody)
      const res = await PUT(req, { params: Promise.resolve({ id: USER_ID }) })
      const body = await res.json()

      expect(res.status).toBe(409)
      expect(body.error.code).toBe('EMAIL_ALREADY_EXISTS')
    })
  })
})

// ─── DELETE /api/users/[id] ──────────────────────────────────────────────────

describe('DELETE /api/users/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('認証・認可', () => {
    it('Authorizationヘッダーがない場合は401を返す', async () => {
      const req = new NextRequest(`http://localhost/api/users/${USER_ID}`, { method: 'DELETE' })
      const res = await DELETE(req, { params: Promise.resolve({ id: USER_ID }) })
      const body = await res.json()

      expect(res.status).toBe(401)
      expect(body.error.code).toBe('UNAUTHORIZED')
    })

    it('salesユーザーは403を返す', async () => {
      const req = makeDeleteRequest(salesUser)
      const res = await DELETE(req, { params: Promise.resolve({ id: USER_ID }) })
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.error.code).toBe('FORBIDDEN')
      expect(mockDeleteUser).not.toHaveBeenCalled()
    })

    it('managerユーザーは403を返す', async () => {
      const req = makeDeleteRequest(managerUser)
      const res = await DELETE(req, { params: Promise.resolve({ id: USER_ID }) })
      const body = await res.json()

      expect(res.status).toBe(403)
      expect(body.error.code).toBe('FORBIDDEN')
      expect(mockDeleteUser).not.toHaveBeenCalled()
    })
  })

  describe('IDバリデーション', () => {
    it('UUID形式でないIDは404を返す', async () => {
      const req = makeDeleteRequest(adminUser, 'not-a-uuid')
      const res = await DELETE(req, { params: Promise.resolve({ id: 'not-a-uuid' }) })
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error.code).toBe('NOT_FOUND')
      expect(mockDeleteUser).not.toHaveBeenCalled()
    })
  })

  describe('USR-006: adminがユーザーを削除できる', () => {
    it('adminが参照のないユーザーを削除すると204を返す', async () => {
      mockDeleteUser.mockResolvedValueOnce(undefined)

      const req = makeDeleteRequest(adminUser)
      const res = await DELETE(req, { params: Promise.resolve({ id: USER_ID }) })

      expect(res.status).toBe(204)
      expect(mockDeleteUser).toHaveBeenCalledWith(USER_ID)
    })
  })

  describe('異常系', () => {
    it('存在しないIDの場合は404を返す', async () => {
      mockDeleteUser.mockRejectedValueOnce(AppError.notFound('ユーザー'))

      const req = makeDeleteRequest(adminUser)
      const res = await DELETE(req, { params: Promise.resolve({ id: USER_ID }) })
      const body = await res.json()

      expect(res.status).toBe(404)
      expect(body.error.code).toBe('NOT_FOUND')
    })

    it('日報に紐づいているユーザーは409を返す', async () => {
      mockDeleteUser.mockRejectedValueOnce(AppError.userInUse())

      const req = makeDeleteRequest(adminUser)
      const res = await DELETE(req, { params: Promise.resolve({ id: USER_ID }) })
      const body = await res.json()

      expect(res.status).toBe(409)
      expect(body.error.code).toBe('USER_IN_USE')
    })

    it('サービスが予期しないエラーを投げた場合は500を返す', async () => {
      mockDeleteUser.mockRejectedValueOnce(new Error('DB error'))

      const req = makeDeleteRequest(adminUser)
      const res = await DELETE(req, { params: Promise.resolve({ id: USER_ID }) })
      const body = await res.json()

      expect(res.status).toBe(500)
      expect(body.error.code).toBe('INTERNAL_SERVER_ERROR')
    })
  })
})
