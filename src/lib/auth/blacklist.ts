// NOTE: In-memory store — the blacklist is lost on server restart or scale-out.
// This means tokens invalidated before a restart become valid again.
// TODO: Replace with a persistent store (e.g., Redis) before production use.
const blacklistedTokens = new Set<string>()

export function addToBlacklist(token: string): void {
  blacklistedTokens.add(token)
}

export function isBlacklisted(token: string): boolean {
  return blacklistedTokens.has(token)
}
