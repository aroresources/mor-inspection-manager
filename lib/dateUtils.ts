// Date helpers that treat Supabase date strings (YYYY-MM-DD) as UTC.
// This prevents off-by-one-day issues when parsing/displaying in US timezones.

export function parseDate(str: string | null | undefined): Date | null {
  if (!str) return null
  return new Date(str + 'T00:00:00Z')
}

// Canonical date display used across the whole app: short month, e.g. "Jun 1, 2026".
export function formatDate(str: string | null | undefined): string {
  const d = parseDate(str)
  if (!d) return '—'
  return d.toLocaleDateString('en-US', {
    timeZone: 'UTC',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// Format a Date object (e.g. a computed/parsed date) with the canonical format.
export function formatDateObj(date: Date | null | undefined): string {
  if (!date) return '—'
  return formatDate(date.toISOString().slice(0, 10))
}
