import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

// Summarize a MOR into a prep brief — either by scanning an uploaded PDF, or
// from the findings + responses already stored for a prior MOR.
export const runtime = 'nodejs'
export const maxDuration = 60

const supabaseAuth = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

const RATE_LIMIT = 60
const WINDOW_MS = 60 * 60 * 1000
const requestLog = new Map<string, number[]>()
function isRateLimited(userId: string) {
  const now = Date.now()
  const recent = (requestLog.get(userId) || []).filter((t) => now - t < WINDOW_MS)
  if (recent.length >= RATE_LIMIT) { requestLog.set(userId, recent); return true }
  recent.push(now); requestLog.set(userId, recent); return false
}

const OUTPUT_SHAPE = `Write the brief in GitHub-flavored Markdown with exactly these three sections and nothing before or after:

## Major issues to resolve
- One bullet per significant problem, most important first. Say what it is and where (units/area) if the source gives it. Keep each bullet to one or two lines.

## Recurring / repeat issues
- Anything flagged as a "Repeat Finding", or a theme that clearly recurs (e.g. tenant-file/EIV errors, deferred maintenance). If none are clearly recurring, write a single bullet: "None clearly identified."

## Prep checklist
- 3 to 8 concrete, actionable items to complete before the next MOR so these do not recur.

Be specific and practical. Do not invent issues that are not supported by the source. Do not add a title or closing commentary.`

const PDF_PROMPT = `You are helping a property manager at an affordable-housing site prepare for their NEXT HUD Management & Occupancy Review (MOR). The attached PDF is their most recent MOR report (HUD form HUD-9834, formats vary by reviewer). Read it and produce a prep brief of what to fix now.

${OUTPUT_SHAPE}`

function findingsPrompt(findings: any[]) {
  const lines = findings.map((f: any, i: number) => {
    const status = f.status ? ` [status: ${f.status}]` : ''
    const resp = f.response ? `\n   Response: ${String(f.response).replace(/\s+/g, ' ').trim()}` : '\n   Response: (none recorded)'
    return `${i + 1}. ${String(f.finding || '').replace(/\s+/g, ' ').trim()}${status}${resp}`
  }).join('\n')
  return `You are helping a property manager prepare for their NEXT HUD Management & Occupancy Review (MOR). Below are the findings and the owner/agent responses from the property's most recent MOR. Use the status and response to note whether each was addressed or is still open.

${OUTPUT_SHAPE}

FINDINGS AND RESPONSES:
${lines}`
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
    if (authError || !user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    if (isRateLimited(user.id)) return NextResponse.json({ error: 'Rate limit exceeded. Please wait a bit and try again.' }, { status: 429 })
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ error: 'The server is missing its ANTHROPIC_API_KEY. Add it to the deployment environment variables and redeploy.' }, { status: 500 })
    }
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

    const { base64PDF, findings } = await request.json()
    let content: any[]
    if (base64PDF) {
      content = [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64PDF } },
        { type: 'text', text: PDF_PROMPT },
      ]
    } else if (Array.isArray(findings) && findings.length > 0) {
      content = [{ type: 'text', text: findingsPrompt(findings) }]
    } else {
      return NextResponse.json({ error: 'Provide either a PDF or a non-empty findings list.' }, { status: 400 })
    }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 2500,
      messages: [{ role: 'user', content }],
    })
    const textBlock = response.content.find((b: any) => b.type === 'text')
    const summary = textBlock && textBlock.type === 'text' ? textBlock.text.trim() : ''
    if (!summary) return NextResponse.json({ error: 'The summary came back empty. Please try again.' }, { status: 502 })
    return NextResponse.json({ summary })
  } catch (error: any) {
    console.error('summarize-mor error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
