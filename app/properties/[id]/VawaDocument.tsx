'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../components/ToastProvider'
import { saveAs } from 'file-saver'
import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx'
import { Button, Icon } from '../../components/ui'
import { VAWA_FORMS, VAWA_FORM_BY_ID, VAWA_FILLS_BY_FORM, VAWA_DEFAULT_FILLS, vawaMerge, type VawaForm, type VawaFill } from '../../../lib/vawaTemplate'

const ALL_FILLS: VawaFill[] = Object.values(VAWA_FILLS_BY_FORM).flat()

const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const TNR = 'Times New Roman'
type Scope = 'property' | 'company'

export default function VawaDocument({ propertyId, property, onDirtyChange }: any) {
  const { toast } = useToast()
  const companyId = property?.company_id || null
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [role, setRole] = useState('')
  const [scope, setScope] = useState<Scope>('property')
  const [activeForm, setActiveForm] = useState('5380')
  const [propFills, setPropFills] = useState<Record<string, string>>({})
  const [coFills, setCoFills] = useState<Record<string, string>>({})
  const [savedProp, setSavedProp] = useState<Record<string, string>>({})
  const [savedCo, setSavedCo] = useState<Record<string, string>>({})

  useEffect(() => { load() }, [propertyId, companyId])
  const load = async () => {
    setLoading(true)
    const [{ data: { user } }, propRes, coRes] = await Promise.all([
      supabase.auth.getUser(),
      supabase.from('property_doc_settings').select('settings').eq('property_id', propertyId).eq('doc_type', 'vawa').maybeSingle(),
      companyId ? supabase.from('company_doc_settings').select('settings').eq('company_id', companyId).eq('doc_type', 'vawa').maybeSingle() : Promise.resolve({ data: null } as any),
    ])
    if (user) { const { data: p } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle(); setRole(p?.role || '') }
    const pf = { ...(((propRes.data?.settings as any)?.fills) || {}) }
    const cf = ((coRes?.data?.settings as any)?.fills) || {}
    // Seed prefilled defaults (e.g. the National DV Hotline) as real editable
    // text when nothing is set at either scope — so it can be edited or added to.
    // Kept in the saved baseline so opening the tab doesn't read as dirty.
    for (const fl of ALL_FILLS) {
      if (fl.prefill && !(pf[fl.key] || '').trim() && !(cf[fl.key] || '').trim()) pf[fl.key] = VAWA_DEFAULT_FILLS[fl.key]
    }
    setPropFills(pf); setSavedProp(pf); setCoFills(cf); setSavedCo(cf); setLoading(false)
  }

  const canEditCompany = role === 'super_admin' || role === 'asset_manager'
  const readOnly = scope === 'company' && !canEditCompany
  const propDirty = JSON.stringify(propFills) !== JSON.stringify(savedProp)
  const coDirty = JSON.stringify(coFills) !== JSON.stringify(savedCo)
  const dirty = propDirty || coDirty

  useEffect(() => { onDirtyChange?.(dirty) }, [dirty])
  useEffect(() => () => onDirtyChange?.(false), [])
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', h); return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const save = async () => {
    setSaving(true); let ok = true
    if (propDirty) {
      const { error } = await supabase.from('property_doc_settings').upsert(
        { property_id: propertyId, doc_type: 'vawa', settings: { fills: propFills }, updated_at: new Date().toISOString() },
        { onConflict: 'property_id,doc_type' })
      if (error) { ok = false; toast('Could not save. (' + error.message + ')', 'error') }
    }
    if (ok && coDirty) {
      if (!companyId) { ok = false; toast('Assign this property to a company before saving company defaults.', 'warning') }
      else {
        const { error } = await supabase.from('company_doc_settings').upsert(
          { company_id: companyId, doc_type: 'vawa', settings: { fills: coFills }, updated_at: new Date().toISOString() },
          { onConflict: 'company_id,doc_type' })
        if (error) { ok = false; toast('Could not save company default. (' + error.message + ')', 'error') }
      }
    }
    setSaving(false)
    if (ok) { setSavedProp(propFills); setSavedCo(coFills); toast('Saved.', 'success') }
  }
  const discard = () => { setPropFills(savedProp); setCoFills(savedCo) }

  // Active-scope editing + inheritance.
  const curFills = scope === 'company' ? coFills : propFills
  const setFill = (k: string, v: string) => {
    if (scope === 'company') setCoFills(p => ({ ...p, [k]: v }))
    else setPropFills(p => ({ ...p, [k]: v }))
  }
  // Effective (resolved) values: property over company over built-in default.
  const effFills = (): Record<string, string> => {
    const out: Record<string, string> = {}
    for (const fl of ALL_FILLS) {
      const pv = (propFills[fl.key] || '').trim()
      const cv = (coFills[fl.key] || '').trim()
      out[fl.key] = pv || cv || ''   // vawaMerge fills blanks with VAWA_DEFAULT_FILLS
    }
    return out
  }
  const flagOn = (eff: Record<string, string>, key?: string) => !!key && eff[key] === 'yes'
  const showBlock = (b: any, eff: Record<string, string>) =>
    (!b.when?.flag || flagOn(eff, b.when.flag)) && (!b.when?.notFlag || !flagOn(eff, b.when.notFlag))
  // Placeholder shown in an empty box: inherited company value (property scope) or the built-in default.
  const placeholderFor = (key: string) => {
    if (scope === 'property' && (coFills[key] || '').trim()) return `Company default: ${coFills[key]}`
    return VAWA_DEFAULT_FILLS[key] || ''
  }

  const form: VawaForm | null = VAWA_FORM_BY_ID[activeForm] || null
  const fillsDefs: VawaFill[] = VAWA_FILLS_BY_FORM[activeForm] || []
  const fills = effFills()

  // ---- PDF (matches the plain HUD form look: Times New Roman, black) -------
  const generatePDF = () => {
    if (!form) return
    const w = window.open('', '_blank')
    if (!w) { toast('Please allow pop-ups to print.', 'warning'); return }
    let body = ''
    if (form.omb) body += `<p class="omb">${esc(form.omb)}</p>`
    body += `<h1>${esc(form.title)}</h1>`
    if (form.subtitle) body += `<p class="sub">${esc(form.subtitle)}</p>`
    if (property?.name) body += `<p class="site">${esc(property.name)}</p>`
    body += `<hr>`
    for (const b of form.blocks) {
      if (!showBlock(b, fills)) continue
      if (b.k === 'h') body += `<h2>${esc(b.text)}</h2>`
      else if (b.k === 'p') body += `<p>${b.lead ? `<strong>${esc(b.lead)}</strong> ` : ''}${esc(vawaMerge(b.text, fills))}</p>`
      else if (b.k === 'ul') { body += '<ul>'; for (const it of b.items) body += `<li>${esc(vawaMerge(it, fills))}</li>`; body += '</ul>' }
      else if (b.k === 'table') {
        body += `<table class="grid"><thead><tr><th>${esc(b.headers[0])}</th><th>${esc(b.headers[1])}</th></tr></thead><tbody>`
        for (const [a, c] of b.rows) body += `<tr><td class="prog">${esc(a)}</td><td>${esc(c)}</td></tr>`
        body += `</tbody></table>`
      }
    }
    body += `<p class="formno">Form ${esc(form.code)}</p>`
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(form.code)}${property?.name ? ' — ' + esc(property.name) : ''}</title><style>
      *{box-sizing:border-box;}
      @page{margin:1in 1in 0.9in 1in;}
      body{font-family:'Times New Roman',Times,serif;color:#000;line-height:1.35;font-size:11pt;margin:0;}
      .omb{text-align:center;font-size:8.5pt;margin:0 0 6px;}
      h1{font-size:14pt;font-weight:bold;text-align:center;margin:0 0 2px;}
      h2{font-size:12pt;font-weight:bold;margin:14px 0 6px;}
      .sub{text-align:center;font-weight:bold;font-size:11.5pt;margin:0 0 2px;}
      .site{text-align:center;font-size:10pt;font-style:italic;margin:2px 0 0;}
      hr{border:none;border-top:1px solid #000;margin:8px 0 12px;}
      p{margin:0 0 8px;text-align:justify;}
      ul{margin:0 0 9px 26px;padding:0;} li{margin:0 0 5px;text-align:justify;}
      table.grid{border-collapse:collapse;width:100%;margin:6px 0 12px;font-size:10pt;}
      table.grid th{border:1px solid #000;background:#e6e6e6;text-align:left;padding:5px 7px;vertical-align:top;font-weight:bold;}
      table.grid td{border:1px solid #000;padding:5px 7px;vertical-align:top;}
      table.grid td.prog{font-weight:bold;width:30%;}
      .formno{text-align:left;font-size:9pt;margin:14px 0 0;border-top:1px solid #000;padding-top:3px;}
      @media print{tr{page-break-inside:avoid;} ul,li{page-break-inside:avoid;}}
    </style></head><body>${body}<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`)
    w.document.close()
  }

  // ---- Word (Times New Roman, plain) --------------------------------------
  const run = (text: string, opts: any = {}) => new TextRun({ text, font: TNR, size: 22, ...opts })
  const generateWord = async () => {
    if (!form) return
    const children: any[] = []
    if (form.omb) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [run(form.omb, { size: 17 })] }))
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [run(form.title, { bold: true, size: 28 })] }))
    if (form.subtitle) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 20 }, children: [run(form.subtitle, { bold: true, size: 23 })] }))
    if (property?.name) children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [run(property.name, { italics: true, size: 20 })] }))
    children.push(new Paragraph({ border: { bottom: { color: '000000', space: 1, style: BorderStyle.SINGLE, size: 6 } }, spacing: { after: 160 }, children: [] }))
    for (const b of form.blocks) {
      if (!showBlock(b, fills)) continue
      if (b.k === 'h') {
        children.push(new Paragraph({ spacing: { before: 160, after: 80 }, children: [run(b.text, { bold: true, size: 24 })] }))
      } else if (b.k === 'p') {
        const runs: any[] = []
        if (b.lead) runs.push(run(b.lead + ' ', { bold: true }))
        if (b.text) runs.push(run(vawaMerge(b.text, fills)))
        children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: runs }))
      } else if (b.k === 'ul') {
        for (const it of b.items) children.push(new Paragraph({ bullet: { level: 0 }, alignment: AlignmentType.JUSTIFIED, spacing: { after: 60 }, children: [run(vawaMerge(it, fills))] }))
      } else if (b.k === 'table') {
        const edge = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
        const hdr = (t: string) => new TableCell({ shading: { fill: 'E6E6E6' } as any, margins: { top: 40, bottom: 40, left: 90, right: 90 }, children: [new Paragraph({ children: [run(t, { bold: true, size: 18 })] })] })
        const cell = (t: string, bold = false) => new TableCell({ margins: { top: 40, bottom: 40, left: 90, right: 90 }, children: [new Paragraph({ children: [run(t, { size: 18, bold })] })] })
        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE }, columnWidths: [3000, 6500],
          borders: { top: edge, bottom: edge, left: edge, right: edge, insideHorizontal: edge, insideVertical: edge },
          rows: [new TableRow({ tableHeader: true, children: [hdr(b.headers[0]), hdr(b.headers[1])] }),
            ...b.rows.map(([a, c]) => new TableRow({ children: [cell(a, true), cell(c)] }))],
        }))
        children.push(new Paragraph({ spacing: { after: 120 }, children: [] }))
      }
    }
    children.push(new Paragraph({ spacing: { before: 160 }, border: { top: { color: '000000', space: 1, style: BorderStyle.SINGLE, size: 6 } }, children: [run(`Form ${form.code}`, { size: 17 })] }))
    const doc = new Document({ sections: [{ properties: { page: { margin: { top: 1440, bottom: 1300, left: 1440, right: 1440 } } }, children }] })
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
        {/* Scope switcher */}
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
          <span className="text-sm font-medium text-slate-500">Editing</span>
          <div className="inline-flex rounded-lg border border-slate-300 overflow-hidden text-sm">
            <button onClick={() => setScope('property')} className={`px-3 py-1.5 ${scope === 'property' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>This property</button>
            <button onClick={() => setScope('company')} className={`px-3 py-1.5 border-l border-slate-300 ${scope === 'company' ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}>Company default</button>
          </div>
          <span className="text-xs text-slate-400">{scope === 'company' ? 'Applies to every property in this company unless the property overrides it.' : 'Overrides the company default for this property only.'}</span>
        </div>
        {/* Form sub-tabs */}
        <div className="mt-3 flex flex-wrap gap-2">
          {VAWA_FORMS.map(f => (
            <button key={f.id} onClick={() => setActiveForm(f.id)}
              className={`px-3 py-1.5 rounded-lg text-sm border ${activeForm === f.id ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'}`}>
              {f.code} <span className="opacity-70">· {f.label}</span>{!f.ready && <span className="ml-1 text-xs opacity-60">(soon)</span>}
            </button>
          ))}
        </div>
      </div>

      {form ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h4 className="text-sm font-semibold text-slate-700 mb-1">{form.code} — fill-in items {scope === 'company' && <span className="text-xs font-normal text-indigo-600">(company default)</span>}</h4>
          <p className="text-xs text-slate-500 mb-4">These replace the bracketed placeholders in the notice. Blank items inherit the {scope === 'property' ? 'company default, then the ' : ''}HUD default. Any items left blank print the HUD bracket text, so review before finalizing.</p>
          {readOnly && <p className="text-xs text-amber-600 mb-3">You don’t have permission to edit company defaults — switch to “This property.”</p>}
          <div className="grid grid-cols-1 gap-3">
            {fillsDefs.map(fl => fl.kind === 'flag' ? (
              <label key={fl.key} className="flex items-start gap-2">
                <input type="checkbox" className="mt-1" disabled={readOnly}
                  checked={(curFills[fl.key] || '') === 'yes'}
                  onChange={e => setFill(fl.key, e.target.checked ? 'yes' : '')} />
                <span className="text-sm text-slate-700">{fl.label}{fl.help && <span className="block text-xs text-slate-400">{fl.help}</span>}</span>
              </label>
            ) : (
              <label key={fl.key} className="block">
                <span className="text-xs font-medium text-slate-500">{fl.label}{fl.optional && <span className="text-slate-400"> (optional)</span>}</span>
                {fl.help && <span className="block text-xs text-slate-400">{fl.help}</span>}
                <textarea className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:bg-slate-50" rows={2}
                  disabled={readOnly} value={curFills[fl.key] || ''} placeholder={placeholderFor(fl.key)}
                  onChange={e => setFill(fl.key, e.target.value)} />
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
