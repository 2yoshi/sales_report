import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth/guard'
import { listUsersQuerySchema, createUserSchema } from '@/lib/schemas/user.schema'
import { listUsers, createUser } from '@/lib/users/users.service'
import { handleError } from '@/lib/errors'
import type { AuthUser } from '@/types'

async function handleGetUsers(
  req: NextRequest,
  _context: Record<string, unknown>,
  _user: AuthUser,
): Promise<NextResponse> {
  try {
    const searchParams = req.nextUrl.searchParams

    const rawQuery: Record<string, string | undefined> = {
      role: searchParams.get('role') ?? undefined,
      page: searchParams.get('page') ?? undefined,
      per_page: searchParams.get('per_page') ?? undefined,
    }

    Object.keys(rawQuery).forEach((key) => {
      if (rawQuery[key] === undefined) {
        delete rawQuery[key]
      }
    })

    const query = listUsersQuerySchema.parse(rawQuery)
    const result = await listUsers(query)

    return NextResponse.json(result)
  } catch (err) {
    return handleError(err)
  }
}

export const GET = withAuth(handleGetUsers, ['admin'])

async function handlePostUser(
  req: NextRequest,
  _context: Record<string, unknown>,
  _user: AuthUser,
): Promise<NextResponse> {
  try {
    let body: unknown
    try {
      body = await req.json()
    } catch {
      throw new Error('Invalid JSON')
    }
    const input = createUserSchema.parse(body)
    const user = await createUser(input)
    return NextResponse.json({ data: user }, { status: 201 })
  } catch (err) {
    return handleError(err)
  }
}

export const POST = withAuth(handlePostUser, ['admin'])
