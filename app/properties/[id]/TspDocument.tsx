'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../components/ToastProvider'
import { saveAs } from 'file-saver'
import JSZip from 'jszip'
import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx'
import { Button, Icon } from '../../components/ui'
import {
  composeTsp, TSP_CHOICES, TSP_DEFAULT_UNIT_SIZE,
  type TspSettings, type TspDemo, type TspState, type TspProgram,
  type TspFlag, type TspChoiceKey, type TspUploadKey,
  type ResolvedListItem, type UnitSizeRow,
} from '../../../lib/tspTemplate'
import { TSP_CITES, TSP_FN_BY_KEY } from '../../../lib/tspFootnotes'

// ---- small helpers ---------------------------------------------------------
const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const decodeXml = (s: string) =>
  s.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
   .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
   .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&')

// Endnote citation collector (markers in document order + a Notes list), same
// model as the EIV P&P. Keyed by keyNorm(text) to match lib/tspFootnotes.
const keyNorm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')
function makeCiter() {
  let n = 0
  const seen = new Map<number, number>()
  const notes: { n: number; text: string }[] = []
  const cite = (text: string): number[] => {
    const ids = TSP_FN_BY_KEY[keyNorm(text)]
    if (!ids) return []
    const nums: number[] = []
    for (const id of ids) {
      if (!seen.has(id)) { n++; seen.set(id, n); notes.push({ n, text: TSP_CITES[id] || '' }) }
      nums.push(seen.get(id)!)
    }
    return nums
  }
  return { cite, notes }
}

// Flatten nested resolved list items to {text, level} rows for rendering.
function flattenItems(items: ResolvedListItem[], level = 0, out: { text: string; level: number }[] = []) {
  for (const it of items) {
    out.push({ text: it.text, level })
    if (it.sub && it.sub.length) flattenInto(it.sub, level + 1, out)
  }
  return out
}
function flattenInto(items: ResolvedListItem[], level: number, out: { text: string; level: number }[]) {
  for (const it of items) {
    out.push({ text: it.text, level })
    if (it.sub && it.sub.length) flattenInto(it.sub, level + 1, out)
  }
}

const DEMOS: { id: TspDemo; label: string }[] = [
  { id: 'family', label: 'Family' },
  { id: 'elderly', label: 'Elderly' },
  { id: 'elderly_disabled', label: 'Elderly and/or disabled' },
]
const STATES: { id: TspState; label: string }[] = [
  { id: 'other', label: 'Other state (standard criminal screening)' },
  { id: 'nj', label: 'New Jersey (Fair Chance in Housing Act)' },
]
const PROGRAMS: { id: TspProgram; label: string }[] = [
  { id: 'section8', label: 'Project-based Section 8' },
  { id: 'section202_8', label: 'Section 202/8' },
  { id: 'pac_prac', label: 'Section 202 PAC / 202 PRAC / 811 PRAC' },
  { id: 'section236', label: 'Section 236' },
  { id: 'other', label: 'Other' },
]
const FLAGS: { id: TspFlag; label: string; help: string }[] = [
  { id: 'drugEvictionBar', label: 'Include 3-year drug-eviction admission bar', help: 'Comment #94 — optional.' },
  { id: 'arrestsAsFactor', label: 'Include "arrests alone don’t disqualify" stance', help: 'Comment #98 — optional (not applicable in NJ).' },
  { id: 'displacedPreference', label: 'Adopt the "displaced" leasing preference', help: 'Comment #70/#71 — owner-adopted preference.' },
  { id: 'hasAccessibleUnits', label: 'Property has accessible units', help: 'Comment #150 — if off, a "no accessible units" statement is used.' },
  { id: 'noSmallerUnitHold', label: 'Remove the smaller-unit transfer-hold rule (§IV)', help: 'For properties that allow no non-mandated transfers. Leave off to keep the rule.' },
]

export default function TspDocument({ propertyId, property, onDirtyChange }: any) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [s, setS] = useState<TspSettings>({})
  const [saved, setSaved] = useState<TspSettings>({})

  useEffect(() => { load() }, [propertyId])

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('property_doc_settings')
      .select('*').eq('property_id', propertyId).eq('doc_type', 'tsp').maybeSingle()
    const loaded: TspSettings = (data?.settings as TspSettings) || {
      demo: 'family', state: 'other', program: 'section8',
      flags: { arrestsAsFactor: true, drugEvictionBar: true },
      merge: {}, unitSizeRows: TSP_DEFAULT_UNIT_SIZE,
    }
    if (!loaded.merge) loaded.merge = {}
    setS(loaded); setSaved(loaded); setLoading(false)
  }

  const dirty = JSON.stringify(s) !== JSON.stringify(saved)
  useEffect(() => { onDirtyChange?.(dirty) }, [dirty])
  useEffect(() => () => onDirtyChange?.(false), [])
  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  const save = async () => {
    setSaving(true)
    const { error } = await supabase.from('property_doc_settings').upsert(
      { property_id: propertyId, doc_type: 'tsp', settings: s, updated_at: new Date().toISOString() },
      { onConflict: 'property_id,doc_type' })
    setSaving(false)
    if (error) { toast('Could not save. (' + error.message + ')', 'error'); return }
    setSaved(s); toast('Saved.', 'success')
  }
  const discard = () => setS(saved)

  // ---- mutators ------------------------------------------------------------
  const setMerge = (k: string, v: string) => setS(p => ({ ...p, merge: { ...(p.merge || {}), [k]: v } }))
  const setFlag = (k: TspFlag, v: boolean) => setS(p => ({ ...p, flags: { ...(p.flags || {}), [k]: v } }))
  const setChoice = (k: TspChoiceKey, v: string) => setS(p => ({ ...p, choices: { ...(p.choices || {}), [k]: v } }))
  const setUpload = (k: TspUploadKey, v: string) => setS(p => ({ ...p, uploads: { ...(p.uploads || {}), [k]: v } }))
  const m = (k: string) => s.merge?.[k] || ''

  // ---- unit-size rows ------------------------------------------------------
  const rows: UnitSizeRow[] = s.unitSizeRows && s.unitSizeRows.length ? s.unitSizeRows : TSP_DEFAULT_UNIT_SIZE
  const setRows = (next: UnitSizeRow[]) => setS(p => ({ ...p, unitSizeRows: next }))
  const setRow = (i: number, patch: Partial<UnitSizeRow>) => setRows(rows.map((r, idx) => idx === i ? { ...r, ...patch } : r))
  const addRow = () => setRows([...rows, { unit: '', min: '', max: '' }])
  const delRow = (i: number) => setRows(rows.filter((_, idx) => idx !== i))

  // ---- file extraction (.docx / .txt) --------------------------------------
  const extractFile = async (file: File): Promise<string> => {
    const name = file.name.toLowerCase()
    if (name.endsWith('.docx')) {
      const zip = await JSZip.loadAsync(await file.arrayBuffer())
      const xml = (await zip.file('word/document.xml')?.async('string')) || ''
      const noDel = xml.replace(/<w:del\b[\s\S]*?<\/w:del>/g, '')
      const paras = noDel.split(/<\/w:p>/)
        .map(seg => [...seg.matchAll(/<w:t[^>]*>([\s\S]*?)<\/w:t>/g)].map(mm => decodeXml(mm[1])).join(''))
        .map(t => t.trim()).filter(Boolean)
      return paras.join('\n\n')
    }
    return (await file.text())
  }
  const onFile = async (k: TspUploadKey, file?: File | null) => {
    if (!file) return
    try {
      const text = await extractFile(file)
      if (!text.trim()) { toast('No text found in that file — try pasting instead.', 'warning'); return }
      setUpload(k, text)
      toast(`Loaded ${file.name}.`, 'success')
    } catch (e: any) { toast('Could not read that file. ' + (e?.message || ''), 'error') }
  }

  // ---- effective settings used for generation ------------------------------
  const effSettings = (): TspSettings => ({
    ...s,
    merge: { propertyName: property?.name || '', ...(s.merge || {}) },
  })

  // Identity rows shown on the cover.
  const coverRows = (): [string, string][] => {
    const prog = PROGRAMS.find(p => p.id === s.program)?.label || ''
    const demo = DEMOS.find(d => d.id === s.demo)?.label || ''
    const st = s.state === 'nj' ? 'New Jersey' : (m('stateName') || 'Other')
    return [
      ['Property', property?.name || m('propertyName') || ''],
      ['Program', prog],
      ['Occupancy designation', demo + (m('occupancyBasis') ? ` — ${m('occupancyBasis')}` : '')],
      ['State', st],
      ['HUD project no.', m('hudProjectNo')],
      ['HAP contract no.', m('hapContractNo')],
      ['Initial HAP effective date', m('hapEffectiveDate')],
      ['Number of units', m('numberOfUnits')],
      ['Effective date', m('effectiveDate') || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })],
    ].filter(([, v]) => v) as [string, string][]
  }

  // ---- PDF (print window) --------------------------------------------------
  const sup = (nums: number[]) => (nums.length ? `<sup>${nums.join(',')}</sup>` : '')
  const generatePDF = () => {
    const secs = composeTsp(effSettings())
    const ct = makeCiter()
    const w = window.open('', '_blank')
    if (!w) { toast('Please allow pop-ups to print.', 'warning'); return }
    let body = `<h1>Tenant Selection Plan</h1>`
    body += `<p class="sub">${esc(property?.name || '')}</p>`
    body += `<table class="cover">`
    for (const [k, v] of coverRows()) body += `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`
    body += `</table><hr>`
    for (const sec of secs) {
      body += `<h2>${esc(sec.num)}. ${esc(sec.title)}</h2>`
      for (const b of sec.blocks) {
        if (b.k === 'h') body += `<h3>${esc(b.text)}${sup(ct.cite(b.text))}</h3>`
        else if (b.k === 'p') body += `<p>${esc(b.text)}${sup(ct.cite(b.text))}</p>`
        else if (b.k === 'ul') {
          for (const row of flattenItems(b.items)) body += `<p class="li${Math.min(row.level, 2)}">${row.level === 0 ? '•' : row.level === 1 ? '–' : '·'} ${esc(row.text)}${sup(ct.cite(row.text))}</p>`
        } else if (b.k === 'table') {
          body += `<table class="grid"><thead><tr><th>Unit Size</th><th>Minimum Occupants</th><th>Maximum Occupants</th></tr></thead><tbody>`
          for (const r of b.rows) body += `<tr><td>${esc(r.unit)}</td><td>${esc(r.min)}</td><td>${esc(r.max)}</td></tr>`
          body += `</tbody></table>`
        }
      }
    }
    if (ct.notes.length) {
      body += `<h2 class="notes-h">Notes</h2>`
      for (const nt of ct.notes) body += `<p class="en"><span class="enn">${nt.n}.</span> ${esc(nt.text)}</p>`
    }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Tenant Selection Plan${property?.name ? ' — ' + esc(property.name) : ''}</title><style>
      *{box-sizing:border-box;}
      @page{margin:20mm;}
      body{font-family:'Georgia','Times New Roman',serif;color:#1e1b4b;line-height:1.5;font-size:12px;max-width:7.5in;margin:0 auto;padding:16px;}
      h1{font-size:26px;text-align:center;color:#1e1b4b;margin:0 0 2px;}
      .sub{text-align:center;color:#4338ca;font-weight:600;margin:0 0 14px;font-family:ui-sans-serif,'Segoe UI',Arial,sans-serif;}
      table.cover{border-collapse:collapse;width:100%;font-family:ui-sans-serif,'Segoe UI',Arial,sans-serif;font-size:11px;margin:0 0 6px;}
      table.cover th{text-align:left;color:#6b7280;font-weight:600;width:34%;padding:3px 10px 3px 0;vertical-align:top;}
      table.cover td{padding:3px 0;color:#111;}
      hr{border:none;border-top:2px solid #312e81;margin:12px 0 16px;}
      h2{font-size:16px;color:#1e1b4b;border-bottom:1px solid #c7c7dd;padding-bottom:3px;margin:22px 0 8px;font-family:ui-sans-serif,'Segoe UI',Arial,sans-serif;}
      h3{font-size:13px;color:#312e81;margin:14px 0 4px;font-family:ui-sans-serif,'Segoe UI',Arial,sans-serif;}
      p{margin:0 0 8px;text-align:justify;}
      p.li0{margin:0 0 5px 18px;} p.li1{margin:0 0 5px 40px;} p.li2{margin:0 0 5px 62px;}
      table.grid{border-collapse:collapse;width:100%;margin:6px 0 12px;font-family:ui-sans-serif,'Segoe UI',Arial,sans-serif;font-size:11px;}
      table.grid th{background:#312e81;color:#fff;text-align:left;padding:5px 10px;}
      table.grid td{border:1px solid #d7d7e6;padding:5px 10px;}
      sup{font-size:8px;color:#4338ca;font-weight:700;}
      .notes-h{margin-top:28px;}
      .en{font-size:10px;color:#374151;margin:0 0 4px;text-align:left;}
      .enn{color:#312e81;font-weight:bold;margin-right:4px;}
      @media print{h2,h3{page-break-after:avoid;} p,tr{page-break-inside:avoid;}}
    </style></head><body>${body}<script>window.onload=function(){setTimeout(function(){window.print()},300)}<\/script></body></html>`)
    w.document.close()
  }

  // ---- Word ----------------------------------------------------------------
  const BRAND = '312E81'
  const supRun = (nums: number[]) => nums.length ? [new TextRun({ text: nums.join(','), superScript: true, size: 14, color: '4338CA' })] : []
  const generateWord = async () => {
    const secs = composeTsp(effSettings())
    const ct = makeCiter()
    const children: any[] = []
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 40 }, children: [new TextRun({ text: 'Tenant Selection Plan', bold: true, size: 40, color: BRAND })] }))
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 160 }, children: [new TextRun({ text: property?.name || '', bold: true, size: 24, color: '4338CA' })] }))
    for (const [k, v] of coverRows()) {
      children.push(new Paragraph({ spacing: { after: 20 }, children: [
        new TextRun({ text: `${k}:  `, bold: true, size: 18, color: '6B7280' }),
        new TextRun({ text: v, size: 18 }),
      ] }))
    }
    children.push(new Paragraph({ border: { bottom: { color: BRAND, space: 1, style: BorderStyle.SINGLE, size: 12 } }, spacing: { after: 200 }, children: [] }))

    for (const sec of secs) {
      children.push(new Paragraph({ spacing: { before: 240, after: 100 }, border: { bottom: { color: 'C7C7DD', space: 1, style: BorderStyle.SINGLE, size: 6 } }, children: [new TextRun({ text: `${sec.num}. ${sec.title}`, bold: true, size: 26, color: BRAND })] }))
      for (const b of sec.blocks) {
        if (b.k === 'h') {
          children.push(new Paragraph({ spacing: { before: 140, after: 60 }, children: [new TextRun({ text: b.text, bold: true, size: 22, color: '312E81' }), ...supRun(ct.cite(b.text))] }))
        } else if (b.k === 'p') {
          children.push(new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: [new TextRun({ text: b.text, size: 20 }), ...supRun(ct.cite(b.text))] }))
        } else if (b.k === 'ul') {
          for (const row of flattenItems(b.items)) {
            const bullet = row.level === 0 ? '•' : row.level === 1 ? '–' : '·'
            children.push(new Paragraph({ indent: { left: 360 * (row.level + 1), hanging: 220 }, spacing: { after: 70 }, children: [new TextRun({ text: `${bullet}  ${row.text}`, size: 20 }), ...supRun(ct.cite(row.text))] }))
          }
        } else if (b.k === 'table') {
          const hdr = (t: string) => new TableCell({ shading: { fill: BRAND } as any, margins: { top: 40, bottom: 40, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: t, bold: true, color: 'FFFFFF', size: 18 })] })] })
          const cell = (t: string) => new TableCell({ margins: { top: 40, bottom: 40, left: 80, right: 80 }, children: [new Paragraph({ children: [new TextRun({ text: t, size: 18 })] })] })
          children.push(new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({ tableHeader: true, children: [hdr('Unit Size'), hdr('Minimum Occupants'), hdr('Maximum Occupants')] }),
              ...b.rows.map(r => new TableRow({ children: [cell(r.unit), cell(r.min), cell(r.max)] })),
            ],
          }))
          children.push(new Paragraph({ spacing: { after: 120 }, children: [] }))
        }
      }
    }
    if (ct.notes.length) {
      children.push(new Paragraph({ spacing: { before: 320, after: 100 }, border: { bottom: { color: 'C7C7DD', space: 1, style: BorderStyle.SINGLE, size: 6 } }, children: [new TextRun({ text: 'Notes', bold: true, size: 26, color: BRAND })] }))
      for (const nt of ct.notes) {
        children.push(new Paragraph({ spacing: { after: 40 }, children: [
          new TextRun({ text: `${nt.n}.  `, bold: true, size: 16, color: BRAND }),
          new TextRun({ text: nt.text, size: 16 }),
        ] }))
      }
    }
    const doc = new Document({ sections: [{ properties: { page: { margin: { top: 1080, bottom: 1080, left: 1080, right: 1080 } } }, children }] })
    const blob = await Packer.toBlob(doc)
    saveAs(blob, `Tenant Selection Plan — ${property?.name || 'property'}.docx`)
  }

  if (loading) return <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 text-slate-500">Loading…</div>

  const stateOther = s.state !== 'nj'
  const incomeOther = s.choices?.incomeTargetingMethod === 'other'

  return (
    <div className="space-y-4">
      {/* Header / actions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-semibold text-slate-800">Tenant Selection Plan</h3>
            <p className="text-sm text-slate-500">Generated from HUD 4350.3 with this property’s settings. HOTMA is excluded.</p>
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            {dirty && <span className="text-xs text-amber-600 font-medium">Unsaved changes</span>}
            {dirty && <Button variant="ghost" onClick={discard}>Discard</Button>}
            <Button variant="primary" onClick={save} disabled={saving || !dirty}>{saving ? 'Saving…' : 'Save'}</Button>
            <Button variant="neutral" onClick={generatePDF}><Icon name="file" /> Print / PDF</Button>
            <Button variant="neutral" onClick={generateWord}><Icon name="file" /> Word</Button>
          </div>
        </div>
      </div>

      {/* Identity / cover */}
      <Card title="Property & program">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select label="Occupancy" value={s.demo || 'family'} onChange={v => setS(p => ({ ...p, demo: v as TspDemo }))} options={DEMOS} />
          <Select label="State module" value={s.state || 'other'} onChange={v => setS(p => ({ ...p, state: v as TspState }))} options={STATES} />
          <Select label="Program" value={s.program || 'section8'} onChange={v => setS(p => ({ ...p, program: v as TspProgram }))} options={PROGRAMS} />
          <Field label="HUD project no." value={m('hudProjectNo')} onChange={v => setMerge('hudProjectNo', v)} />
          <Field label="HAP contract no." value={m('hapContractNo')} onChange={v => setMerge('hapContractNo', v)} />
          <Field label="Initial HAP effective date" value={m('hapEffectiveDate')} onChange={v => setMerge('hapEffectiveDate', v)} placeholder="e.g. 7/1/1983" />
          <Field label="Number of units" value={m('numberOfUnits')} onChange={v => setMerge('numberOfUnits', v)} />
          <Field label="Occupancy authorizing document" value={m('occupancyBasis')} onChange={v => setMerge('occupancyBasis', v)} placeholder="HAP / Regulatory Agreement / designation" />
          <Field label="Effective date" value={m('effectiveDate')} onChange={v => setMerge('effectiveDate', v)} placeholder="defaults to today" />
        </div>
        <label className="block mt-3">
          <span className="text-xs font-medium text-slate-500">Other preferences</span>
          <textarea className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={2} value={m('otherPreferences')} placeholder="This property has no other preferences." onChange={e => setMerge('otherPreferences', e.target.value)} />
        </label>
      </Card>

      {/* Policy choices */}
      <Card title="Policy choices">
        <div className="grid grid-cols-1 gap-3">
          <ChoiceSelect label="Income limit (§II.A)" k="incomeLimit" value={s.choices?.incomeLimit} onChange={setChoice} />
          <ChoiceSelect label="40% income-targeting method (§II.B)" k="incomeTargetingMethod" value={s.choices?.incomeTargetingMethod} onChange={setChoice} />
          {incomeOther && (
            <label className="block">
              <span className="text-xs font-medium text-slate-500">Describe the other income-targeting method</span>
              <textarea className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" rows={3} value={m('incomeTargetingOther')} onChange={e => setMerge('incomeTargetingOther', e.target.value)} />
            </label>
          )}
          <ChoiceSelect label="HUD-9887 timing — member turning 18 mid-year (§I)" k="consent9887Timing" value={s.choices?.consent9887Timing} onChange={setChoice} />
          <ChoiceSelect label="In-house / non-mandated transfers (§VI)" k="inHouseTransferPolicy" value={s.choices?.inHouseTransferPolicy} onChange={setChoice} />
        </div>
      </Card>

      {/* Toggles */}
      <Card title="Options">
        <div className="space-y-2">
          {FLAGS.map(f => (
            <label key={f.id} className="flex items-start gap-2">
              <input type="checkbox" className="mt-1" checked={!!s.flags?.[f.id]} onChange={e => setFlag(f.id, e.target.checked)} />
              <span className="text-sm text-slate-700">{f.label}<span className="block text-xs text-slate-400">{f.help}</span></span>
            </label>
          ))}
        </div>
        {s.flags?.hasAccessibleUnits && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Field label="# mobility-accessible units" value={m('accessibleMobilityCount')} onChange={v => setMerge('accessibleMobilityCount', v)} />
            <Field label="# hearing/vision-accessible units" value={m('accessibleHearingVisionCount')} onChange={v => setMerge('accessibleHearingVisionCount', v)} />
          </div>
        )}
        {!s.flags?.noSmallerUnitHold && (
          <div className="grid grid-cols-2 gap-3 mt-3">
            <Field label="Smaller-unit transfer-hold (years)" value={m('smallerUnitHoldYears')} onChange={v => setMerge('smallerUnitHoldYears', v)} placeholder="3" />
          </div>
        )}
      </Card>

      {/* Criminal / credit screening */}
      <Card title="Screening criteria">
        {stateOther ? (
          <>
            <p className="text-xs text-slate-500 mb-2">Paste or upload your provider’s criminal screening criteria (OneSite or other). If left blank, the generic HUD-based list is used with the look-back periods below.</p>
            <UploadField label="Criminal screening criteria" value={s.uploads?.screeningCriteria} onText={t => setUpload('screeningCriteria', t)} onFile={f => onFile('screeningCriteria', f)} />
            {!s.uploads?.screeningCriteria && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3">
                <Field label="Violent felony (yrs)" value={m('lookbackViolentFelony')} onChange={v => setMerge('lookbackViolentFelony', v)} />
                <Field label="Felony drug (yrs)" value={m('lookbackFelonyDrug')} onChange={v => setMerge('lookbackFelonyDrug', v)} />
                <Field label="Other felony (yrs)" value={m('lookbackOtherFelony')} onChange={v => setMerge('lookbackOtherFelony', v)} />
                <Field label="Misd. violent (yrs)" value={m('lookbackMisdViolent')} onChange={v => setMerge('lookbackMisdViolent', v)} />
                <Field label="Other misd. (yrs)" value={m('lookbackOtherMisd')} onChange={v => setMerge('lookbackOtherMisd', v)} />
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-slate-500 mb-2">This is a New Jersey property — the Fair Chance in Housing Act module is generated and the generic category list is not used.</p>
        )}
        <div className="mt-4">
          <p className="text-xs text-slate-500 mb-2">Paste or upload your credit criteria. If blank, generic objective language is used with the thresholds below.</p>
          <UploadField label="Credit criteria" value={s.uploads?.creditCriteria} onText={t => setUpload('creditCriteria', t)} onFile={f => onFile('creditCriteria', f)} />
          {!s.uploads?.creditCriteria && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Field label="Credit look-back (yrs)" value={m('creditLookbackYears')} onChange={v => setMerge('creditLookbackYears', v)} />
              <Field label="Unpaid balance threshold" value={m('creditUnpaidThreshold')} onChange={v => setMerge('creditUnpaidThreshold', v)} placeholder="$____" />
            </div>
          )}
        </div>
      </Card>

      {/* Unit size table */}
      <Card title="Occupancy standards — unit size table (§IV)">
        <div className="space-y-2">
          {rows.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_6rem_6rem_2rem] gap-2 items-center">
              <input className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" placeholder="Unit size" value={r.unit} onChange={e => setRow(i, { unit: e.target.value })} />
              <input className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" placeholder="Min" value={r.min} onChange={e => setRow(i, { min: e.target.value })} />
              <input className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" placeholder="Max" value={r.max} onChange={e => setRow(i, { max: e.target.value })} />
              <button className="text-slate-400 hover:text-red-500 text-lg" onClick={() => delRow(i)} title="Remove">×</button>
            </div>
          ))}
          <button className="text-sm text-indigo-600 font-medium" onClick={addRow}>+ Add unit size</button>
        </div>
      </Card>

      <p className="text-xs text-slate-400 px-1">HUD citations are rendered as numbered endnotes (a “Notes” section) at the end of the Word and PDF output.</p>
    </div>
  )
}

// ---- small presentational components ---------------------------------------
function Card({ title, children }: any) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
      <h4 className="text-sm font-semibold text-slate-700 mb-3">{title}</h4>
      {children}
    </div>
  )
}
function Field({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <input className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm" value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
    </label>
  )
}
function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { id: string; label: string }[] }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  )
}
function ChoiceSelect({ label, k, value, onChange }: { label: string; k: TspChoiceKey; value?: string; onChange: (k: TspChoiceKey, v: string) => void }) {
  const opts = TSP_CHOICES[k]
  const cur = value || opts[0]?.id
  const sel = opts.find(o => o.id === cur)
  return (
    <div>
      <label className="block">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <select className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white" value={cur} onChange={e => onChange(k, e.target.value)}>
          {opts.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </label>
      {sel && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{sel.text.slice(0, 180)}{sel.text.length > 180 ? '…' : ''}</p>}
    </div>
  )
}
function UploadField({ label, value, onText, onFile }: { label: string; value?: string; onText: (t: string) => void; onFile: (f: File | null) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">{label}</span>
        <label className="text-xs text-indigo-600 font-medium cursor-pointer">
          Upload .docx / .txt
          <input type="file" accept=".docx,.txt,.md,.csv" className="hidden" onChange={e => { onFile(e.target.files?.[0] || null); e.currentTarget.value = '' }} />
        </label>
      </div>
      <textarea className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono" rows={value ? 6 : 3} value={value || ''} placeholder="Paste criteria here, or upload a file…" onChange={e => onText(e.target.value)} />
    </div>
  )
}
