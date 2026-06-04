import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const resend = new Resend(process.env.RESEND_API_KEY)

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const VALID_ROLES = ['super_admin', 'asset_manager', 'property_manager']

export async function POST(request: NextRequest) {
  try {
    // --- Authenticate caller and require super_admin ---
    const authHeader = request.headers.get('authorization') || ''
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: { user: caller }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !caller) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', caller.id)
      .single()

    if (!callerProfile || callerProfile.role !== 'super_admin') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 })
    }

    const { email, full_name, role, company_id } = await request.json()

    // Validate requested role
    const safeRole = role || 'property_manager'
    if (!VALID_ROLES.includes(safeRole)) {
      return NextResponse.json({ error: 'Invalid role' }, { status: 400 })
    }

    // Create user in Supabase
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: Math.random().toString(36).slice(-12) + 'A1!',
      email_confirm: true
    })

    if (userError) throw new Error(userError.message)

    // Create profile
    await supabaseAdmin.from('profiles').insert([{
      id: userData.user.id,
      email,
      full_name,
      role: safeRole,
      company_id: company_id || null
    }])

    // Generate password reset link
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: 'recovery',
      email
    })

    if (linkError) throw new Error(linkError.message)

    // Send invite email
    await resend.emails.send({
      from: 'MOR Inspection Manager <onboarding@resend.dev>',
      to: email,
      subject: 'You have been invited to MOR Inspection Manager',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Welcome to MOR Inspection Manager</h2>
          <p>Hi ${full_name || email},</p>
          <p>You have been invited to access the MOR Inspection Manager.</p>
          <p>Click the button below to set your password and get started:</p>
          <a href="${linkData.properties.action_link}" 
             style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 16px 0;">
            Set Your Password
          </a>
          <p>This link will expire in 24 hours.</p>
          <p>If you have any questions, please contact your administrator.</p>
        </div>
      `
    })

    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Invite error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}