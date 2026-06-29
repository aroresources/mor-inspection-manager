import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

// Reading a multi-page PDF can take longer than the default serverless timeout.
export const runtime = 'nodejs'
export const maxDuration = 60

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

const EXTRACTION_PROMPT = `You are extracting findings from a HUD Management & Occupancy Review (MOR) report on form HUD-9834. The findings are in a table — "Item Number" | "Finding" | "Target Completion Date" — that runs across many pages. Different reviewers (PBCAs) format these reports differently, so read the content, not a fixed layout.

Extract ONE finding for EVERY corrective action / required response in the report. A "required response" is anything the owner/agent must act on. Recognize them by ANY of these signals:
- A block labeled "Finding:" or "Repeat Finding:" that has a corrective action. The corrective-action label varies — it may read "Corrective Action:", "Corrective Action Required:", "Correct Action Required:", or "Corrective Action Plan:".
- A narrative item with NO corrective-action label that still asks for a response — for example, one that ends with wording like "Please forward completed work orders and/or target completion dates with your response."

CRITICAL: a single Item Number can contain MANY separate findings. For example, one "Summary of Tenant File Review" item (e.g. "E.22") may list a dozen or more "Finding: ... Non-Compliance" blocks — output EACH one as its own finding, all sharing that same Item Number. Conversely, keep all the sub-issues, bullet points, and unit-by-unit lists WITHIN a single Finding block together as ONE finding — do not split those.

SKIP (do not create findings for):
- Blocks labeled "Comment:" (informational).
- Blocks labeled "Observation:" or "Recommendation:" that have no corrective action.
- Informational or compliant items (e.g. "all Severe and Life-Threatening findings had been completed", "no issues observed", "residents were complimentary"), general notes, and training recommendations.

For each finding, output an object with exactly these keys:
- "item": the Item Number it falls under, exactly as printed (e.g. "A.1", "C.6", "E.14.g", "E.22").
- "finding": the text of that finding, copied VERBATIM, with only these changes: (1) remove the standalone "Criteria:", "Cause:", and "Effect:" sections entirely (including any "Overall Cause:" / "Overall Effect:") — but if a section is labeled "Condition and Criteria:", KEEP it (do not remove a combined Condition-and-Criteria section); (2) drop the repeating page header/footer that appears mid-finding ("Management Review for Multifamily Housing Projects", "U.S. Department of Housing and Urban Development", "Office of Housing", "OMB Approval No. ...", "form HUD-9834 ...", "Ref. HUD Handbook ...", "Summary", "Page X / Y"). Keep the "Finding:" / "Repeat Finding:" heading when present, the Condition text, every bullet point and unit-by-unit detail, and the corrective-action text including its heading. Do NOT summarize, reword, shorten, paraphrase, or invent anything.
- "due_date": the Target Completion Date as "YYYY-MM-DD", or null. If it is stated relative to the report (e.g. "30 days from the date of this letter" or "Within 30 days from the date of the report"), compute it by adding that many days to the "Date of Report" shown on the summary page. If it says "N/A" or is blank, use null.

Return ONLY a valid JSON array of these objects, with no surrounding text or explanation. If nothing requires a response, return [].`

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
    if (!base64PDF) {
      return NextResponse.json({ error: 'No PDF provided.' }, { status: 400 })
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 16000,
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
              text: EXTRACTION_PROMPT
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
    console.error('extract-findings error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
