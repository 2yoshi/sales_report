const blacklistedTokens = new Set<string>()

export function addToBlacklist(token: string): void {
  blacklistedTokens.add(token)
}

export function isBlacklisted(token: string): boolean {
  return blacklistedTokens.has(token)
}
