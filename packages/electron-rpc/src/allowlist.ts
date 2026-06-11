/** Allowlist of sender frame URLs: exact strings, `*`-suffixed prefixes, or RegExps. */
export type SenderURLAllowlist = Array<string | RegExp>

/**
 * Check a sender frame URL against an allowlist.
 *
 * Entry forms:
 * - exact string: the URL must match exactly
 * - string ending with `*`: the URL must start with the part before the `*`
 *   (e.g. `'file://*'` for packaged apps, `'https://app.example.com/*'`)
 * - RegExp: tested against the full URL
 *
 * An empty allowlist denies every URL.
 */
export function isAllowedSenderURL(url: string, allowlist: SenderURLAllowlist): boolean {
  for (const entry of allowlist) {
    if (typeof entry === 'string') {
      if (entry.endsWith('*')) {
        if (url.startsWith(entry.slice(0, -1))) {
          return true
        }
      } else if (url === entry) {
        return true
      }
    } else if (entry.test(url)) {
      return true
    }
  }
  return false
}
