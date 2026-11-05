'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../components/ToastProvider'
import { saveAs } from 'file-saver'
import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx'
import {
  EIV_SECTIONS, EIV_SCHEDULE, EIV_ROLES, scheduleFrequency, scheduleFiling, scheduleIncluded,
  type EivSettings, type ListItem, type ScheduleRow, type ScheduleChoice, type RosterEntry,
} from '../../../lib/eivTemplate'

const uid = () => { try { if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) return (crypto as any).randomUUID() } catch {} return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }

// A company-wide default bundle stored in company_doc_settings.settings (one jsonb).
interface CompanyDoc { storageDetail?: string; schedule?: Record<string, ScheduleChoice>; roster?: RosterEntry[]; overrides?: Record<string, string>; customItems?: any[] }

// ---------------------------------------------------------------------------
// Composition: resolve the template into a flat list of render blocks.
// ---------------------------------------------------------------------------
type RBlock =
  | { k: 'h2'; text: string }
  | { k: 'h3'; text: string }
  | { k: 'p'; text: string }
  | { k: 'li'; text: string; level: number }
  | { k: 'roster'; rows: { name: string; role: string }[] }
  | { k: 'schedule' }
  | { k: 'pagebreak' }
  | { k: 'schedulePoster' }

const resolveText = (text: string, merge: Record<string, string>, settings: EivSettings) =>
  text
    .replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => merge[k] || `[${k}]`)
    .replace(/\[\[storage\]\]/g, 'secure, locked storage location in a secure area' + (settings.storageDetail ? ` (specifically, ${settings.storageDetail})` : ''))

const pushListItems = (out: RBlock[], items: ListItem[], merge: Record<string, string>, settings: EivSettings, level = 0) => {
  for (const it of items) {
    if (typeof it === 'string') out.push({ k: 'li', text: resolveText(it, merge, settings), level })
    else {
      out.push({ k: 'li', text: resolveText(it.text, merge, settings), level })
      if (it.sub) pushListItems(out, it.sub, merge, settings, level + 1)
    }
  }
}

function composeEiv(merge: Record<string, string>, settings: EivSettings, overrides: Record<string, string>, customItems: any[]): RBlock[] {
  const out: RBlock[] = []
  for (const section of EIV_SECTIONS) {
    // The EIV Schedule gets its own page as a large, post-on-the-wall reference sheet.
    if (section.id === 'eiv_schedule') {
      out.push({ k: 'pagebreak' })
      out.push({ k: 'schedulePoster' })
      continue
    }
    out.push({ k: 'h2', text: section.title })
    const ov = overrides[section.id]
    if (ov && ov.trim()) {
      for (const para of ov.split(/\n{2,}/)) if (para.trim()) out.push({ k: 'p', text: para.trim() })
    } else {
      for (const b of section.blocks) {
        if (b.k === 'p') out.push({ k: 'p', text: resolveText(b.text, merge, settings) })
        else if (b.k === 'h') out.push({ k: 'h3', text: b.text })
        else if (b.k === 'ul') pushListItems(out, b.items, merge, settings)
        else if (b.k === 'roster') { if ((settings.roster || []).length) out.push({ k: 'roster', rows: settings.roster! }) }
        else if (b.k === 'schedule') out.push({ k: 'schedule' })
      }
    }
    // Custom items (company-wide + property-specific) appended to their section.
    for (const ci of customItems.filter((c: any) => c.sectionId === section.id && c.text?.trim())) {
      out.push({ k: 'li', text: ci.text.trim(), level: 0 })
    }
  }
  return out
}

// Schedule rows resolved for the chosen settings.
const scheduleData = (settings: EivSettings) =>
  EIV_SCHEDULE.filter((r) => r.group || scheduleIncluded(r, settings)).map((r) =>
    r.group ? { group: r.group } : { report: r.report!, freq: scheduleFrequency(r, settings), filing: scheduleFiling(r, settings) })

// Per-key merge of two schedule maps (b wins field-by-field over a).
const mergeSchedules = (a?: Record<string, ScheduleChoice>, b?: Record<string, ScheduleChoice>) => {
  const out: Record<string, ScheduleChoice> = {}
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})])
  for (const k of keys) out[k] = { ...(a?.[k] || {}), ...(b?.[k] || {}) }
  return out
}

type Scope = 'property' | 'company'

export default function PropertyDocumentsTab({ propertyId, property }: any) {
  const { toast } = useToast()
  const companyId = property?.company_id || null
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [docType] = useState('eiv')
  const [scope, setScope] = useState<Scope>('property')
  const [role, setRole] = useState<string>('')

  // Layer 3 — this property.
  const [settings, setSettings] = useState<EivSettings>({})
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [customItems, setCustomItems] = useState<any[]>([])
  // Layer 2 — company defaults (stored as one jsonb in company_doc_settings.settings).
  const [co, setCo] = useState<CompanyDoc>({})

  const [editSection, setEditSection] = useState<string>('')
  const [overrideDraft, setOverrideDraft] = useState('')

  useEffect(() => { load() }, [propertyId, companyId])

  const load = async () => {
    setLoading(true)
    const [{ data: { user } }, propRes, coRes] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('property_doc_settings').select('*').eq('property_id', propertyId).eq('doc_type', 'eiv').maybeSingle(),
      companyId
        ? supabase.from('company_doc_settings').select('*').eq('company_id', companyId).eq('doc_type', 'eiv').maybeSingle()
        : Promise.resolve({ data: null } as any),
    ])
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle()
      setRole(profile?.role || '')
    }
    const p = propRes.data
    if (p) { setSettings(p.settings || {}); setOverrides(p.overrides || {}); setCustomItems(Array.isArray(p.custom_items) ? p.custom_items : []) }
    else { setSettings({}); setOverrides({}); setCustomItems([]) }
    setCo((coRes?.data?.settings as CompanyDoc) || {})
    setLoading(false)
  }

  const canEditCompany = role === 'super_admin' || role === 'asset_manager'
  const readOnly = scope === 'company' && !canEditCompany

  // --- Persistence --------------------------------------------------------
  const persistProperty = async (nextSettings: EivSettings, nextOverrides: Record<string, string>, nextCustom: any[]) => {
    setSaving(true)
    const { error } = await supabase.from('property_doc_settings').upsert(
      { property_id: propertyId, doc_type: docType, settings: nextSettings, overrides: nextOverrides, custom_items: nextCustom, updated_at: new Date().toISOString() },
      { onConflict: 'property_id,doc_type' }
    )
    setSaving(false)
    if (error) toast('Could not save — make sure the property_documents.sql migration has been run. (' + error.message + ')', 'error')
  }
  const persistCompany = async (next: CompanyDoc) => {
    if (!companyId) { toast('Assign this property to a company before editing company defaults.', 'warning'); return }
    setSaving(true)
    const { error } = await supabase.from('company_doc_settings').upsert(
      { company_id: companyId, doc_type: docType, settings: next, updated_at: new Date().toISOString() },
      { onConflict: 'company_id,doc_type' }
    )
    setSaving(false)
    if (error) toast('Could not save company default. (' + error.message + ')', 'error')
  }

  // --- Scope-aware active config (what the editors read/write) -------------
  const curSettings: EivSettings = scope === 'company'
    ? { storageDetail: co.storageDetail, schedule: co.schedule, roster: co.roster }
    : settings
  const curOverrides = scope === 'company' ? (co.overrides || {}) : overrides
  const curCustom = scope === 'company' ? (co.customItems || []) : customItems

  const saveSettings = (next: EivSettings) => {
    if (scope === 'company') { const n = { ...co, storageDetail: next.storageDetail, schedule: next.schedule, roster: next.roster }; setCo(n); persistCompany(n) }
    else { setSettings(next); persistProperty(next, overrides, customItems) }
  }
  const saveOverrides = (next: Record<string, string>) => {
    if (scope === 'company') { const n = { ...co, overrides: next }; setCo(n); persistCompany(n) }
    else { setOverrides(next); persistProperty(settings, next, customItems) }
  }
  const saveCustom = (next: any[]) => {
    if (scope === 'company') { const n = { ...co, customItems: next }; setCo(n); persistCompany(n) }
    else { setCustomItems(next); persistProperty(settings, overrides, next) }
  }

  // --- Effective (resolved) config used for generation + inheritance hints -
  const merge: Record<string, string> = {
    sitename: property?.name || '',
    address: property?.address || '',
    phone: settings.merge?.phone || '',
    company: property?.companies?.name || '',
  }
  const effSettings: EivSettings = {
    merge: settings.merge,
    storageDetail: settings.storageDetail ?? co.storageDetail,
    roster: (settings.roster && settings.roster.length) ? settings.roster : (co.roster || []),
    schedule: mergeSchedules(co.schedule, settings.schedule),
  }
  const effOverrides = { ...(co.overrides || {}), ...overrides }
  const effCustom = [...(co.customItems || []), ...customItems]

  const setMerge = (k: string, v: string) => { setSettings({ ...settings, merge: { ...(settings.merge || {}), [k]: v } }); persistProperty({ ...settings, merge: { ...(settings.merge || {}), [k]: v } }, overrides, customItems) }

  // --- Schedule editing (scope-aware) -------------------------------------
  const compChoice = (key: string): ScheduleChoice => co.schedule?.[key] || {}
  const propChoice = (key: string): ScheduleChoice => settings.schedule?.[key] || {}
  const shownChoice = (key: string): ScheduleChoice => scope === 'company' ? compChoice(key) : { ...compChoice(key), ...propChoice(key) }
  const setSchedule = (key: string, patch: any) => {
    if (scope === 'company') {
      const next = { ...co, schedule: { ...(co.schedule || {}), [key]: { ...(co.schedule?.[key] || {}), ...patch } } }
      setCo(next); persistCompany(next)
    } else {
      const next = { ...settings, schedule: { ...(settings.schedule || {}), [key]: { ...(settings.schedule?.[key] || {}), ...patch } } }
      setSettings(next); persistProperty(next, overrides, customItems)
    }
  }

  // --- Roster (scope-aware) ----------------------------------------------
  const roster = curSettings.roster || []
  const addRoster = () => saveSettings({ ...curSettings, roster: [...roster, { name: '', role: EIV_ROLES[1] }] })
  const updateRoster = (i: number, patch: any) => saveSettings({ ...curSettings, roster: roster.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) })
  const removeRoster = (i: number) => saveSettings({ ...curSettings, roster: roster.filter((_, idx) => idx !== i) })

  // --- Overrides ----------------------------------------------------------
  const defaultSectionText = (sectionId: string) => {
    const blocks = composeEiv(merge, effSettings, {}, []) // rendered with no overrides
    const lines: string[] = []
    let inSection = false
    for (const b of blocks) {
      if (b.k === 'h2') { inSection = EIV_SECTIONS.find((s) => s.title === b.text)?.id === sectionId; continue }
      if (!inSection) continue
      if (b.k === 'p') lines.push(b.text)
      else if (b.k === 'h3') lines.push(b.text)
      else if (b.k === 'li') lines.push((b.level ? '   - ' : '- ') + b.text)
    }
    return lines.join('\n\n')
  }
  // Prefill: this scope's own override → (property scope) company override → template default.
  const openEdit = (sectionId: string) => {
    const own = curOverrides[sectionId]
    const inherited = scope === 'property' ? co.overrides?.[sectionId] : undefined
    setEditSection(sectionId)
    setOverrideDraft(own || inherited || defaultSectionText(sectionId))
  }
  const saveEdit = () => { saveOverrides({ ...curOverrides, [editSection]: overrideDraft }); setEditSection('') }
  const clearOverride = (sectionId: string) => { const n = { ...curOverrides }; delete n[sectionId]; saveOverrides(n) }

  // --- Custom items -------------------------------------------------------
  const addCustom = () => saveCustom([...curCustom, { id: uid(), sectionId: EIV_SECTIONS[0].id, text: '' }])
  const updateCustom = (id: string, patch: any) => saveCustom(curCustom.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  const removeCustom = (id: string) => saveCustom(curCustom.filter((c) => c.id !== id))

  // --- Generation ---------------------------------------------------------
  const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const title = 'EIV Policies & Procedures'
  const headerLines = [merge.sitename, merge.address, merge.phone].filter(Boolean)

  const generatePDF = () => {
    const blocks = composeEiv(merge, effSettings, effOverrides, effCustom)
    let body = `<h1>${esc(title)}</h1><p class="sub">for the use of HUD’s Enterprise Income Verification (EIV) System</p>`
    body += `<p class="hdr">${headerLines.map(esc).join('<br>')}</p><hr>`
    for (const b of blocks) {
      if (b.k === 'h2') body += `<h2>${esc(b.text)}</h2>`
      else if (b.k === 'h3') body += `<h3>${esc(b.text)}</h3>`
      else if (b.k === 'p') body += `<p>${esc(b.text)}</p>`
      else if (b.k === 'li') body += `<p class="li${b.level}">• ${esc(b.text)}</p>`
      else if (b.k === 'roster') body += `<table><tr><th>Name</th><th>Role</th></tr>${b.rows.map((r) => `<tr><td>${esc(r.name)}</td><td>${esc(r.role)}</td></tr>`).join('')}</table>`
      else if (b.k === 'schedule') {
        body += `<table><tr><th>Report</th><th>Frequency</th><th>Filed / retained in</th></tr>`
        for (const row of scheduleData(effSettings)) {
          if ((row as any).group) body += `<tr><td colspan="3" class="grp">${esc((row as any).group)}</td></tr>`
          else body += `<tr><td>${esc((row as any).report)}</td><td>${esc((row as any).freq)}</td><td>${esc((row as any).filing)}</td></tr>`
        }
        body += `</table>`
      }
      else if (b.k === 'pagebreak') body += `<div class="pb"></div>`
      else if (b.k === 'schedulePoster') {
        body += `<div class="poster"><div class="poster-head"><div class="poster-kicker">EIV Report Schedule</div>`
        body += `<div class="poster-sub">${esc(merge.sitename || 'Property')}${merge.company ? ' · ' + esc(merge.company) : ''}</div>`
        body += `<div class="poster-note">Post for staff reference</div></div>`
        body += `<table class="sched"><thead><tr><th class="rep">Report</th><th class="freq">How often</th><th>Where it is filed / retained</th></tr></thead><tbody>`
        let alt = 0
        for (const row of scheduleData(effSettings)) {
          if ((row as any).group) { body += `<tr class="grp"><td colspan="3">${esc((row as any).group)}</td></tr>`; alt = 0 }
          else {
            body += `<tr class="${alt % 2 ? 'odd' : ''}"><td class="rep">${esc((row as any).report)}</td><td class="freq">${esc((row as any).freq)}</td><td class="file">${esc((row as any).filing)}</td></tr>`
            alt++
          }
        }
        body += `</tbody></table>`
        body += `<div class="legend"><strong>Key:</strong> MI = Move-In · AR = Annual Recertification · IR = Interim Recertification. “Quarterly” reports may be run monthly at this property’s option.</div>`
        body += `</div>`
      }
    }
    const w = window.open('', '_blank')
    if (!w) { toast('Please allow pop-ups to print.', 'warning'); return }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:12px;line-height:1.5;margin:28px;}
      h1{font-size:22px;margin:0;} .sub{color:#555;margin:2px 0 8px;} .hdr{color:#333;margin:0 0 6px;}
      h2{font-size:16px;margin:20px 0 6px;border-bottom:2px solid #333;padding-bottom:3px;}
      h3{font-size:13px;margin:12px 0 4px;color:#1d4ed8;} p{margin:0 0 6px;} .li0{margin-left:18px;} .li1{margin-left:40px;}
      table{border-collapse:collapse;width:100%;margin:8px 0 14px;} th,td{border:1px solid #999;padding:5px 7px;text-align:left;vertical-align:top;}
      th{background:#f0f0f0;} .grp{background:#eef;font-weight:bold;}
      /* EIV Schedule poster (its own page) */
      .pb{page-break-before:always;height:0;}
      .poster{padding-top:6px;}
      .poster-head{text-align:center;margin:0 0 20px;}
      .poster-kicker{font-size:30px;font-weight:800;color:#1e1b4b;letter-spacing:.5px;line-height:1.1;}
      .poster-sub{font-size:15px;color:#4338ca;font-weight:600;margin-top:6px;}
      .poster-note{font-size:12px;color:#9ca3af;text-transform:uppercase;letter-spacing:2px;margin-top:4px;}
      .sched{border-collapse:separate;border-spacing:0;width:100%;margin:0;font-size:14px;border:1px solid #d4d4e4;border-radius:12px;overflow:hidden;}
      .sched th{background:#312e81;color:#fff;font-size:12px;letter-spacing:.6px;text-transform:uppercase;padding:13px 16px;border:none;}
      .sched td{padding:13px 16px;border:none;border-top:1px solid #ececf3;vertical-align:top;font-size:14px;}
      .sched tr.odd td{background:#f7f7fc;}
      .sched td.rep{font-weight:700;color:#1e1b4b;width:38%;}
      .sched td.freq{width:24%;color:#111;}
      .sched td.file{color:#444;}
      .sched tr.grp td{background:#4338ca;color:#fff;font-weight:700;text-transform:uppercase;letter-spacing:.8px;font-size:12px;padding:10px 16px;border-top:none;}
      .legend{margin-top:16px;font-size:12px;color:#6b7280;line-height:1.5;}
      @media print{h2{page-break-after:avoid;}tr{page-break-inside:avoid;}.poster{padding-top:0;}}
    </style></head><body>${body}<script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>`)
    w.document.close()
  }

  const generateWord = async () => {
    const blocks = composeEiv(merge, effSettings, effOverrides, effCustom)
    const children: any[] = []
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: title, bold: true, size: 40 })] }))
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'for the use of HUD’s Enterprise Income Verification (EIV) System', italics: true, size: 20 })] }))
    for (const line of headerLines) children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: line, size: 20 })] }))
    children.push(new Paragraph({ children: [] }))

    const cell = (t: string, head = false) => new TableCell({ width: { size: 33, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: t, bold: head, size: 18 })] })] })

    for (const b of blocks) {
      if (b.k === 'h2') children.push(new Paragraph({ spacing: { before: 300, after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '333333' } }, children: [new TextRun({ text: b.text, bold: true, size: 28 })] }))
      else if (b.k === 'h3') children.push(new Paragraph({ spacing: { before: 160 }, children: [new TextRun({ text: b.text, bold: true, size: 24, color: '1D4ED8' })] }))
      else if (b.k === 'p') children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: b.text, size: 22 })] }))
      else if (b.k === 'li') children.push(new Paragraph({ spacing: { after: 40 }, indent: { left: 360 + b.level * 360 }, children: [new TextRun({ text: (b.level ? '◦ ' : '• ') + b.text, size: 22 })] }))
      else if (b.k === 'roster') {
        children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: [cell('Name', true), cell('Role', true)] }), ...b.rows.map((r) => new TableRow({ children: [cell(r.name), cell(r.role)] }))] }))
        children.push(new Paragraph({ children: [] }))
      } else if (b.k === 'schedule') {
        const rows = [new TableRow({ children: [cell('Report', true), cell('Frequency', true), cell('Filed / retained in', true)] })]
        for (const row of scheduleData(effSettings)) {
          if ((row as any).group) rows.push(new TableRow({ children: [new TableCell({ columnSpan: 3, shading: { fill: 'EEEEFF' } as any, children: [new Paragraph({ children: [new TextRun({ text: (row as any).group, bold: true, size: 18 })] })] })] }))
          else rows.push(new TableRow({ children: [cell((row as any).report), cell((row as any).freq), cell((row as any).filing)] }))
        }
        children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }))
        children.push(new Paragraph({ children: [] }))
      } else if (b.k === 'pagebreak') {
        // handled together with the poster below
      } else if (b.k === 'schedulePoster') {
        const margin = { top: 90, bottom: 90, left: 140, right: 140 } as any
        const headCell = (t: string, w: number) => new TableCell({ width: { size: w, type: WidthType.PERCENTAGE }, shading: { fill: '312E81' } as any, margins: margin, children: [new Paragraph({ children: [new TextRun({ text: t.toUpperCase(), bold: true, color: 'FFFFFF', size: 18 })] })] })
        const dataCell = (t: string, w: number, strong = false) => new TableCell({ width: { size: w, type: WidthType.PERCENTAGE }, margins: margin, children: [new Paragraph({ children: [new TextRun({ text: t, bold: strong, color: strong ? '1E1B4B' : '222222', size: 21 })] })] })
        const groupRow = (t: string) => new TableRow({ children: [new TableCell({ columnSpan: 3, shading: { fill: '4338CA' } as any, margins: { ...margin, top: 70, bottom: 70 }, children: [new Paragraph({ children: [new TextRun({ text: t.toUpperCase(), bold: true, color: 'FFFFFF', size: 18 })] })] })] })

        children.push(new Paragraph({ pageBreakBefore: true, alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'EIV Report Schedule', bold: true, size: 48, color: '1E1B4B' })] }))
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [new TextRun({ text: [merge.sitename, merge.company].filter(Boolean).join(' · ') || 'Property', bold: true, size: 22, color: '4338CA' })] }))
        children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 220 }, children: [new TextRun({ text: 'POST FOR STAFF REFERENCE', size: 16, color: '9CA3AF' })] }))

        const rows = [new TableRow({ tableHeader: true, children: [headCell('Report', 38), headCell('How often', 24), headCell('Where it is filed / retained', 38)] })]
        for (const row of scheduleData(effSettings)) {
          if ((row as any).group) rows.push(groupRow((row as any).group))
          else rows.push(new TableRow({ children: [dataCell((row as any).report, 38, true), dataCell((row as any).freq, 24), dataCell((row as any).filing, 38)] }))
        }
        const thin = { style: BorderStyle.SINGLE, size: 2, color: 'D4D4E4' }
        children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: thin, bottom: thin, left: thin, right: thin, insideHorizontal: thin, insideVertical: thin } as any, rows }))
        children.push(new Paragraph({ spacing: { before: 200 }, children: [new TextRun({ text: 'Key: MI = Move-In · AR = Annual Recertification · IR = Interim Recertification. “Quarterly” reports may be run monthly at this property’s option.', size: 16, color: '6B7280' })] }))
      }
    }
    const blob = await Packer.toBlob(new Document({ sections: [{ children }] }))
    saveAs(blob, `EIV-Policy-and-Procedure-${(property?.name || 'Property').replace(/[^a-zA-Z0-9]/g, '_')}.docx`)
  }

  if (loading) return <div className="bg-white rounded-lg shadow p-6 text-gray-500">Loading documents…</div>

  const overriddenCount = Object.keys(curOverrides).filter((k) => curOverrides[k]?.trim()).length
  const isCompany = scope === 'company'
  const companyLabel = property?.companies?.name || 'the company'

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Property Documents</h2>
            <p className="text-xs text-gray-500">EIV Policy &amp; Procedure{saving ? ' · saving…' : ''}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={generateWord} className="bg-blue-700 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-800">📝 Generate Word</button>
            <button onClick={generatePDF} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700">📄 Generate PDF</button>
          </div>
        </div>

        {/* Scope switcher */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t pt-3">
          <span className="text-xs font-medium text-gray-500">Editing:</span>
          <div className="inline-flex rounded-md border border-gray-300 overflow-hidden text-sm">
            <button onClick={() => setScope('property')} className={`px-3 py-1.5 ${!isCompany ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>This property</button>
            <button onClick={() => setScope('company')} className={`px-3 py-1.5 border-l border-gray-300 ${isCompany ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>Company default</button>
          </div>
          <span className="text-xs text-gray-500">
            {isCompany
              ? `Changes apply to every ${companyLabel} property that hasn’t set its own value.`
              : `Values fall back to ${companyLabel}’s company defaults where you leave them blank.`}
          </span>
        </div>
        {isCompany && !companyId && (
          <p className="mt-2 text-xs text-amber-600">This property isn’t assigned to a company, so there are no company defaults to edit. Assign it on the Overview tab.</p>
        )}
        {readOnly && (
          <p className="mt-2 text-xs text-amber-600">You can view company defaults, but only an asset manager or admin can change them.</p>
        )}
        {!isCompany && (
          <p className="mt-2 text-xs text-gray-400">The generated document always combines the company defaults with this property’s own values.</p>
        )}
      </div>

      <fieldset disabled={readOnly} className={readOnly ? 'opacity-60 space-y-4' : 'space-y-4'}>
      {/* Property info (merge fields) — property scope only */}
      {!isCompany && (
        <div className="bg-white rounded-lg shadow p-4">
          <h3 className="text-sm font-bold text-gray-800 mb-3">Property Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Info label="Property name" value={merge.sitename || '—'} />
            <Info label="Management company" value={merge.company || '—'} />
            <Info label="Address" value={merge.address || '—'} />
            <div>
              <label className="block text-xs text-gray-500 mb-1">Property phone</label>
              <input defaultValue={merge.phone} onBlur={(e: any) => { if (e.target.value !== merge.phone) setMerge('phone', e.target.value) }} placeholder="e.g. 845-286-4080" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Name, company, and address come from the property record (edit them on the Overview tab).</p>
        </div>
      )}

      {/* EIV Schedule */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-bold text-gray-800 mb-1">EIV Schedule {isCompany && <span className="ml-1 text-xs font-normal text-indigo-600">· company default</span>}</h3>
        <p className="text-xs text-gray-500 mb-3">Quarterly reports can be run monthly. {isCompany ? 'These become the default for every company property.' : 'A value shown as “company default” is inherited; change it to set it for this property only.'}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-gray-500 border-b"><th className="py-2 pr-2">Report</th><th className="py-2 pr-2">Frequency</th><th className="py-2">Filed / retained in</th></tr></thead>
            <tbody>
              {EIV_SCHEDULE.map((r: ScheduleRow, i: number) => r.group ? (
                <tr key={i} className="bg-gray-50"><td colSpan={3} className="py-1.5 px-2 text-xs font-bold text-gray-700 uppercase tracking-wide">{r.group}</td></tr>
              ) : (
                <tr key={r.key} className="border-b border-gray-100 align-top">
                  <td className="py-2 pr-2 text-gray-800">
                    {r.report}
                    {r.optIn && (
                      <label className="ml-2 inline-flex items-center gap-1 text-xs text-gray-500">
                        <input type="checkbox" checked={!!shownChoice(r.key!).include} onChange={(e: any) => setSchedule(r.key!, { include: e.target.checked })} /> include
                      </label>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    {r.monthlyOption ? (
                      <span className="inline-flex items-center gap-1">
                        <select value={shownChoice(r.key!).frequency || 'Quarterly'} onChange={(e: any) => setSchedule(r.key!, { frequency: e.target.value })} className="border border-gray-300 rounded px-2 py-1 text-xs">
                          <option value="Quarterly">Quarterly</option>
                          <option value="Monthly">Monthly</option>
                        </select>
                        {!isCompany && propChoice(r.key!).frequency === undefined && compChoice(r.key!).frequency !== undefined && (
                          <span className="text-[10px] text-indigo-500">company</span>
                        )}
                      </span>
                    ) : <span className="text-gray-600">{r.freq}</span>}
                  </td>
                  <td className="py-2 text-gray-600 text-xs">
                    {scheduleFiling(r, scope === 'company' ? curSettings : effSettings)}
                    {r.fileOption && (
                      <label className="ml-2 inline-flex items-center gap-1 text-xs text-blue-600">
                        <input type="checkbox" checked={!!shownChoice(r.key!).file} onChange={(e: any) => setSchedule(r.key!, { file: e.target.checked })} /> file it
                      </label>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Storage location + roster */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div>
          <h3 className="text-sm font-bold text-gray-800 mb-1">Physical storage location {isCompany && <span className="ml-1 text-xs font-normal text-indigo-600">· company default</span>}</h3>
          <p className="text-xs text-gray-500 mb-2">Default: “secure, locked storage location in a secure area.” Add specifics only if you want.</p>
          <input
            key={`${scope}-storage`}
            defaultValue={curSettings.storageDetail || ''}
            onBlur={(e: any) => { if (e.target.value !== (curSettings.storageDetail || '')) saveSettings({ ...curSettings, storageDetail: e.target.value || undefined }) }}
            placeholder={!isCompany && co.storageDetail ? `Company default: ${co.storageDetail}` : "e.g. locked cabinet in the manager's office"}
            className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
          />
          {!isCompany && co.storageDetail && !settings.storageDetail && (
            <p className="text-[11px] text-indigo-500 mt-1">Inheriting the company default: “{co.storageDetail}”.</p>
          )}
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-800 mb-1">EIV staff roster (optional) {isCompany && <span className="ml-1 text-xs font-normal text-indigo-600">· company default</span>}</h3>
          <p className="text-xs text-gray-500 mb-2">Leave empty to keep role-only language (no names), so you don’t regenerate when staff change. Add names only if you want a roster in the document.</p>
          {!isCompany && !roster.length && (co.roster || []).length > 0 && (
            <p className="text-[11px] text-indigo-500 mb-2">Inheriting the company roster ({co.roster!.length} {co.roster!.length === 1 ? 'person' : 'people'}). Add someone here to override it for this property.</p>
          )}
          {roster.map((r, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input value={r.name} onChange={(e: any) => updateRoster(i, { name: e.target.value })} placeholder="Name" className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm" />
              <select value={r.role} onChange={(e: any) => updateRoster(i, { role: e.target.value })} className="border border-gray-300 rounded px-2 py-1 text-sm">
                {EIV_ROLES.map((role) => <option key={role} value={role}>{role}</option>)}
              </select>
              <button onClick={() => removeRoster(i)} className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
            </div>
          ))}
          <button onClick={addRoster} className="text-xs text-blue-600 hover:underline">+ Add person</button>
        </div>
      </div>

      {/* Custom items */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-bold text-gray-800 mb-1">{isCompany ? 'Company-wide items' : 'Property-specific items'}</h3>
        <p className="text-xs text-gray-500 mb-2">{isCompany ? 'A clause added here is inserted into the chosen section for every company property.' : 'Add a clause that applies only to this property; it is inserted into the section you choose.'}</p>
        {!isCompany && (co.customItems || []).length > 0 && (
          <div className="mb-2 rounded border border-indigo-100 bg-indigo-50/50 p-2">
            <p className="text-[11px] font-medium text-indigo-600 mb-1">Company-wide items (edit under “Company default”):</p>
            {(co.customItems || []).filter((c: any) => c.text?.trim()).map((c: any) => (
              <p key={c.id} className="text-xs text-gray-600">• <span className="text-gray-400">[{EIV_SECTIONS.find((s) => s.id === c.sectionId)?.title}]</span> {c.text}</p>
            ))}
          </div>
        )}
        {curCustom.map((c) => (
          <div key={c.id} className="flex gap-2 mb-2 items-start">
            <select value={c.sectionId} onChange={(e: any) => updateCustom(c.id, { sectionId: e.target.value })} className="border border-gray-300 rounded px-2 py-1 text-sm">
              {EIV_SECTIONS.filter((s) => s.id !== 'eiv_schedule').map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
            <textarea value={c.text} onChange={(e: any) => updateCustom(c.id, { text: e.target.value })} rows={2} placeholder="Text to add…" className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm" />
            <button onClick={() => removeCustom(c.id)} className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
          </div>
        ))}
        <button onClick={addCustom} className="text-xs text-blue-600 hover:underline">+ Add {isCompany ? 'company-wide' : 'property-specific'} item</button>
      </div>

      {/* Section overrides */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-bold text-gray-800 mb-1">Edit section wording (optional) {isCompany && <span className="ml-1 text-xs font-normal text-indigo-600">· company default</span>}</h3>
        <p className="text-xs text-gray-500 mb-2">Every section uses the standard HUD wording by default. Override any section {isCompany ? 'for all company properties' : 'for this property only'}. {overriddenCount > 0 && <span className="text-blue-600">{overriddenCount} overridden here.</span>}</p>
        <div className="flex flex-wrap gap-2">
          {EIV_SECTIONS.filter((s) => s.id !== 'eiv_schedule').map((s) => {
            const own = !!curOverrides[s.id]?.trim()
            const inheritedCo = !isCompany && !own && !!co.overrides?.[s.id]?.trim()
            return (
              <span key={s.id} className="inline-flex items-center gap-1">
                <button onClick={() => openEdit(s.id)} className={`text-xs px-2 py-1 rounded border ${own ? 'bg-blue-50 border-blue-300 text-blue-700' : inheritedCo ? 'bg-indigo-50 border-indigo-200 text-indigo-600' : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400'}`}>
                  {s.title}{own ? ' ✎' : inheritedCo ? ' (company)' : ''}
                </button>
                {own && <button onClick={() => clearOverride(s.id)} title="Reset to default" className="text-xs text-gray-400 hover:text-red-500">↺</button>}
              </span>
            )
          })}
        </div>
      </div>
      </fieldset>

      {editSection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[85vh] flex flex-col">
            <h3 className="text-lg font-bold mb-2">Edit: {EIV_SECTIONS.find((s) => s.id === editSection)?.title} {isCompany && <span className="text-sm font-normal text-indigo-600">(company default)</span>}</h3>
            <p className="text-xs text-gray-500 mb-2">This replaces the section’s wording {isCompany ? 'for all company properties' : 'for this property only'}. Separate paragraphs with a blank line.</p>
            <textarea value={overrideDraft} onChange={(e: any) => setOverrideDraft(e.target.value)} className="flex-1 min-h-[300px] border border-gray-300 rounded px-3 py-2 text-sm font-mono" />
            <div className="flex gap-3 justify-end mt-3">
              <button onClick={() => setEditSection('')} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button onClick={saveEdit} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Save override</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Info({ label, value }: any) {
  return (
    <div>
      <label className="block text-xs text-gray-500 mb-1">{label}</label>
      <p className="text-sm font-medium text-gray-800">{value}</p>
    </div>
  )
}
