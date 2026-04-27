import { prisma } from '@/lib/prisma'
import { AUTH_TOKEN_EXPIRES_SECONDS } from './jwt'

/**
 * Adds a JWT to the persistent blacklist so it cannot be reused after logout.
 * expiresAt is set to the token's natural expiry (24 h) so the row can be
 * pruned later without risking premature invalidation of still-valid tokens.
 */
export async function addToBlacklist(token: string): Promise<void> {
  const expiresAt = new Date(Date.now() + AUTH_TOKEN_EXPIRES_SECONDS * 1000)
  await prisma.tokenBlacklist.upsert({
    where: { token },
    create: { token, expiresAt },
    update: {},
  })
}

/**
 * Returns true if the token is present in the blacklist and has not yet expired.
 */
export async function isBlacklisted(token: string): Promise<boolean> {
  const entry = await prisma.tokenBlacklist.findFirst({
    where: {
      token,
      expiresAt: { gt: new Date() },
    },
  })
  return entry !== null
}
