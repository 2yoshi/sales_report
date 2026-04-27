import { addToBlacklist } from './blacklist'

/**
 * Invalidates the given JWT by persisting it to the token blacklist.
 * All subsequent requests presenting this token will receive a 401.
 */
export async function logoutUser(token: string) {
  await addToBlacklist(token)
  return { message: 'ログアウトしました' }
}
