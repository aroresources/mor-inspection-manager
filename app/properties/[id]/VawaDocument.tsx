'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../components/ToastProvider'
import { saveAs } from 'file-saver'
import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx'
import { Button, Icon } from '../../components/ui'
import { VAWA_5380, VAWA_5380_FILLS, VAWA_FORMS, vawaMerge, type VawaForm } from '../../../lib/vawaTemplate'

const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const BRAND = '312E81'

export default function VawaDocument({ propertyId, property, onDirtyChange }: any) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activeForm, setActiveForm] = useState('5380')
  const [fills, setFills] = useState<Record<string, string>>({})
  const [saved, setSaved] = useState<Record<string, string>>({})

  useEffect(() => { load() }, [propertyId])
  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('property_doc_settings')
      .select('*').eq('property_id', propertyId).eq('doc_type', 'vawa').maybeSingle()
    const f = (data?.settings as any)?.fills || {}
    setFills(f); setSaved(f); setLoading(false)
  }

  const dirty = JSON.stringify(fills) !== JSON.stringify(saved)
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty])
  useEffect(() => () => onDirtyChange?.(false), [])
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from('property_doc_settings').upsert(
      { property_id: propertyId, doc_type: 'vawa', settings: { fills }, updated_at: new Date().toISOString() },
      { onConflict: 'property_id,doc_type' })
    setSaving(false)
    if (error) { toast('Could not save. (' + error.message + ')', 'error'); return }
    setSaved(fills); toast('Saved.', 'success')
  }
  const discard = () => setFills(saved)
  const setFill = (k: string, v: string) => setFills(p => ({ ...p, [k]: v }))

  const form: VawaForm | null = activeForm === '5380' ? VAWA_5380 : null

  // ---- PDF ----------------------------------------------------------------
  const generatePDF = () => {
    if (!form) return
    const w = window.open('', '_blank')
    if (!w) { toast('Please allow pop-ups to print.', 'warning'); return }
    let body = `<h1>${esc(form.title)}</h1>`
    if (form.subtitle) body += `<p class="sub">${esc(form.subtitle)}</p>`
    if (form.omb) body += `<p class="omb">${esc(form.omb)} · Form ${esc(form.code)}</p>`
    body += `<p class="site">${esc(property?.name || '')}</p><hr>`
    for (const b of form.blocks) {
      if (b.k === 'p') body += `<p>${b.lead ? `<strong>${esc(b.lead)}</strong> ` : ''}${esc(vawaMerge(b.text, fills))}</p>`
      else if (b.k === 'ul') { body += '<ul>'; for (const it of b.items) body += `<li>${esc(vawaMerge(it, fills))}</li>`; body += '</ul>' }
      else if (b.k === 'table') {
        body += `<table class="grid"><thead><tr><th>${esc(b.headers[0])}</th><th>${esc(b.headers[1])}</th></tr></thead><tbody>`
        for (const [a, c] of b.rows) body += `<tr><td>${esc(a)}</td><td>${esc(c)}</td></tr>`
        body += `</tbody></table>`
      }
    }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(form.code)}${property?.name ? ' — ' + esc(property.name) : ''}</title><style>
      *{box-sizing:border-box;}
      @page{margin:18mm;}
      body{font-family:'Georgia','Times New Roman',serif;color:#1e1b4b;line-height:1.5;font-size:12px;max-width:7.5in;margin:0 auto;padding:16px;}
      h1{font-size:20px;text-align:center;color:#1e1b4b;margin:0 0 4px;}
      .sub{text-align:center;font-weight:bold;margin:0 0 4px;}
      .omb{text-align:center;color:#6b7280;font-size:10px;margin:0 0 6px;font-family:ui-sans-serif,'Segoe UI',Arial,sans-serif;}
      .site{text-align:center;color:#4338ca;font-weight:600;margin:0 0 10px;font-family:ui-sans-serif,'Segoe UI',Arial,sans-serif;}
      hr{border:none;border-top:2px solid #312e81;margin:8px 0 14px;}
      p{margin:0 0 9px;text-align:justify;}
      ul{margin:0 0 10px 18px;padding:0;} li{margin:0 0 5px;}
      table.grid{border-collapse:collapse;width:100%;margin:6px 0 12px;font-size:11px;}
      table.grid th{background:#312e81;color:#fff;text-align:left;padding:5px 8px;vertical-align:top;}
      table.grid td{border:1px solid #d7d7e6;padding:5px 8px;vertical-align:top;}
      table.grid td:first-child{font-weight:600;width:32%;}
      @media print{tr{page-break-inside:avoid;}}
    </style></head><body>${body}<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`)
    w.document.close()
  }

  // ---- Word ---------------------------------------------------------------
  const generateWord = async () => {
    if (!form) return
    const children: any[] = []
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: form.title, bold: true, size: 30, color: BRAND })] }))
    if (form.subtitle) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: form.subtitle, bold: true, size: 22 })] }))
    if (form.omb) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: `${form.omb} · Form ${form.code}`, size: 15, color: '6B7280' })] }))
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: property?.name || '', bold: true, size: 20, color: '4338CA' })] }))
    children.push(new Paragraph({ border: { bottom: { color: BRAND, space: 1, style: BorderStyle.SINGLE, size: 10 } }, spacing: { after: 160 }, children: [] }))
    for (const b of form.blocks) {
      if (b.k === 'p') {
        const runs: any[] = []
        if (b.lead) runs.push(new TextRun({ text: b.lead + ' ', bold: true, size: 20 }))
        if (b.text) runs.push(new TextRun({ text: vawaMerge(b.text, fills), size: 20 }))
        children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: runs }))
      } else if (b.k === 'ul') {
        for (const it of b.items) children.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 60 }, children: [new TextRun({ text: vawaMerge(it, fills), size: 20 })] }))
      } else if (b.k === 'table') {
        const hdr = (t: string) => new TableCell({ shading: { fill: BRAND } as any, margins: { top: 40, bottom: 40, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, color: 'FFFFFF', size: 16 })] })] })
        const cell = (t: string, bold = false) => new TableCell({ margins: { top: 40, bottom: 40, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: t, size: 16, bold })] })] })
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          columnWidths: [3000, 6000],
          rows: [
            new TableRow({ tableHeader: true, children: [hdr(b.headers[0]), hdr(b.headers[1])] }),
            ...b.rows.map(([a, c]) => new TableRow({ children: [cell(a, true), cell(c)] })),
          ],
        }))
        children.push(new Paragraph({ spacing: { after: 120 }, children: [] }))
      }
    }
    const doc = new Document({ sections: [{ properties: { page: { margin: { top: 1000, bottom: 1000, left: 1000, right: 1000 } } }, children }] })
    saveAs(await Packer.toBlob(doc), `${form.code} — ${property?.name || 'property'}.docx`)
  }

  if (loading) return <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-slate-500">Loading…</div>

  return (
    <div className="space-y-4">
      {/* Header / actions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">VAWA Notices</h3>
            <p className="text-sm text-slate-500">HUD model forms. Fill in the bracketed property-specific items; the rest is the HUD text verbatim.</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {dirty && <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>}
            {dirty && <Button variant="ghost" onClick={discard}>Discard</Button>}
            <Button variant="primary" onClick={save} disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save'}</Button>
            <Button variant="neutral" onClick={generatePDF} disabled={!form}><Icon name="file" /> Print / PDF</Button>
            <Button variant="neutral" onClick={generateWord} disabled={!form}><Icon name="file" /> Word</Button>
          </div>
        </div>
        {/* Form sub-tabs */}
        <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {VAWA_FORMS.map(f => (
            <button key={f.id} onClick={() => setActiveForm(f.id)}
              className={`px-3 py-1.5 rounded-lg text-sm border ${activeForm === f.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
              {f.code} <span className="opacity-70">· {f.label}</span>{!f.ready && <span className="ml-1 text-xs opacity-60">(soon)</span>}
            </button>
          ))}
        </div>
      </div>

      {form ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h4 className="text-sm font-semibold text-slate-700 mb-1">{form.code} — fill-in items</h4>
          <p className="text-xs text-slate-500 mb-4">These replace the bracketed placeholders in the notice. Anything left blank prints the HUD placeholder text.</p>
          <div className="grid grid-cols-1 gap-3">
            {VAWA_5380_FILLS.map(fl => (
              <label key={fl.key} className="block">
                <span className="text-xs font-medium text-slate-500">{fl.label}</span>
                {fl.help && <span className="block text-xs text-slate-400">{fl.help}</span>}
                <textarea className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={2}
                  value={fills[fl.key] || ''} onChange={e => setFill(fl.key, e.target.value)} />
              </label>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-slate-500">
          {VAWA_FORMS.find(f => f.id === activeForm)?.code} isn’t built yet — coming next.
        </div>
      )}
    </div>
  )
}
