import jwt from 'jsonwebtoken'
import type { AuthUser } from '@/types'

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET environment variable is required in production')
}
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production'
const EXPIRES_IN = '24h'

export function generateToken(payload: AuthUser): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: EXPIRES_IN })
}

export function verifyToken(token: string): AuthUser {
  const decoded = jwt.verify(token, JWT_SECRET)
  if (typeof decoded === 'string') {
    throw new Error('Invalid token payload')
  }
  const { id, name, email, role } = decoded as AuthUser & jwt.JwtPayload
  return { id, name, email, role }
}
