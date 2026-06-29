import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Basic in-memory rate limiter: max 10 requests/hour/user.
// Note: this is per-server-instance and resets on cold start. For robust,
// shared limiting use a persistent store (e.g. a Supabase table or Redis).
const RATE_LIMIT = 10
const WINDOW_MS = 60 * 60 * 1000
const requestLog = new Map<string, number[]>()

function isRateLimited(userId: string) {
  const now = Date.now()
  const recent = (requestLog.get(userId) || []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= RATE_LIMIT) {
    requestLog.set(userId, recent)
    return true
  }
  recent.push(now)
  requestLog.set(userId, recent)
  return false
}

export async function POST(request: NextRequest) {
  try {
    // --- Authenticate caller ---
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // --- Rate limit: 10 per hour per user ---
    if (isRateLimited(user.id)) {
      return NextResponse.json({ error: 'Rate limit exceeded. Maximum 10 requests per hour.' }, { status: 429 })
    }

    const { base64PDF } = await request.json()

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 8000,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'document',
              source: {
                type: 'base64',
                media_type: 'application/pdf',
                data: base64PDF
              }
            },
            {
              type: 'text',
             text: 'You are analyzing a HUD MOR report. Extract ONLY findings requiring corrective action (marked C with a Target Completion Date). Do NOT include comments, observations, or recommendations. For findings with multiple issues, create a separate finding for each issue. Return ONLY a JSON array, no other text. Each item must have: item (item number like E.14.g), title (a short title of the finding), condition (the condition/problem description), corrective_action (the required corrective action), due_date (YYYY-MM-DD or null). Do NOT include criteria, cause, or effect. Example: [{"item":"E.14.g","title":"Tenant Selection Plan income limits","condition":"The TSP does not properly address income limits.","corrective_action":"Please revise pages 1 and 7 of the TSP.","due_date":"2025-07-06"}]'
            }
          ]
        }
      ]
    })

    if (response.stop_reason === 'max_tokens') {
      return NextResponse.json({ error: 'The report was too long to extract in one pass. Try a shorter PDF or split it into sections.' }, { status: 502 })
    }

    const textBlock = response.content.find((b: any) => b.type === 'text')
    const text = textBlock && textBlock.type === 'text' ? textBlock.text : ''
    const clean = text.replace(/```json|```/g, '').trim()

    let findings
    try {
      findings = JSON.parse(clean)
    } catch {
      return NextResponse.json({ error: 'Could not parse findings from the report — the AI response was not valid JSON. Please try again.' }, { status: 502 })
    }

    return NextResponse.json({ findings })
  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}