import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

// Each call reads the PDF, so allow up to the plan's max. The import is split
// into several short calls (one index pass + batched extract passes) so no
// single call approaches the serverless time limit.
export const runtime = 'nodejs'
export const maxDuration = 60

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Basic in-memory rate limiter. One import now makes several calls (index +
// batches), so the per-user budget is generous. Per-instance; resets on cold start.
const RATE_LIMIT = 100
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

// Shared definition of which rows count as a finding requiring a response.
const RULES = `A "finding requiring a response" is anything the owner/agent must act on. Recognize them by ANY of these signals:
- A block labeled "Finding:" or "Repeat Finding:" that has a corrective action. The corrective-action label varies — "Corrective Action:", "Corrective Action Required:", "Correct Action Required:", or "Corrective Action Plan:".
- A narrative item with NO corrective-action label that still asks for a response — for example, one that ends with wording like "Please forward completed work orders and/or target completion dates with your response."

A single Item Number can contain MANY separate findings (for example, one "Summary of Tenant File Review" item may hold a dozen or more "Finding: ... Non-Compliance" blocks) — each is its own finding. Keep all sub-issues, bullet points, and unit-by-unit lists WITHIN one finding together.

SKIP (do not count): blocks labeled "Comment:"; blocks labeled "Observation:" or "Recommendation:" with no corrective action; informational or compliant items (e.g. "all Severe and Life-Threatening findings had been completed", "no issues observed", "residents were complimentary"); general notes and training recommendations.`

const INDEX_PROMPT = `You are indexing the findings in a HUD Management & Occupancy Review (MOR) report (form HUD-9834) that require a response. Reports from different reviewers (PBCAs) are formatted differently — read the content, not a fixed layout.

${RULES}

Output a short INDEX ONLY — do NOT include the finding body text. Provide a "findings" list, one entry per finding requiring a response, in the order they appear, each with these keys:
- "item": the Item Number it falls under (e.g. "A.1", "C.6", "E.22").
- "title": a short label identifying this specific finding — use the "Finding: ..." name if present (e.g. "Screening Non-Compliance"), otherwise a 3-6 word description (e.g. "General Appearance items to correct").
- "due_date": "YYYY-MM-DD" or null. If stated relative to the report (e.g. "30 days from the date of this letter" or "Within 30 days from the date of the report"), compute it from the "Date of Report" on the summary page. If "N/A" or blank, null.

If there are none, return an empty list.`

function buildExtractPrompt(targets: { item: string; title: string }[]) {
  const list = targets.map((t, i) => `${i + 1}. ${t.item} — ${t.title}`).join('\n')
  return `You are extracting the full text of specific findings from a HUD Management & Occupancy Review (MOR) report (form HUD-9834).

Return the verbatim text for ONLY the findings listed below, matched by their Item Number and title. Return EXACTLY one object per requested finding, in the SAME order as listed. If you cannot locate one, still return it with an empty "finding" string.

For each, copy that finding's text VERBATIM with only these changes: (1) remove the standalone "Criteria:", "Cause:", and "Effect:" sections entirely (including any "Overall Cause:" / "Overall Effect:") — but if a section is labeled "Condition and Criteria:", KEEP it; (2) drop the repeating page header/footer that appears mid-finding ("Management Review for Multifamily Housing Projects", "U.S. Department of Housing and Urban Development", "Office of Housing", "OMB Approval No. ...", "form HUD-9834 ...", "Ref. HUD Handbook ...", "Summary", "Page X / Y"). Keep the "Finding:" / "Repeat Finding:" heading when present, the Condition text, every bullet point and unit-by-unit detail, and the corrective-action text including its heading. Do NOT summarize, reword, shorten, paraphrase, or invent anything.

Findings to extract (in this exact order):
${list}

Provide a "findings" list with one object per requested finding (keys "item" and "finding", the verbatim text), in the same order as listed above.`
}

// JSON Schemas for structured outputs — the API guarantees the reply matches.
const INDEX_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['item', 'title', 'due_date'],
        properties: {
          item: { type: 'string' },
          title: { type: 'string' },
          due_date: { type: ['string', 'null'] }
        }
      }
    }
  }
}

const EXTRACT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['findings'],
  properties: {
    findings: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['item', 'finding'],
        properties: {
          item: { type: 'string' },
          finding: { type: 'string' }
        }
      }
    }
  }
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

    if (isRateLimited(user.id)) {
      return NextResponse.json({ error: 'Rate limit exceeded. Please wait a bit and try again.' }, { status: 429 })
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'The server is missing its ANTHROPIC_API_KEY. Add it to the deployment environment variables and redeploy.' }, { status: 500 })
    }
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const { base64PDF, mode, targets } = await request.json()
    if (!base64PDF) {
      return NextResponse.json({ error: 'No PDF provided.' }, { status: 400 })
    }

    const isExtract = mode === 'extract'
    if (isExtract && (!Array.isArray(targets) || targets.length === 0)) {
      return NextResponse.json({ error: 'No findings specified to extract.' }, { status: 400 })
    }

    const promptText = isExtract ? buildExtractPrompt(targets) : INDEX_PROMPT
    const schema = isExtract ? EXTRACT_SCHEMA : INDEX_SCHEMA

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: isExtract ? 8000 : 4000,
      // Structured outputs: the reply is guaranteed to be valid JSON matching the
      // schema, so verbatim finding text (with line breaks) can't break parsing.
      output_config: { format: { type: 'json_schema', schema } },
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
              },
              // Cache the PDF so the index pass and all extract passes reuse it.
              cache_control: { type: 'ephemeral' }
            },
            {
              type: 'text',
              text: promptText
            }
          ]
        }
      ]
    })

    if (response.stop_reason === 'max_tokens') {
      return NextResponse.json({ error: 'A batch of findings was too long to extract in one pass. Try again — if it keeps happening, let support know so the batch size can be lowered.' }, { status: 502 })
    }

    const textBlock = response.content.find((b: any) => b.type === 'text')
    const text = textBlock && textBlock.type === 'text' ? textBlock.text : ''

    let parsed: any
    try {
      parsed = JSON.parse(text.trim())
    } catch {
      return NextResponse.json({ error: 'Could not parse the AI response (not valid JSON). Please try again.' }, { status: 502 })
    }
    const list = Array.isArray(parsed) ? parsed : (parsed?.findings ?? [])

    return isExtract
      ? NextResponse.json({ findings: list })
      : NextResponse.json({ index: list })
  } catch (error: any) {
    console.error('extract-findings error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
