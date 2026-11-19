'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../components/ToastProvider'
import { saveAs } from 'file-saver'
import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, PageOrientation } from 'docx'
import {
  EIV_SECTIONS, EIV_SCHEDULE, scheduleFrequency, scheduleFiling, scheduleIncluded,
  type EivSettings, type ListItem, type ScheduleRow, type ScheduleChoice,
} from '../../../lib/eivTemplate'
import { Button, Icon } from '../../components/ui'
import { EIV_CITES, EIV_FN_BY_KEY } from '../../../lib/eivFootnotes'

const fnNorm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')

const uid = () => { try { if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) return (crypto as any).randomUUID() } catch {} return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }

// A company-wide default bundle stored in company_doc_settings.settings (one jsonb).
interface CompanyDoc { schedule?: Record<string, ScheduleChoice>; overrides?: Record<string, string>; customItems?: any[] }

// ---------------------------------------------------------------------------
// Composition: resolve the template into a flat list of render blocks.
// ---------------------------------------------------------------------------
type Endnote = { n: number; text: string }
type RBlock =
  | { k: 'h2'; text: string; cites?: number[] }
  | { k: 'h3'; text: string; cites?: number[] }
  | { k: 'p'; text: string; cites?: number[] }
  | { k: 'li'; text: string; level: number; cites?: number[] }
  | { k: 'schedule' }
  | { k: 'pagebreak' }
  | { k: 'schedulePoster' }
  | { k: 'endnotes'; notes: Endnote[] }

const resolveText = (text: string, merge: Record<string, string>) =>
  text.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => merge[k] || `[${k}]`)

type AddCites = (sourceText: string) => number[]
const pushListItems = (out: RBlock[], items: ListItem[], merge: Record<string, string>, addCites: AddCites, level = 0) => {
  for (const it of items) {
    if (typeof it === 'string') out.push({ k: 'li', text: resolveText(it, merge), level, cites: addCites(it) })
    else {
      out.push({ k: 'li', text: resolveText(it.text, merge), level, cites: addCites(it.text) })
      if (it.sub) pushListItems(out, it.sub, merge, addCites, level + 1)
    }
  }
}

// withCites attaches HUD endnote markers (EIV_FN_BY_KEY keyed on the raw
// template text) and returns the collected endnotes in document order.
function composeEiv(merge: Record<string, string>, overrides: Record<string, string>, customItems: any[], withCites = false): { blocks: RBlock[]; endnotes: Endnote[] } {
  const out: RBlock[] = []
  const endnotes: Endnote[] = []
  let counter = 0
  const addCites: AddCites = (sourceText) => {
    if (!withCites) return []
    const ids = EIV_FN_BY_KEY[fnNorm(sourceText)]
    if (!ids || !ids.length) return []
    return ids.map((id) => { counter++; endnotes.push({ n: counter, text: EIV_CITES[id] || '' }); return counter })
  }
  for (const section of EIV_SECTIONS) {
    // The EIV Schedule gets its own page as a large, post-on-the-wall reference sheet.
    if (section.id === 'eiv_schedule') {
      // Register any schedule-section citations (e.g. the "Use of EIV Reports" note).
      for (const b of section.blocks) if (b.k === 'p') addCites(b.text)
      if (withCites && endnotes.length) out.push({ k: 'endnotes', notes: endnotes.slice() })
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
        if (b.k === 'p') out.push({ k: 'p', text: resolveText(b.text, merge), cites: addCites(b.text) })
        else if (b.k === 'h') out.push({ k: 'h3', text: b.text, cites: addCites(b.text) })
        else if (b.k === 'ul') pushListItems(out, b.items, merge, addCites)
        else if (b.k === 'schedule') out.push({ k: 'schedule' })
      }
    }
    // Custom items (company-wide + property-specific) appended to their section.
    for (const ci of customItems.filter((c: any) => c.sectionId === section.id && c.text?.trim())) {
      out.push({ k: 'li', text: ci.text.trim(), level: 0 })
    }
  }
  return { blocks: out, endnotes }
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

// A filing cell can be multi-line ("\n") with a bold label marked by " → ".
const filingLines = (s: string): string[] => String(s || '').split('\n')
const filingParts = (line: string): [string | null, string] => {
  const i = line.indexOf(' → ')
  return i >= 0 ? [line.slice(0, i), line.slice(i + 3)] : [null, line]
}

type Scope = 'property' | 'company'

export default function PropertyDocumentsTab({ propertyId, property, onDirtyChange }: any) {
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
  // Last-saved snapshots, for dirty-tracking + discard.
  const [savedProp, setSavedProp] = useState({ settings: {} as EivSettings, overrides: {} as Record<string, string>, customItems: [] as any[] })
  const [savedCo, setSavedCo] = useState<CompanyDoc>({})
  const [formRev, setFormRev] = useState(0) // bump to remount uncontrolled inputs (phone/storage)

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
    const pSettings = (p?.settings as EivSettings) || {}
    const pOverrides = (p?.overrides as Record<string, string>) || {}
    const pCustom = Array.isArray(p?.custom_items) ? p!.custom_items : []
    const coSettings = (coRes?.data?.settings as CompanyDoc) || {}
    setSettings(pSettings); setOverrides(pOverrides); setCustomItems(pCustom); setCo(coSettings)
    setSavedProp({ settings: pSettings, overrides: pOverrides, customItems: pCustom }); setSavedCo(coSettings)
    setFormRev((r) => r + 1)
    setLoading(false)
  }

  const canEditCompany = role === 'super_admin' || role === 'asset_manager'
  const readOnly = scope === 'company' && !canEditCompany

  // --- Dirty tracking -----------------------------------------------------
  const propDirty = JSON.stringify({ settings, overrides, customItems }) !== JSON.stringify(savedProp)
  const coDirty = JSON.stringify(co) !== JSON.stringify(savedCo)
  const dirty = propDirty || coDirty

  // Warn on browser close / refresh / external navigation while unsaved.
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  // Report dirty state to the parent (so it can guard tab switches), and clear on unmount.
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty])
  useEffect(() => () => onDirtyChange?.(false), [])

  // --- Persistence --------------------------------------------------------
  const save = async () => {
    setSaving(true)
    let ok = true
    if (propDirty) {
      const { error } = await supabase.from('property_doc_settings').upsert(
        { property_id: propertyId, doc_type: docType, settings, overrides, custom_items: customItems, updated_at: new Date().toISOString() },
        { onConflict: 'property_id,doc_type' })
      if (error) { ok = false; toast('Could not save — make sure the property_documents.sql migration has been run. (' + error.message + ')', 'error') }
    }
    if (ok && coDirty) {
      if (!companyId) { ok = false; toast('Assign this property to a company before saving company defaults.', 'warning') }
      else {
        const { error } = await supabase.from('company_doc_settings').upsert(
          { company_id: companyId, doc_type: docType, settings: co, updated_at: new Date().toISOString() },
          { onConflict: 'company_id,doc_type' })
        if (error) { ok = false; toast('Could not save company default. (' + error.message + ')', 'error') }
      }
    }
    setSaving(false)
    if (ok) {
      setSavedProp({ settings, overrides, customItems }); setSavedCo(co)
      toast('Saved.', 'success')
    }
  }
  const discard = () => {
    setSettings(savedProp.settings); setOverrides(savedProp.overrides); setCustomItems(savedProp.customItems); setCo(savedCo)
    setFormRev((r) => r + 1)
  }

  // --- Scope-aware active config (what the editors read/write) -------------
  const curSettings: EivSettings = scope === 'company' ? { schedule: co.schedule } : settings
  const curOverrides = scope === 'company' ? (co.overrides || {}) : overrides
  const curCustom = scope === 'company' ? (co.customItems || []) : customItems

  const saveOverrides = (next: Record<string, string>) => {
    if (scope === 'company') setCo({ ...co, overrides: next })
    else setOverrides(next)
  }
  const saveCustom = (next: any[]) => {
    if (scope === 'company') setCo({ ...co, customItems: next })
    else setCustomItems(next)
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
    schedule: mergeSchedules(co.schedule, settings.schedule),
  }
  const effOverrides = { ...(co.overrides || {}), ...overrides }
  const effCustom = [...(co.customItems || []), ...customItems]

  const setMerge = (k: string, v: string) => setSettings({ ...settings, merge: { ...(settings.merge || {}), [k]: v } })

  // --- Schedule editing (scope-aware) -------------------------------------
  const compChoice = (key: string): ScheduleChoice => co.schedule?.[key] || {}
  const propChoice = (key: string): ScheduleChoice => settings.schedule?.[key] || {}
  const shownChoice = (key: string): ScheduleChoice => scope === 'company' ? compChoice(key) : { ...compChoice(key), ...propChoice(key) }
  const setSchedule = (key: string, patch: any) => {
    if (scope === 'company') setCo({ ...co, schedule: { ...(co.schedule || {}), [key]: { ...(co.schedule?.[key] || {}), ...patch } } })
    else setSettings({ ...settings, schedule: { ...(settings.schedule || {}), [key]: { ...(settings.schedule?.[key] || {}), ...patch } } })
  }

  // --- Overrides ----------------------------------------------------------
  const defaultSectionText = (sectionId: string) => {
    const { blocks } = composeEiv(merge, {}, []) // rendered with no overrides, no cites
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
  const headerLines = [merge.sitename, merge.company, merge.address, merge.phone].filter(Boolean)
  const metaLine = `Effective ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`

  const filingHtml = (s: string) => filingLines(s).map((ln) => { const [lbl, rest] = filingParts(ln); return lbl ? `<strong>${esc(lbl)}</strong> ${esc(rest)}` : esc(rest) }).join('<br>')

  // The schedule poster's inner HTML, shared by the full document and the
  // standalone "print the schedule" output.
  const schedulePosterInnerHtml = () => {
    let html = `<div class="poster"><div class="poster-head"><div class="poster-kicker">EIV Report Schedule</div>`
    html += `<div class="poster-sub">${esc(merge.sitename || 'Property')}${merge.company ? ' · ' + esc(merge.company) : ''}</div>`
    html += `<div class="poster-note">Post for staff reference</div></div>`
    html += `<table class="sched"><thead><tr><th class="rep">Report</th><th class="freq">How often</th><th>Where it is filed / retained</th></tr></thead><tbody>`
    let alt = 0
    for (const row of scheduleData(effSettings)) {
      if ((row as any).group) { html += `<tr class="grp"><td colspan="3">${esc((row as any).group)}</td></tr>`; alt = 0 }
      else {
        html += `<tr class="${alt % 2 ? 'odd' : ''}"><td class="rep">${esc((row as any).report)}</td><td class="freq">${esc((row as any).freq)}</td><td class="file">${filingHtml((row as any).filing)}</td></tr>`
        alt++
      }
    }
    html += `</tbody></table>`
    html += `<div class="legend"><strong>Key:</strong> MI = Move-In · IC = Initial Certification · AR = Annual Recertification · IR = Interim Recertification. “Quarterly” reports may be run monthly at this property’s option.</div>`
    html += `</div>`
    return html
  }

  // Standalone: print just the schedule poster (wall-ready).
  const generateSchedulePoster = () => {
    const w = window.open('', '_blank')
    if (!w) { toast('Please allow pop-ups to print.', 'warning'); return }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>EIV Report Schedule${merge.sitename ? ' — ' + esc(merge.sitename) : ''}</title><style>
      *{box-sizing:border-box;}
      @page{size:landscape;margin:10mm;}
      body{font-family:ui-sans-serif,'Segoe UI',Arial,sans-serif;color:#1e1b4b;margin:0;padding:14px 26px;}
      .poster-head{text-align:center;margin:0 0 12px;}
      .poster-kicker{font-size:27px;font-weight:800;letter-spacing:.5px;color:#1e1b4b;line-height:1.05;}
      .poster-sub{font-size:15px;color:#4338ca;font-weight:600;margin-top:5px;}
      .poster-note{font-size:10.5px;color:#9ca3af;text-transform:uppercase;letter-spacing:3px;margin-top:3px;}
      .sched{border-collapse:separate;border-spacing:0;width:100%;font-size:12.5px;border:1.5px solid #c7c7dd;border-radius:12px;overflow:hidden;}
      .sched th{background:#312e81;color:#fff;font-size:11px;letter-spacing:.6px;text-transform:uppercase;padding:7px 14px;text-align:left;}
      .sched td{padding:5px 14px;border-top:1px solid #ececf3;vertical-align:top;line-height:1.35;}
      .sched tr.odd td{background:#f7f7fc;}
      .sched td.rep{font-weight:700;color:#1e1b4b;width:30%;}
      .sched td.freq{width:26%;color:#111;}
      .sched td.file{color:#374151;}
      .sched td.file strong{color:#312e81;display:inline-block;min-width:88px;}
      .sched tr.grp td{background:#4338ca;color:#fff;font-weight:700;text-transform:uppercase;letter-spacing:.8px;font-size:11px;padding:5px 14px;}
      .legend{margin-top:10px;font-size:11px;color:#6b7280;line-height:1.5;}
      @media print{tr{page-break-inside:avoid;}}
    </style></head><body>${schedulePosterInnerHtml()}<script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>`)
    w.document.close()
  }

  const sup = (cites?: number[]) => (cites && cites.length ? `<sup>${cites.join(',')}</sup>` : '')

  const generatePDF = () => {
    const { blocks } = composeEiv(merge, effOverrides, effCustom, true)
    let body = `<h1>${esc(title)}</h1><p class="sub">for the use of HUD’s Enterprise Income Verification (EIV) System</p>`
    body += `<p class="hdr">${headerLines.map(esc).join('<br>')}</p>`
    if (metaLine) body += `<p class="meta">${esc(metaLine)}</p>`
    body += `<hr>`
    for (const b of blocks) {
      if (b.k === 'h2') body += `<h2>${esc(b.text)}</h2>`
      else if (b.k === 'h3') body += `<h3>${esc(b.text)}${sup(b.cites)}</h3>`
      else if (b.k === 'p') body += `<p>${esc(b.text)}${sup(b.cites)}</p>`
      else if (b.k === 'li') body += `<p class="li${b.level}">• ${esc(b.text)}${sup(b.cites)}</p>`
      else if (b.k === 'endnotes') {
        body += `<h2>Notes</h2>`
        for (const n of b.notes) body += `<p class="en"><span class="enn">${n.n}.</span> ${esc(n.text)}</p>`
      }
      else if (b.k === 'schedule') {
        body += `<table><tr><th>Report</th><th>Frequency</th><th>Filed / retained in</th></tr>`
        for (const row of scheduleData(effSettings)) {
          if ((row as any).group) body += `<tr><td colspan="3" class="grp">${esc((row as any).group)}</td></tr>`
          else body += `<tr><td>${esc((row as any).report)}</td><td>${esc((row as any).freq)}</td><td>${esc((row as any).filing)}</td></tr>`
        }
        body += `</table>`
      }
      else if (b.k === 'pagebreak') body += `<div class="pb"></div>`
      else if (b.k === 'schedulePoster') body += schedulePosterInnerHtml()
    }
    const w = window.open('', '_blank')
    if (!w) { toast('Please allow pop-ups to print.', 'warning'); return }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>
      body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:12px;line-height:1.5;margin:28px;}
      h1{font-size:22px;margin:0;} .sub{color:#555;margin:2px 0 8px;} .hdr{color:#333;margin:0 0 2px;} .meta{color:#777;font-size:11px;margin:0 0 6px;}
      h2{font-size:16px;margin:20px 0 6px;border-bottom:2px solid #333;padding-bottom:3px;}
      h3{font-size:13px;margin:12px 0 4px;color:#1d4ed8;} p{margin:0 0 6px;} .li0{margin-left:18px;} .li1{margin-left:40px;}
      sup{font-size:8px;color:#555;vertical-align:super;margin-left:1px;}
      .en{font-size:10px;color:#444;margin:0 0 3px;line-height:1.4;} .enn{color:#312e81;font-weight:bold;}
      table{border-collapse:collapse;width:100%;margin:8px 0 14px;} th,td{border:1px solid #999;padding:5px 7px;text-align:left;vertical-align:top;}
      th{background:#f0f0f0;} .grp{background:#eef;font-weight:bold;}
      /* EIV Schedule — its own landscape page, matching the standalone poster */
      @page sched{size:landscape;margin:10mm;}
      .pb{display:none;}
      .poster{break-before:page;page:sched;}
      .poster-head{text-align:center;margin:0 0 12px;}
      .poster-kicker{font-size:27px;font-weight:800;color:#1e1b4b;letter-spacing:.5px;line-height:1.05;}
      .poster-sub{font-size:15px;color:#4338ca;font-weight:600;margin-top:5px;}
      .poster-note{font-size:10.5px;color:#9ca3af;text-transform:uppercase;letter-spacing:3px;margin-top:3px;}
      .sched{border-collapse:separate;border-spacing:0;width:100%;margin:0;font-size:12.5px;border:1.5px solid #c7c7dd;border-radius:12px;overflow:hidden;}
      .sched th{background:#312e81;color:#fff;font-size:11px;letter-spacing:.6px;text-transform:uppercase;padding:7px 14px;border:none;text-align:left;}
      .sched td{padding:5px 14px;border:none;border-top:1px solid #ececf3;vertical-align:top;font-size:12.5px;line-height:1.35;}
      .sched tr.odd td{background:#f7f7fc;}
      .sched td.rep{font-weight:700;color:#1e1b4b;width:30%;}
      .sched td.freq{width:26%;color:#111;}
      .sched td.file{color:#374151;}
      .sched td.file strong{color:#312e81;display:inline-block;min-width:88px;}
      .sched tr.grp td{background:#4338ca;color:#fff;font-weight:700;text-transform:uppercase;letter-spacing:.8px;font-size:11px;padding:5px 14px;border-top:none;}
      .legend{margin-top:10px;font-size:11px;color:#6b7280;line-height:1.5;}
      @media print{h2{page-break-after:avoid;}tr{page-break-inside:avoid;}}
    </style></head><body>${body}<script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>`)
    w.document.close()
  }

  const generateWord = async () => {
    const { blocks } = composeEiv(merge, effOverrides, effCustom, true)
    const children: any[] = []
    const supRuns = (cites?: number[]) => (cites && cites.length ? [new TextRun({ text: cites.join(','), superScript: true, size: 14, color: '555555' })] : [])
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: title, bold: true, size: 40 })] }))
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'for the use of HUD’s Enterprise Income Verification (EIV) System', italics: true, size: 20 })] }))
    for (const line of headerLines) children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: line, size: 20 })] }))
    if (metaLine) children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: metaLine, size: 16, color: '777777' })] }))
    children.push(new Paragraph({ children: [] }))

    const cell = (t: string, head = false) => new TableCell({ width: { size: 33, type: WidthType.PERCENTAGE }, children: [new Paragraph({ children: [new TextRun({ text: t, bold: head, size: 18 })] })] })

    // The EIV Schedule goes on its own landscape section (built separately).
    const posterChildren: any[] = []

    for (const b of blocks) {
      if (b.k === 'h2') children.push(new Paragraph({ spacing: { before: 300, after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '333333' } }, children: [new TextRun({ text: b.text, bold: true, size: 28 })] }))
      else if (b.k === 'h3') children.push(new Paragraph({ spacing: { before: 160 }, children: [new TextRun({ text: b.text, bold: true, size: 24, color: '1D4ED8' }), ...supRuns(b.cites)] }))
      else if (b.k === 'p') children.push(new Paragraph({ spacing: { after: 80 }, children: [new TextRun({ text: b.text, size: 22 }), ...supRuns(b.cites)] }))
      else if (b.k === 'li') children.push(new Paragraph({ spacing: { after: 40 }, indent: { left: 360 + b.level * 360 }, children: [new TextRun({ text: (b.level ? '◦ ' : '• ') + b.text, size: 22 }), ...supRuns(b.cites)] }))
      else if (b.k === 'endnotes') {
        children.push(new Paragraph({ spacing: { before: 300, after: 80 }, border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '333333' } }, children: [new TextRun({ text: 'Notes', bold: true, size: 28 })] }))
        for (const nt of b.notes) children.push(new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: nt.n + '. ', bold: true, size: 16, color: '312E81' }), new TextRun({ text: nt.text, size: 18 })] }))
      }
      else if (b.k === 'schedule') {
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
        const margin = { top: 50, bottom: 50, left: 120, right: 120 } as any
        const headCell = (t: string, w: number) => new TableCell({ width: { size: w, type: WidthType.PERCENTAGE }, shading: { fill: '312E81' } as any, margins: margin, children: [new Paragraph({ children: [new TextRun({ text: t.toUpperCase(), bold: true, color: 'FFFFFF', size: 16 })] })] })
        const dataCell = (t: string, w: number, strong = false) => new TableCell({ width: { size: w, type: WidthType.PERCENTAGE }, margins: margin, children: [new Paragraph({ children: [new TextRun({ text: t, bold: strong, color: strong ? '1E1B4B' : '222222', size: 19 })] })] })
        // Filing cell: one paragraph per line, bold label before " → ".
        const filingCell = (s: string, w: number) => new TableCell({ width: { size: w, type: WidthType.PERCENTAGE }, margins: margin, children: filingLines(s).map((ln) => {
          const [lbl, rest] = filingParts(ln)
          return new Paragraph({ spacing: { after: 10 }, children: lbl
            ? [new TextRun({ text: lbl + ' ', bold: true, color: '312E81', size: 18 }), new TextRun({ text: rest, size: 18 })]
            : [new TextRun({ text: rest, size: 18 })] })
        }) })
        const groupRow = (t: string) => new TableRow({ children: [new TableCell({ columnSpan: 3, shading: { fill: '4338CA' } as any, margins: { ...margin, top: 40, bottom: 40 }, children: [new Paragraph({ children: [new TextRun({ text: t.toUpperCase(), bold: true, color: 'FFFFFF', size: 16 })] })] })] })

        posterChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'EIV Report Schedule', bold: true, size: 36, color: '1E1B4B' })] }))
        posterChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 16 }, children: [new TextRun({ text: [merge.sitename, merge.company].filter(Boolean).join(' · ') || 'Property', bold: true, size: 20, color: '4338CA' })] }))
        posterChildren.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 140 }, children: [new TextRun({ text: 'POST FOR STAFF REFERENCE', size: 14, color: '9CA3AF' })] }))

        const rows = [new TableRow({ tableHeader: true, children: [headCell('Report', 30), headCell('How often', 26), headCell('Where it is filed / retained', 44)] })]
        for (const row of scheduleData(effSettings)) {
          if ((row as any).group) rows.push(groupRow((row as any).group))
          else rows.push(new TableRow({ children: [dataCell((row as any).report, 30, true), dataCell((row as any).freq, 26), filingCell((row as any).filing, 44)] }))
        }
        const thin = { style: BorderStyle.SINGLE, size: 2, color: 'D4D4E4' }
        posterChildren.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, borders: { top: thin, bottom: thin, left: thin, right: thin, insideHorizontal: thin, insideVertical: thin } as any, rows }))
        posterChildren.push(new Paragraph({ spacing: { before: 140 }, children: [new TextRun({ text: 'Key: MI = Move-In · IC = Initial Certification · AR = Annual Recertification · IR = Interim Recertification. “Quarterly” reports may be run monthly at this property’s option.', size: 14, color: '6B7280' })] }))
      }
    }
    const sections: any[] = [{ children }]
    if (posterChildren.length) {
      sections.push({
        properties: { page: { size: { orientation: PageOrientation.LANDSCAPE }, margin: { top: 720, bottom: 720, left: 720, right: 720 } } },
        children: posterChildren,
      })
    }
    const blob = await Packer.toBlob(new Document({ sections }))
    saveAs(blob, `EIV-Policy-and-Procedure-${(property?.name || 'Property').replace(/[^a-zA-Z0-9]/g, '_')}.docx`)
  }

  if (loading) return <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-slate-500">Loading documents…</div>

  const overriddenCount = Object.keys(curOverrides).filter((k) => curOverrides[k]?.trim()).length
  const isCompany = scope === 'company'
  const companyLabel = property?.companies?.name || 'the company'

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Property Documents</h2>
            <p className="text-xs">
              <span className="text-slate-500">EIV Policy &amp; Procedure · </span>
              {saving ? <span className="text-slate-500">saving…</span>
                : dirty ? <span className="text-amber-600 font-medium">Unsaved changes</span>
                : <span className="text-slate-400">All changes saved</span>}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {dirty && <button onClick={discard} disabled={saving} className="text-sm text-slate-500 hover:text-slate-700 px-2 py-1.5">Discard</button>}
            <Button variant="primary" onClick={save} disabled={!dirty || saving}>{saving ? 'Saving…' : 'Save'}</Button>
            <span className="w-px h-6 bg-slate-200 mx-1 hidden sm:inline-block" />
            <Button variant="neutral" onClick={generateSchedulePoster}><Icon name="calendar" /> Schedule</Button>
            <Button variant="neutral" onClick={generateWord}><Icon name="file" /> Word</Button>
            <Button variant="neutral" onClick={generatePDF}><Icon name="download" /> PDF</Button>
          </div>
        </div>

        {/* Scope switcher */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <span className="text-xs font-medium text-slate-500">Editing:</span>
          <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden text-sm">
            <button onClick={() => setScope('property')} className={`px-3 py-1.5 ${!isCompany ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>This property</button>
            <button onClick={() => setScope('company')} className={`px-3 py-1.5 border-l border-slate-300 ${isCompany ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Company default</button>
          </div>
          <span className="text-xs text-slate-500">
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
          <p className="mt-2 text-xs text-slate-400">The generated document always combines the company defaults with this property’s own values.</p>
        )}
      </div>

      <fieldset disabled={readOnly} className={readOnly ? 'opacity-60 space-y-4' : 'space-y-4'}>
      {/* Property info (merge fields) — property scope only */}
      {!isCompany && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h3 className="text-sm font-semibold text-slate-800 mb-3">Property Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Info label="Property name" value={merge.sitename || '—'} />
            <Info label="Management company" value={merge.company || '—'} />
            <Info label="Address" value={merge.address || '—'} />
            <div>
              <label className="block text-xs text-slate-500 mb-1">Property phone</label>
              <input key={`phone-${formRev}`} defaultValue={merge.phone} onBlur={(e: any) => { if (e.target.value !== merge.phone) setMerge('phone', e.target.value) }} placeholder="e.g. 845-286-4080" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none" />
            </div>
          </div>
          <p className="text-xs text-slate-400 mt-2">Name, company, and address come from the property record (edit them on the Overview tab).</p>
        </div>
      )}

      {/* EIV Schedule */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-1">EIV Schedule {isCompany && <span className="ml-1 text-xs font-normal text-indigo-600">· company default</span>}</h3>
        <p className="text-xs text-slate-500 mb-3">Quarterly reports can be run monthly. {isCompany ? 'These become the default for every company property.' : 'A value shown as “company default” is inherited; change it to set it for this property only.'}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-xs text-slate-500 border-b"><th className="py-2 pr-2">Report</th><th className="py-2 pr-2">Frequency</th><th className="py-2">Filed / retained in</th></tr></thead>
            <tbody>
              {EIV_SCHEDULE.map((r: ScheduleRow, i: number) => r.group ? (
                <tr key={i} className="bg-slate-50"><td colSpan={3} className="py-1.5 px-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">{r.group}</td></tr>
              ) : (
                <tr key={r.key} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-2 text-slate-800">
                    {r.report}
                    {r.optIn && (
                      <label className="ml-2 inline-flex items-center gap-1 text-xs text-slate-500">
                        <input type="checkbox" checked={!!shownChoice(r.key!).include} onChange={(e: any) => setSchedule(r.key!, { include: e.target.checked })} /> include
                      </label>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    {r.monthlyOption ? (
                      <span className="inline-flex items-center gap-1">
                        <select value={shownChoice(r.key!).frequency || 'Quarterly'} onChange={(e: any) => setSchedule(r.key!, { frequency: e.target.value })} className="border border-slate-300 rounded-lg px-2 py-1 text-xs">
                          <option value="Quarterly">Quarterly</option>
                          <option value="Monthly">Monthly</option>
                        </select>
                        {!isCompany && propChoice(r.key!).frequency === undefined && compChoice(r.key!).frequency !== undefined && (
                          <span className="text-[10px] text-indigo-500">company</span>
                        )}
                      </span>
                    ) : <span className="text-slate-600">{r.freq}</span>}
                  </td>
                  <td className="py-2 text-slate-600 text-xs">
                    {filingLines(scheduleFiling(r, scope === 'company' ? curSettings : effSettings)).map((ln, i) => {
                      const [lbl, rest] = filingParts(ln)
                      return <span key={i} className="block">{lbl && <span className="font-semibold text-indigo-900">{lbl} </span>}{rest}</span>
                    })}
                    {r.fileOption && (
                      <label className="ml-2 inline-flex items-center gap-1 text-xs text-indigo-600">
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

      {/* Custom items */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-1">{isCompany ? 'Company-wide items' : 'Property-specific items'}</h3>
        <p className="text-xs text-slate-500 mb-2">{isCompany ? 'A clause added here is inserted into the chosen section for every company property.' : 'Add a clause that applies only to this property; it is inserted into the section you choose.'}</p>
        {!isCompany && (co.customItems || []).length > 0 && (
          <div className="mb-2 rounded border border-indigo-100 bg-indigo-50/50 p-2">
            <p className="text-[11px] font-medium text-indigo-600 mb-1">Company-wide items (edit under “Company default”):</p>
            {(co.customItems || []).filter((c: any) => c.text?.trim()).map((c: any) => (
              <p key={c.id} className="text-xs text-slate-600">• <span className="text-slate-400">[{EIV_SECTIONS.find((s) => s.id === c.sectionId)?.title}]</span> {c.text}</p>
            ))}
          </div>
        )}
        {curCustom.map((c) => (
          <div key={c.id} className="flex gap-2 mb-2 items-start">
            <select value={c.sectionId} onChange={(e: any) => updateCustom(c.id, { sectionId: e.target.value })} className="border border-slate-300 rounded-lg px-2 py-1 text-sm">
              {EIV_SECTIONS.filter((s) => s.id !== 'eiv_schedule').map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
            <textarea value={c.text} onChange={(e: any) => updateCustom(c.id, { text: e.target.value })} rows={2} placeholder="Text to add…" className="flex-1 border border-slate-300 rounded-lg px-2 py-1 text-sm" />
            <button onClick={() => removeCustom(c.id)} className="text-slate-300 hover:text-red-500 text-xs px-1">✕</button>
          </div>
        ))}
        <button onClick={addCustom} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">+ Add {isCompany ? 'company-wide' : 'property-specific'} item</button>
      </div>

      {/* Section overrides */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <h3 className="text-sm font-semibold text-slate-800 mb-1">Edit section wording (optional) {isCompany && <span className="ml-1 text-xs font-normal text-indigo-600">· company default</span>}</h3>
        <p className="text-xs text-slate-500 mb-2">Every section uses the standard HUD wording by default. Override any section {isCompany ? 'for all company properties' : 'for this property only'}. {overriddenCount > 0 && <span className="text-indigo-600">{overriddenCount} overridden here.</span>}</p>
        <div className="flex flex-wrap gap-2">
          {EIV_SECTIONS.filter((s) => s.id !== 'eiv_schedule').map((s) => {
            const own = !!curOverrides[s.id]?.trim()
            const inheritedCo = !isCompany && !own && !!co.overrides?.[s.id]?.trim()
            return (
              <span key={s.id} className="inline-flex items-center gap-1">
                <button onClick={() => openEdit(s.id)} className={`text-xs px-2.5 py-1 rounded-lg border ${own ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : inheritedCo ? 'bg-indigo-50/60 border-indigo-200 text-indigo-600' : 'bg-white border-slate-300 text-slate-600 hover:border-indigo-400'}`}>
                  {s.title}{own ? ' ✎' : inheritedCo ? ' (company)' : ''}
                </button>
                {own && <button onClick={() => clearOverride(s.id)} title="Reset to default" className="text-xs text-slate-400 hover:text-red-500">↺</button>}
              </span>
            )
          })}
        </div>
      </div>
      </fieldset>

      {editSection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-2xl max-h-[85vh] flex flex-col shadow-xl">
            <h3 className="text-lg font-semibold text-slate-800 mb-2">Edit: {EIV_SECTIONS.find((s) => s.id === editSection)?.title} {isCompany && <span className="text-sm font-normal text-indigo-600">(company default)</span>}</h3>
            <p className="text-xs text-slate-500 mb-2">This replaces the section’s wording {isCompany ? 'for all company properties' : 'for this property only'}. Separate paragraphs with a blank line.</p>
            <textarea value={overrideDraft} onChange={(e: any) => setOverrideDraft(e.target.value)} className="flex-1 min-h-[300px] border border-slate-300 rounded-lg px-3 py-2 text-sm font-mono focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none" />
            <div className="flex gap-3 justify-end mt-3">
              <Button variant="ghost" onClick={() => setEditSection('')}>Cancel</Button>
              <Button variant="primary" onClick={saveEdit}>Save override</Button>
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
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <p className="text-sm font-medium text-slate-800">{value}</p>
    </div>
  )
}
