// Automated deadline reminder emails for the MOR Inspection Manager.
//
// Triggered daily by a Vercel cron job (see vercel.json). Queries all active
// MORs and emails the super_admins about upcoming and overdue deadlines.
//
// Required environment variables:
//   RESEND_API_KEY            - Resend API key used to send the emails
//   NEXT_PUBLIC_SUPABASE_URL  - Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY - Supabase service role key (bypasses RLS so the
//                               cron can read every property / MOR / profile)
//   CRON_SECRET               - Shared secret. Vercel cron sends it as
//                               "Authorization: Bearer <CRON_SECRET>".
//
// Authentication (either one grants access):
//   1. CRON_SECRET in the Authorization header (used by the Vercel cron job).
//   2. A valid Supabase session access token in the Authorization header
//      belonging to a super_admin user (lets super admins trigger it manually
//      from the app for testing).

import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SITE_URL = 'https://mor-inspection-manager.vercel.app'

// Return a YYYY-MM-DD string for today (+ optional day offset) in US Eastern
// time, so "7 days away" lines up with the 8am EST cron schedule regardless of
// the server's own timezone.
function easternDateString(offsetDays = 0): string {
  const now = new Date()
  const eastern = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
  eastern.setDate(eastern.getDate() + offsetDays)
  const y = eastern.getFullYear()
  const m = String(eastern.getMonth() + 1).padStart(2, '0')
  const d = String(eastern.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// Normalize a date/timestamp column value to a YYYY-MM-DD string (or null).
function toDateOnly(value: unknown): string | null {
  if (!value || typeof value !== 'string') return null
  return value.slice(0, 10)
}

// Human-friendly date, e.g. "June 17, 2026".
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

interface Reminder {
  morId: string
  reminderType: string
  propertyId: string
  propertyName: string
  companyName: string
  deadlineLabel: string
  date: string
}

function buildEmailHtml(r: Reminder): string {
  const propertyUrl = `${SITE_URL}/properties/${r.propertyId}`
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #1f2937;">MOR Deadline Reminder</h2>
      <p style="font-size: 16px;"><strong>${r.deadlineLabel}</strong></p>
      <table style="border-collapse: collapse; margin: 16px 0;">
        <tr>
          <td style="padding: 4px 12px 4px 0; color: #6b7280;">Property</td>
          <td style="padding: 4px 0; font-weight: 600;">${r.propertyName}</td>
        </tr>
        <tr>
          <td style="padding: 4px 12px 4px 0; color: #6b7280;">Company</td>
          <td style="padding: 4px 0; font-weight: 600;">${r.companyName}</td>
        </tr>
        <tr>
          <td style="padding: 4px 12px 4px 0; color: #6b7280;">Date</td>
          <td style="padding: 4px 0; font-weight: 600;">${formatDate(r.date)}</td>
        </tr>
      </table>
      <a href="${propertyUrl}"
         style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 8px 0;">
        View Property
      </a>
      <p style="color: #6b7280; font-size: 13px; margin-top: 24px;">
        This is an automated reminder from the MOR Inspection Manager.
      </p>
    </div>
  `
}

// Authorize a request via either the CRON_SECRET (cron job) or a valid Supabase
// session token belonging to a super_admin (manual trigger from the app).
async function isAuthorized(request: NextRequest): Promise<boolean> {
  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : ''
  if (!token) return false

  // 1) Cron job: the secret matches exactly.
  if (process.env.CRON_SECRET && token === process.env.CRON_SECRET) {
    return true
  }

  // 2) Manual trigger: the token is a valid Supabase session for a super_admin.
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !user) return false

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  return profile?.role === 'super_admin'
}

export async function GET(request: NextRequest) {
  if (!(await isAuthorized(request))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const today = easternDateString(0)
    const in7Days = easternDateString(7)
    const in30Days = easternDateString(30)
    console.log('[send-reminders] Date windows:', { today, in7Days, in30Days })

    // Recipients: every super_admin with an email address.
    const { data: admins, error: adminsError } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('role', 'super_admin')

    if (adminsError) {
      console.error('[send-reminders] Error querying super_admin profiles:', adminsError)
      throw new Error(adminsError.message)
    }

    console.log('[send-reminders] super_admin profiles found:', admins?.length ?? 0)

    const recipients = (admins || [])
      .map((a: { email: string | null }) => a.email)
      .filter((e): e is string => !!e)

    console.log('[send-reminders] super_admin recipients with an email:', recipients.length, recipients)

    if (recipients.length === 0) {
      console.log('[send-reminders] No super_admin recipients found — exiting without sending.')
      return NextResponse.json({ message: 'No super_admin recipients found.', sent: 0 })
    }

    // All active MORs, with their property and company names.
    const { data: mors, error: morsError } = await supabaseAdmin
      .from('mors')
      .select('id, status, mor_date, response_due_date, property_id, properties(id, name, companies(name))')
      .eq('status', 'Active')

    if (morsError) {
      console.error('[send-reminders] Error querying active MORs:', morsError)
      throw new Error(morsError.message)
    }

    console.log('[send-reminders] Active MORs found:', mors?.length ?? 0)

    const reminders: Reminder[] = []

    for (const mor of mors || []) {
      // Supabase types the nested relation as an object; cast defensively.
      const property: any = Array.isArray((mor as any).properties)
        ? (mor as any).properties[0]
        : (mor as any).properties
      if (!property) continue

      const company: any = Array.isArray(property.companies)
        ? property.companies[0]
        : property.companies

      const propertyId: string = property.id || (mor as any).property_id
      const propertyName: string = property.name || 'Unnamed Property'
      const companyName: string = company?.name || 'Unknown Company'

      const responseDue = toDateOnly((mor as any).response_due_date)
      const morDate = toDateOnly((mor as any).mor_date)

      // Range-based checks (YYYY-MM-DD strings compare correctly with </<=).
      const isOverdue = responseDue !== null && responseDue < today
      const responseDueSoon = responseDue !== null && responseDue >= today && responseDue <= in7Days
      const scheduledSoon = morDate !== null && morDate >= today && morDate <= in30Days

      console.log('[send-reminders] Checking MOR:', {
        morId: (mor as any).id,
        property: propertyName,
        responseDue,
        morDate,
        isOverdue,
        responseDueSoon,
        scheduledSoon,
      })

      const morId: string = (mor as any).id

      // Response deadline reminders.
      if (isOverdue) {
        reminders.push({
          morId,
          reminderType: 'response_overdue',
          propertyId,
          propertyName,
          companyName,
          deadlineLabel: 'MOR response is OVERDUE',
          date: responseDue!,
        })
      } else if (responseDueSoon) {
        reminders.push({
          morId,
          reminderType: 'response_due_soon',
          propertyId,
          propertyName,
          companyName,
          deadlineLabel: 'MOR response is due within 7 days',
          date: responseDue!,
        })
      }

      // Scheduled MOR reminder (any MOR scheduled within the next 30 days).
      if (scheduledSoon) {
        reminders.push({
          morId,
          reminderType: 'mor_scheduled_soon',
          propertyId,
          propertyName,
          companyName,
          deadlineLabel: 'MOR is scheduled within 30 days',
          date: morDate!,
        })
      }
    }

    // Send one email per reminder to all super_admins, skipping any reminder of
    // the same type already sent for the same MOR in the last 6 days (so each
    // reminder type sends at most once per week per MOR).
    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()

    let sent = 0
    let skipped = 0
    const errors: string[] = []
    for (const reminder of reminders) {
      try {
        const { data: existing, error: existingError } = await supabaseAdmin
          .from('sent_reminders')
          .select('id')
          .eq('mor_id', reminder.morId)
          .eq('reminder_type', reminder.reminderType)
          .gte('sent_at', sixDaysAgo)
          .limit(1)

        if (existingError) {
          console.error('[send-reminders] Error checking sent_reminders:', existingError)
          throw new Error(existingError.message)
        }

        if (existing && existing.length > 0) {
          console.log('[send-reminders] Skipping (already sent in last 6 days):', {
            morId: reminder.morId,
            reminderType: reminder.reminderType,
          })
          skipped++
          continue
        }

        await resend.emails.send({
          from: 'MOR Inspection Manager <onboarding@resend.dev>',
          to: recipients,
          subject: `${reminder.deadlineLabel}: ${reminder.propertyName}`,
          html: buildEmailHtml(reminder),
        })
        sent++

        const { error: insertError } = await supabaseAdmin
          .from('sent_reminders')
          .insert([{ mor_id: reminder.morId, reminder_type: reminder.reminderType }])
        if (insertError) {
          console.error('[send-reminders] Error recording sent reminder:', insertError)
        }
      } catch (err: any) {
        errors.push(`${reminder.propertyName} (${reminder.deadlineLabel}): ${err.message}`)
      }
    }

    console.log('[send-reminders] Summary:', {
      remindersFound: reminders.length,
      sent,
      skipped,
      recipients: recipients.length,
      errors,
    })

    return NextResponse.json({
      success: true,
      remindersFound: reminders.length,
      sent,
      skipped,
      recipients: recipients.length,
      errors,
    })
  } catch (error: any) {
    console.error('Reminder cron error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
