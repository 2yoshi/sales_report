import { addToBlacklist } from './blacklist'

export interface LogoutResult {
  message: string
}

/**
 * Invalidates the given JWT by adding it to the in-memory blacklist.
 * All subsequent requests presenting this token will receive a 401.
 */
export function logoutUser(token: string): LogoutResult {
  addToBlacklist(token)
  return { message: 'ログアウトしました' }
}
