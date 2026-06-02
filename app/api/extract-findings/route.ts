import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
})

export async function POST(request: NextRequest) {
  try {
    const { base64PDF } = await request.json()

    const response = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 4000,
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

    const text = response.content[0].type === 'text' ? response.content[0].text : ''
    const clean = text.replace(/```json|```/g, '').trim()
    const findings = JSON.parse(clean)

    return NextResponse.json({ findings })
  } catch (error: any) {
    console.error('Error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}