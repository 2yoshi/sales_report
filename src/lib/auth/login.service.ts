import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { AppError } from '@/lib/errors/AppError'
import { generateToken, AUTH_TOKEN_EXPIRES_SECONDS } from './jwt'
import type { LoginInput } from '@/lib/schemas/auth.schema'
import type { UserRole } from '@/types'

// Pre-computed dummy hash used only to ensure constant-time execution when
// the email does not exist, preventing user enumeration via timing attacks.
const DUMMY_HASH = '$2a$10$FixedDummyHashForTimingAttack.PreventUserEnumeration00'

export interface LoginResult {
  access_token: string
  token_type: 'Bearer'
  expires_in: number
  user: {
    id: string
    name: string
    email: string
    role: UserRole
  }
}

/**
 * Authenticates a user by email and password.
 * Throws AppError.invalidCredentials() for any auth failure to avoid
 * leaking whether the email exists.
 */
export async function loginUser(input: LoginInput): Promise<LoginResult> {
  const user = await prisma.user.findUnique({
    where: { email: input.email },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      passwordHash: true,
    },
  })

  if (!user) {
    // Always run bcrypt to make response time uniform regardless of whether
    // the email exists, preventing user enumeration via timing analysis.
    await bcrypt.compare(input.password, DUMMY_HASH)
    throw AppError.invalidCredentials()
  }

  const passwordValid = await bcrypt.compare(input.password, user.passwordHash)
  if (!passwordValid) {
    throw AppError.invalidCredentials()
  }

  const authUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as UserRole,
  }

  const token = generateToken(authUser)

  return {
    access_token: token,
    token_type: 'Bearer',
    expires_in: AUTH_TOKEN_EXPIRES_SECONDS,
    user: authUser,
  }
}
