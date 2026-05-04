import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/guard'
import { updateUserSchema } from '@/lib/schemas/user.schema'
import { getUser, updateUser, deleteUser } from '@/lib/users/users.service'
import { handleError } from '@/lib/errors'
import { AppError } from '@/lib/errors/AppError'
import type { AuthUser } from '@/types'

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function handleGetUser(
  _req: NextRequest,
  context: Record<string, unknown>,
  user: AuthUser,
): Promise<NextResponse> {
  try {
    const params = await (context.params as Promise<{ id: string }>)
    const userId = params.id

    if (!UUID_REGEX.test(userId)) {
      throw AppError.notFound('ユーザー')
    }

    const data = await getUser(userId, user)
    return NextResponse.json({ data })
  } catch (err) {
    return handleError(err)
  }
}

// GET /users/:id is accessible by admin or the user themselves
export const GET = withAuth(handleGetUser)

async function handlePutUser(
  req: NextRequest,
  context: Record<string, unknown>,
  _user: AuthUser,
): Promise<NextResponse> {
  try {
    const params = await (context.params as Promise<{ id: string }>)
    const userId = params.id

    if (!UUID_REGEX.test(userId)) {
      throw AppError.notFound('ユーザー')
    }

    let body: unknown
    try {
      body = await req.json()
    } catch {
      throw new Error('Invalid JSON')
    }
    const input = updateUserSchema.parse(body)
    const data = await updateUser(userId, input)
    return NextResponse.json({ data })
  } catch (err) {
    return handleError(err)
  }
}

export const PUT = withAuth(handlePutUser, ['admin'])

async function handleDeleteUser(
  _req: NextRequest,
  context: Record<string, unknown>,
  _user: AuthUser,
): Promise<NextResponse> {
  try {
    const params = await (context.params as Promise<{ id: string }>)
    const userId = params.id

    if (!UUID_REGEX.test(userId)) {
      throw AppError.notFound('ユーザー')
    }

    await deleteUser(userId)
    return new NextResponse(null, { status: 204 })
  } catch (err) {
    return handleError(err)
  }
}

export const DELETE = withAuth(handleDeleteUser, ['admin'])
