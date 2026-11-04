'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../components/ToastProvider'
import { saveAs } from 'file-saver'
import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx'
import {
  EIV_SECTIONS, EIV_SCHEDULE, EIV_ROLES, scheduleFrequency, scheduleFiling, scheduleIncluded,
  type EivSettings, type ListItem, type ScheduleRow,
} from '../../../lib/eivTemplate'

const uid = () => { try { if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) return (crypto as any).randomUUID() } catch {} return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` }

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
    // Property-specific custom items appended to their section.
    for (const ci of customItems.filter((c: any) => c.sectionId === section.id && c.text?.trim())) {
      out.push({ k: 'li', text: ci.text.trim(), level: 0 })
    }
  }
  return out
}

// Schedule rows resolved for the chosen property settings.
const scheduleData = (settings: EivSettings) =>
  EIV_SCHEDULE.filter((r) => r.group || scheduleIncluded(r, settings)).map((r) =>
    r.group ? { group: r.group } : { report: r.report!, freq: scheduleFrequency(r, settings), filing: scheduleFiling(r, settings) })

export default function PropertyDocumentsTab({ propertyId, property }: any) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [docType] = useState('eiv')
  const [settings, setSettings] = useState<EivSettings>({})
  const [overrides, setOverrides] = useState<Record<string, string>>({})
  const [customItems, setCustomItems] = useState<any[]>([])
  const [editSection, setEditSection] = useState<string>('')
  const [overrideDraft, setOverrideDraft] = useState('')

  useEffect(() => { load() }, [propertyId])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('property_doc_settings').select('*').eq('property_id', propertyId).eq('doc_type', 'eiv').maybeSingle()
    if (data) {
      setSettings(data.settings || {})
      setOverrides(data.overrides || {})
      setCustomItems(Array.isArray(data.custom_items) ? data.custom_items : [])
    } else { setSettings({}); setOverrides({}); setCustomItems([]) }
    setLoading(false)
  }

  const persist = async (nextSettings: EivSettings, nextOverrides: Record<string, string>, nextCustom: any[]) => {
    setSaving(true)
    const { error } = await supabase.from('property_doc_settings').upsert(
      { property_id: propertyId, doc_type: docType, settings: nextSettings, overrides: nextOverrides, custom_items: nextCustom, updated_at: new Date().toISOString() },
      { onConflict: 'property_id,doc_type' }
    )
    setSaving(false)
    if (error) toast('Could not save — make sure the property_documents.sql migration has been run. (' + error.message + ')', 'error')
  }
  const saveSettings = (next: EivSettings) => { setSettings(next); persist(next, overrides, customItems) }
  const saveOverrides = (next: Record<string, string>) => { setOverrides(next); persist(settings, next, customItems) }
  const saveCustom = (next: any[]) => { setCustomItems(next); persist(settings, overrides, next) }

  const merge: Record<string, string> = {
    sitename: property?.name || '',
    address: property?.address || '',
    phone: settings.merge?.phone || '',
    company: property?.companies?.name || '',
  }

  const setMerge = (k: string, v: string) => saveSettings({ ...settings, merge: { ...(settings.merge || {}), [k]: v } })
  const setSchedule = (key: string, patch: any) => saveSettings({ ...settings, schedule: { ...(settings.schedule || {}), [key]: { ...(settings.schedule?.[key] || {}), ...patch } } })

  // --- Roster ---
  const roster = settings.roster || []
  const addRoster = () => saveSettings({ ...settings, roster: [...roster, { name: '', role: EIV_ROLES[1] }] })
  const updateRoster = (i: number, patch: any) => saveSettings({ ...settings, roster: roster.map((r, idx) => (idx === i ? { ...r, ...patch } : r)) })
  const removeRoster = (i: number) => saveSettings({ ...settings, roster: roster.filter((_, idx) => idx !== i) })

  // --- Overrides ---
  const defaultSectionText = (sectionId: string) => {
    const blocks = composeEiv(merge, settings, {}, []) // rendered with no overrides
    // Pull the rendered text between this section's h2 and the next h2.
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
  const openEdit = (sectionId: string) => { setEditSection(sectionId); setOverrideDraft(overrides[sectionId] || defaultSectionText(sectionId)) }
  const saveEdit = () => { saveOverrides({ ...overrides, [editSection]: overrideDraft }); setEditSection('') }
  const clearOverride = (sectionId: string) => { const n = { ...overrides }; delete n[sectionId]; saveOverrides(n) }

  // --- Custom items ---
  const addCustom = () => saveCustom([...customItems, { id: uid(), sectionId: EIV_SECTIONS[0].id, text: '' }])
  const updateCustom = (id: string, patch: any) => saveCustom(customItems.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  const removeCustom = (id: string) => saveCustom(customItems.filter((c) => c.id !== id))

  // --- Generation ---------------------------------------------------------
  const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const title = 'EIV Policies & Procedures'
  const headerLines = [merge.sitename, merge.address, merge.phone].filter(Boolean)

  const generatePDF = () => {
    const blocks = composeEiv(merge, settings, overrides, customItems)
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
        for (const row of scheduleData(settings)) {
          if ((row as any).group) body += `<tr><td colspan="3" class="grp">${esc((row as any).group)}</td></tr>`
          else body += `<tr><td>${esc((row as any).report)}</td><td>${esc((row as any).freq)}</td><td>${esc((row as any).filing)}</td></tr>`
        }
        body += `</table>`
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
      th{background:#f0f0f0;} .grp{background:#eef;font-weight:bold;} @media print{h2{page-break-after:avoid;}tr{page-break-inside:avoid;}}
    </style></head><body>${body}<script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>`)
    w.document.close()
  }

  const generateWord = async () => {
    const blocks = composeEiv(merge, settings, overrides, customItems)
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
        for (const row of scheduleData(settings)) {
          if ((row as any).group) rows.push(new TableRow({ children: [new TableCell({ columnSpan: 3, shading: { fill: 'EEEEFF' } as any, children: [new Paragraph({ children: [new TextRun({ text: (row as any).group, bold: true, size: 18 })] })] })] }))
          else rows.push(new TableRow({ children: [cell((row as any).report), cell((row as any).freq), cell((row as any).filing)] }))
        }
        children.push(new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows }))
        children.push(new Paragraph({ children: [] }))
      }
    }
    const blob = await Packer.toBlob(new Document({ sections: [{ children }] }))
    saveAs(blob, `EIV-Policy-and-Procedure-${(property?.name || 'Property').replace(/[^a-zA-Z0-9]/g, '_')}.docx`)
  }

  if (loading) return <div className="bg-white rounded-lg shadow p-6 text-gray-500">Loading documents…</div>

  const overriddenCount = Object.keys(overrides).filter((k) => overrides[k]?.trim()).length

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
      </div>

      {/* Property info (merge fields) */}
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

      {/* EIV Schedule */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-bold text-gray-800 mb-1">EIV Schedule</h3>
        <p className="text-xs text-gray-500 mb-3">Quarterly reports can be run monthly if this property chooses. The generated document reflects these choices.</p>
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
                        <input type="checkbox" checked={!!settings.schedule?.[r.key!]?.include} onChange={(e: any) => setSchedule(r.key!, { include: e.target.checked })} /> include
                      </label>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    {r.monthlyOption ? (
                      <select value={settings.schedule?.[r.key!]?.frequency || 'Quarterly'} onChange={(e: any) => setSchedule(r.key!, { frequency: e.target.value })} className="border border-gray-300 rounded px-2 py-1 text-xs">
                        <option value="Quarterly">Quarterly</option>
                        <option value="Monthly">Monthly</option>
                      </select>
                    ) : <span className="text-gray-600">{r.freq}</span>}
                  </td>
                  <td className="py-2 text-gray-600 text-xs">
                    {scheduleFiling(r, settings)}
                    {r.fileOption && (
                      <label className="ml-2 inline-flex items-center gap-1 text-xs text-blue-600">
                        <input type="checkbox" checked={!!settings.schedule?.[r.key!]?.file} onChange={(e: any) => setSchedule(r.key!, { file: e.target.checked })} /> file it
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
          <h3 className="text-sm font-bold text-gray-800 mb-1">Physical storage location</h3>
          <p className="text-xs text-gray-500 mb-2">Default: “secure, locked storage location in a secure area.” Add specifics only if you want.</p>
          <input defaultValue={settings.storageDetail || ''} onBlur={(e: any) => { if (e.target.value !== (settings.storageDetail || '')) saveSettings({ ...settings, storageDetail: e.target.value || undefined }) }} placeholder="e.g. locked cabinet in the manager's office" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-gray-800 mb-1">EIV staff roster (optional)</h3>
          <p className="text-xs text-gray-500 mb-2">Leave empty to keep role-only language (no names), so you don’t regenerate when staff change. Add names only if you want a roster in the document.</p>
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

      {/* Property-specific custom items */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-bold text-gray-800 mb-1">Property-specific items</h3>
        <p className="text-xs text-gray-500 mb-2">Add a clause that applies only to this property; it is inserted into the section you choose.</p>
        {customItems.map((c) => (
          <div key={c.id} className="flex gap-2 mb-2 items-start">
            <select value={c.sectionId} onChange={(e: any) => updateCustom(c.id, { sectionId: e.target.value })} className="border border-gray-300 rounded px-2 py-1 text-sm">
              {EIV_SECTIONS.map((s) => <option key={s.id} value={s.id}>{s.title}</option>)}
            </select>
            <textarea value={c.text} onChange={(e: any) => updateCustom(c.id, { text: e.target.value })} rows={2} placeholder="Text to add…" className="flex-1 border border-gray-300 rounded px-2 py-1 text-sm" />
            <button onClick={() => removeCustom(c.id)} className="text-red-400 hover:text-red-600 text-xs px-1">✕</button>
          </div>
        ))}
        <button onClick={addCustom} className="text-xs text-blue-600 hover:underline">+ Add property-specific item</button>
      </div>

      {/* Section overrides */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-sm font-bold text-gray-800 mb-1">Edit section wording (optional)</h3>
        <p className="text-xs text-gray-500 mb-2">Every section uses the standard HUD wording by default. Override any section for this property only. {overriddenCount > 0 && <span className="text-blue-600">{overriddenCount} overridden.</span>}</p>
        <div className="flex flex-wrap gap-2">
          {EIV_SECTIONS.map((s) => (
            <span key={s.id} className="inline-flex items-center gap-1">
              <button onClick={() => openEdit(s.id)} className={`text-xs px-2 py-1 rounded border ${overrides[s.id]?.trim() ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-300 text-gray-600 hover:border-blue-400'}`}>{s.title}{overrides[s.id]?.trim() ? ' ✎' : ''}</button>
              {overrides[s.id]?.trim() && <button onClick={() => clearOverride(s.id)} title="Reset to default" className="text-xs text-gray-400 hover:text-red-500">↺</button>}
            </span>
          ))}
        </div>
      </div>

      {editSection && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[85vh] flex flex-col">
            <h3 className="text-lg font-bold mb-2">Edit: {EIV_SECTIONS.find((s) => s.id === editSection)?.title}</h3>
            <p className="text-xs text-gray-500 mb-2">This replaces the section’s wording for this property only. Separate paragraphs with a blank line.</p>
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
