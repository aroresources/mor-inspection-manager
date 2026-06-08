// Date helpers that treat Supabase date strings (YYYY-MM-DD) as UTC.
// This prevents off-by-one-day issues when parsing/displaying in US timezones.

export function parseDate(str: string | null | undefined): Date | null {
  if (!str) return null
  return new Date(str + 'T00:00:00Z')
}

export function formatDate(str: string | null | undefined): string {
  const d = parseDate(str)
  if (!d) return '—'
  return d.toLocaleDateString('en-US', { timeZone: 'UTC' })
}
