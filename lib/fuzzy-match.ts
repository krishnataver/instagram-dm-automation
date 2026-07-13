/**
 * Smart keyword matching using Levenshtein distance algorithm.
 * Catches misspellings like "PRISE" → "PRICE", "INOF" → "INFO"
 */

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = []
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1      // deletion
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

/**
 * Returns similarity score between 0 and 1.
 * 1.0 = exact match, 0.0 = completely different
 */
export function similarityScore(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length)
  if (maxLen === 0) return 1.0
  const distance = levenshteinDistance(a.toLowerCase(), b.toLowerCase())
  return 1 - distance / maxLen
}

/**
 * Check if a message contains a keyword (exact or smart fuzzy match).
 * @param message - The full message text from user
 * @param keyword - The trigger keyword to look for
 * @param smartMatch - If true, use fuzzy matching (80% similarity threshold)
 * @returns true if keyword is found in message
 */
export function matchesKeyword(
  message: string,
  keyword: string,
  smartMatch: boolean = false
): boolean {
  const msgLower = message.toLowerCase().trim()
  const kwLower = keyword.toLowerCase().trim()

  // Always check for exact/substring match first
  if (msgLower.includes(kwLower)) return true

  if (!smartMatch) return false

  // For smart match: check each word in the message against the keyword
  const words = msgLower.split(/\s+/)
  const THRESHOLD = 0.80

  for (const word of words) {
    // Only compare words of similar length (avoid false positives)
    if (Math.abs(word.length - kwLower.length) > 3) continue
    const score = similarityScore(word, kwLower)
    if (score >= THRESHOLD) return true
  }

  return false
}

/**
 * Find the best matching automation rule from a list.
 * Returns the first rule whose keyword matches the message.
 */
export function findMatchingRule<T extends { triggerValue: string; smartMatch: boolean }>(
  message: string,
  rules: T[]
): T | null {
  for (const rule of rules) {
    if (!rule.triggerValue) continue
    if (matchesKeyword(message, rule.triggerValue, rule.smartMatch)) {
      return rule
    }
  }
  return null
}
