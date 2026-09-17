// Shared MOR workflow model.
//
// A MOR's lifecycle (response due -> submitted -> follow-up -> extension ->
// closed) is recorded as an ordered "activity log" of dated events stored in the
// mors.activity_log JSONB column. This log is the source of truth for the UI and
// for the dashboard deadline. The older individual date columns
// (response_due_date, response_submitted_date, follow_up_*) are kept in sync from
// the log for backward compatibility (e.g. the reminder cron still reads them),
// and are used here as a fallback for any MOR whose log hasn't been seeded yet.

import { parseDate } from './dateUtils'

export type MorEventType =
  | 'mor'
  | 'response_due'
  | 'response_submitted'
  | 'follow_up_due'
  | 'follow_up_submitted'
  | 'extension_due'
  | 'extension_submitted'
  | 'extension'
  | 'closed'
  | 'custom'

export interface MorEvent {
  id: string
  type: MorEventType
  date: string | null // YYYY-MM-DD
  note?: string
  label?: string // free-text label, used for 'custom' entries
  original_date?: string | null // a due event's pre-extension date, if extended
}

// Default label shown for each event type in the activity log.
export const EVENT_LABELS: Record<MorEventType, string> = {
  mor: 'MOR',
  response_due: 'Response Due',
  response_submitted: 'Response Submitted',
  follow_up_due: 'Follow-up Requested (due)',
  follow_up_submitted: 'Follow-up Submitted',
  extension_due: 'Extension Requested (due)',
  extension_submitted: 'Response Submitted (after extension)',
  extension: 'Extension requested',
  closed: 'MOR Closed Out',
  custom: 'Note',
}

const DUE_TYPES: MorEventType[] = ['response_due', 'follow_up_due', 'extension_due']
const SUBMIT_TYPES: MorEventType[] = [
  'response_submitted',
  'follow_up_submitted',
  'extension_submitted',
]

export const isDueType = (t: MorEventType) => DUE_TYPES.includes(t)
export const isSubmitType = (t: MorEventType) => SUBMIT_TYPES.includes(t)

// A short id for a new log entry.
export function newEventId(): string {
  try {
    if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) return (crypto as any).randomUUID()
  } catch {}
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// Return the log for a MOR, or synthesize one from the legacy date columns when
// the log hasn't been seeded yet. Never mutates the input.
export function morLog(mor: any): MorEvent[] {
  const raw = mor?.activity_log
  const arr: MorEvent[] = Array.isArray(raw)
    ? raw
    : (() => {
        try {
          const p = typeof raw === 'string' ? JSON.parse(raw) : null
          return Array.isArray(p) ? p : []
        } catch {
          return []
        }
      })()
  if (arr.length > 0) return arr
  return synthesizeLog(mor)
}

// Build a log from the legacy columns (used to seed a MOR the first time and as a
// read fallback on the dashboard before seeding has happened).
export function synthesizeLog(mor: any): MorEvent[] {
  if (!mor) return []
  const out: MorEvent[] = []
  const add = (type: MorEventType, date: any) => {
    if (date) out.push({ id: newEventId(), type, date: String(date).slice(0, 10) })
  }
  add('mor', mor.mor_date)
  add('response_due', mor.response_due_date)
  add('response_submitted', mor.response_submitted_date)
  if (mor.follow_up) {
    add('follow_up_due', mor.follow_up_response_due_date)
    add('follow_up_submitted', mor.follow_up_response_submitted_date)
  }
  if (mor.status === 'Completed') add('closed', mor.mor_date)
  return out
}

const byDateAsc = (a: MorEvent, b: MorEvent) => {
  const da = a.date || '9999-12-31'
  const db = b.date || '9999-12-31'
  return da < db ? -1 : da > db ? 1 : 0
}

// The columns kept in sync with the log, so legacy readers keep working.
export interface MirrorColumns {
  mor_date: string | null
  response_due_date: string | null
  response_submitted_date: string | null
  follow_up: boolean
  follow_up_response_due_date: string | null
  follow_up_response_submitted_date: string | null
}

export function mirrorColumnsFromLog(log: MorEvent[]): MirrorColumns {
  const dated = log.filter((e) => e.date)
  const first = (t: MorEventType) =>
    dated.filter((e) => e.type === t).sort(byDateAsc)[0]?.date || null
  const last = (types: MorEventType[]) =>
    dated.filter((e) => types.includes(e.type)).sort(byDateAsc).slice(-1)[0]?.date || null
  const hasFollowUp = dated.some(
    (e) => e.type === 'follow_up_due' || e.type === 'extension_due'
  )
  return {
    mor_date: first('mor'),
    response_due_date: first('response_due'),
    response_submitted_date: first('response_submitted'),
    follow_up: hasFollowUp,
    follow_up_response_due_date: last(['follow_up_due', 'extension_due']),
    follow_up_response_submitted_date: last(['follow_up_submitted', 'extension_submitted']),
  }
}

export type WorkflowStage =
  | 'closed'
  | 'response_due'
  | 'follow_up_due'
  | 'extension_due'
  | 'response_sent'
  | 'follow_up_sent'
  | 'extension_sent'
  | 'scheduled'
  | 'awaiting_report'
  | null

export interface Workflow {
  stage: WorkflowStage
  date: Date | null
  dateStr: string | null
}

// Derive the single current stage + date for a MOR from its log.
//
// Deadline rule ("earliest open due date"): due-type events are paired with
// submitted-type events by count in date order — the first N due dates (N =
// number of submissions) are considered answered, and the earliest remaining due
// date is the outstanding deadline.
export function deriveWorkflow(mor: any): Workflow {
  const none: Workflow = { stage: null, date: null, dateStr: null }
  if (!mor) return none

  const log = morLog(mor)
  const dated = log.filter((e) => e.date)

  const mk = (stage: WorkflowStage, dateStr: string | null): Workflow => ({
    stage,
    dateStr,
    date: parseDate(dateStr),
  })

  const closed = dated.find((e) => e.type === 'closed')
  if (closed || mor.status === 'Completed') return mk('closed', closed?.date || mor.mor_date || null)

  const dues = dated.filter((e) => isDueType(e.type)).sort(byDateAsc)
  const submits = dated.filter((e) => isSubmitType(e.type)).sort(byDateAsc)

  const openDues = dues.slice(submits.length)
  const openDue = openDues[0]
  if (openDue) {
    const stage: WorkflowStage =
      openDue.type === 'follow_up_due'
        ? 'follow_up_due'
        : openDue.type === 'extension_due'
        ? 'extension_due'
        : 'response_due'
    return mk(stage, openDue.date)
  }

  const lastSubmit = submits.slice(-1)[0]
  if (lastSubmit) {
    const stage: WorkflowStage =
      lastSubmit.type === 'follow_up_submitted'
        ? 'follow_up_sent'
        : lastSubmit.type === 'extension_submitted'
        ? 'extension_sent'
        : 'response_sent'
    return mk(stage, lastSubmit.date)
  }

  const morEvent = dated.find((e) => e.type === 'mor')
  const morDateStr = morEvent?.date || (mor.mor_date ? String(mor.mor_date).slice(0, 10) : null)
  if (morDateStr) {
    const morDate = parseDate(morDateStr)!
    const now = new Date()
    const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    return mk(morDate.getTime() >= todayUTC ? 'scheduled' : 'awaiting_report', morDateStr)
  }

  return none
}

export const isDueStage = (s: WorkflowStage) =>
  s === 'response_due' || s === 'follow_up_due' || s === 'extension_due'
export const isSentStage = (s: WorkflowStage) =>
  s === 'response_sent' || s === 'follow_up_sent' || s === 'extension_sent'
