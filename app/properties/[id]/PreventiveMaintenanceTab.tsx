'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabase'
import { useToast } from '../../components/ToastProvider'

// ---------------------------------------------------------------------------
// Preventive Maintenance Plan
// One plan per property, stored as properties.pm_plan = { items: Item[] }.
//
//   Item     = { id, category, isCustom?, locations: Location[] }
//   Location = { id, location, maintenanceDesc, maintainFreqs: Freq[],
//                maintainBy: Who[], inspectFreqs: Freq[],
//                inspectScheduledBy: Who[], inspectPerformedBy: Who[],
//                additionalInfo }
//   Freq     = { type, months?: number[], dayOfMonth?, weekday?, weekdays?: string[], other? }
//   Who      = { role, name? }
// ---------------------------------------------------------------------------

const CATEGORIES = [
  'Heating and A/C Equipment', 'Water Heaters', 'Carpets and Drapes',
  'Roof, Gutter, and Fascia Inspection', 'Other Appliances', 'Elevators',
  'Motor Vehicles', 'Sewer Lines', 'Paint', 'Windows', 'Recreational Equipment',
  'Generator', 'Sprinkler', 'Fire Doors', 'Fire Extinguisher', 'Circulating Pump',
  'Computers and Office Equipment', 'Landscaping', 'Snow Removal',
  'General Cleaning', 'Laundry',
]

const FREQ_TYPES = ['Annually', 'Quarterly', 'Monthly', 'Weekly', 'Daily', 'Move In', 'Move Out', 'Other']
const MAINTAIN_ROLES = ['Property Manager', 'Super', 'Maintenance Technician', 'Porter', 'Other']
const SCHEDULE_ROLES = ['State', 'City/Township', 'Property Manager', 'Super', 'Maintenance Technician', 'Porter', 'Third Party', 'Other']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

const uid = () => {
  try { if (typeof crypto !== 'undefined' && (crypto as any).randomUUID) return (crypto as any).randomUUID() } catch {}
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

const newFreq = () => ({ id: uid(), type: 'Annually', months: [] as number[], dayOfMonth: '', weekday: '', weekdays: [] as string[], other: '' })
const newLocation = () => ({
  id: uid(), location: '', maintenanceDesc: '',
  maintainFreqs: [] as any[], maintainBy: [] as any[],
  inspectFreqs: [] as any[], inspectScheduledBy: [] as any[], inspectPerformedBy: [] as any[],
  additionalInfo: '',
})

const freqSummary = (f: any): string => {
  switch (f.type) {
    case 'Annually': return `Annually${f.months?.length ? ` (${f.months.map((m: number) => MONTHS[m - 1]).join(', ')})` : ''}`
    case 'Quarterly': return `Quarterly${f.months?.length ? ` (${f.months.map((m: number) => MONTHS[m - 1]).join(', ')})` : ''}`
    case 'Monthly': return `Monthly${f.dayOfMonth ? ` (day ${f.dayOfMonth})` : ''}`
    case 'Weekly': return `Weekly${f.weekday ? ` (${f.weekday})` : ''}`
    case 'Daily': return `Daily${f.weekdays?.length ? ` (${f.weekdays.join(', ')})` : ''}`
    case 'Move In': return 'At move-in'
    case 'Move Out': return 'At move-out'
    case 'Other': return f.other ? `Other: ${f.other}` : 'Other'
    default: return f.type
  }
}
const freqsSummary = (arr: any[]): string => (arr && arr.length ? arr.map(freqSummary).join('; ') : '—')

const whoSummary = (arr: any[]): string => {
  if (!arr || !arr.length) return '—'
  return arr.map((w: any) => (w.name ? `${w.role} (${w.name})` : w.role)).join(', ')
}

// The set of calendar months (1-12) a set of frequencies lands in.
const monthsForFreqs = (arr: any[]): Set<number> => {
  const s = new Set<number>()
  for (const f of arr || []) {
    if (f.type === 'Annually' || f.type === 'Quarterly') (f.months || []).forEach((m: number) => s.add(m))
    else if (f.type === 'Monthly' || f.type === 'Weekly' || f.type === 'Daily') for (let m = 1; m <= 12; m++) s.add(m)
  }
  return s
}
const isEventBased = (arr: any[]) => (arr || []).some((f: any) => f.type === 'Move In' || f.type === 'Move Out' || f.type === 'Other')

const itemName = (it: any) => it.category

export default function PreventiveMaintenanceTab({ propertyId, property, onSaved }: any) {
  const { toast, confirm } = useToast()
  const [items, setItems] = useState<any[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [saving, setSaving] = useState(false)
  const [showCustom, setShowCustom] = useState(false)
  const [customName, setCustomName] = useState('')
  const [schedMonth, setSchedMonth] = useState(new Date().getMonth() + 1)

  useEffect(() => {
    const plan = property?.pm_plan
    const parsed = plan && typeof plan === 'object' ? plan : {}
    setItems(Array.isArray(parsed.items) ? parsed.items : [])
  }, [property])

  const savePlan = async (nextItems: any[]) => {
    setItems(nextItems)
    setSaving(true)
    const { error } = await supabase.from('properties').update({ pm_plan: { items: nextItems } }).eq('id', propertyId)
    setSaving(false)
    if (error) { toast('Could not save — make sure the pm_plan.sql migration has been run. (' + error.message + ')', 'error'); return }
    if (onSaved) onSaved()
  }

  const getItem = (category: string) => items.find((i: any) => i.category === category)

  const ensureItem = (category: string, isCustom = false): any => {
    const existing = getItem(category)
    if (existing) return existing
    const it = { id: uid(), category, isCustom, locations: [] as any[] }
    savePlan([...items, it])
    return it
  }

  const updateItem = (itemId: string, patch: any) =>
    savePlan(items.map((i: any) => (i.id === itemId ? { ...i, ...patch } : i)))

  const removeItem = async (itemId: string) => {
    const ok = await confirm({ title: 'Remove item?', message: 'Remove this item and all its locations from the plan?', confirmLabel: 'Remove', danger: true })
    if (!ok) return
    savePlan(items.filter((i: any) => i.id !== itemId))
  }

  const addLocation = (item: any, copyFromFirst = false) => {
    const loc = newLocation()
    if (copyFromFirst && item.locations[0]) {
      const src = item.locations[0]
      Object.assign(loc, {
        maintenanceDesc: src.maintenanceDesc,
        maintainFreqs: JSON.parse(JSON.stringify(src.maintainFreqs || [])),
        maintainBy: JSON.parse(JSON.stringify(src.maintainBy || [])),
        inspectFreqs: JSON.parse(JSON.stringify(src.inspectFreqs || [])),
        inspectScheduledBy: JSON.parse(JSON.stringify(src.inspectScheduledBy || [])),
        inspectPerformedBy: JSON.parse(JSON.stringify(src.inspectPerformedBy || [])),
        additionalInfo: src.additionalInfo,
      })
    }
    const next = items.map((i: any) => (i.id === item.id ? { ...i, locations: [...i.locations, loc] } : i))
    // Make sure a brand-new item (created on-demand) is in the list too.
    if (!items.some((i: any) => i.id === item.id)) next.push({ ...item, locations: [loc] })
    savePlan(next)
    setExpanded(e => ({ ...e, [item.category]: true }))
  }

  const updateLocation = (itemId: string, locId: string, patch: any) =>
    savePlan(items.map((i: any) => (i.id !== itemId ? i : {
      ...i, locations: i.locations.map((l: any) => (l.id === locId ? { ...l, ...patch } : l)),
    })))

  const removeLocation = (itemId: string, locId: string) =>
    savePlan(items.map((i: any) => (i.id !== itemId ? i : { ...i, locations: i.locations.filter((l: any) => l.id !== locId) })))

  const addCustom = () => {
    const name = customName.trim()
    if (!name) return
    if (items.some((i: any) => i.category.toLowerCase() === name.toLowerCase())) { toast('That item already exists.', 'warning'); return }
    const it = { id: uid(), category: name, isCustom: true, locations: [newLocation()] }
    savePlan([...items, it])
    setExpanded(e => ({ ...e, [name]: true }))
    setCustomName(''); setShowCustom(false)
  }

  const customItems = items.filter((i: any) => i.isCustom)
  const plannedCount = items.filter((i: any) => i.locations && i.locations.length).length

  // --- Generation ------------------------------------------------------------
  const esc = (s: any) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const plannedItems = () => items.filter((i: any) => i.locations && i.locations.length)

  const printDoc = (title: string, bodyHtml: string) => {
    const w = window.open('', '_blank')
    if (!w) { toast('Please allow pop-ups to print.', 'warning'); return }
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title>
      <style>
        body{font-family:Arial,Helvetica,sans-serif;color:#111;font-size:12px;line-height:1.5;margin:28px;}
        h1{font-size:20px;margin:0 0 4px;} h2{font-size:15px;margin:22px 0 6px;border-bottom:2px solid #333;padding-bottom:3px;}
        h3{font-size:13px;margin:14px 0 4px;color:#1d4ed8;}
        table{border-collapse:collapse;width:100%;margin:6px 0 14px;} th,td{border:1px solid #999;padding:5px 7px;text-align:left;vertical-align:top;}
        th{background:#f0f0f0;font-size:11px;} .muted{color:#666;} .sub{margin:0 0 2px;}
        .sig{height:26px;} @media print{h2{page-break-after:avoid;} tr{page-break-inside:avoid;}}
      </style></head><body>${bodyHtml}
      <script>window.onload=function(){setTimeout(function(){window.print()},250)}<\/script></body></html>`)
    w.document.close()
  }

  const planHeader = (title: string) =>
    `<h1>${esc(title)}</h1><p class="muted">${esc(property?.name || '')}${property?.address ? ' · ' + esc(property.address) : ''} · Generated ${esc(new Date().toLocaleDateString())}</p>`

  const generatePlan = () => {
    const its = plannedItems()
    if (!its.length) { toast('Add at least one item with a location first.', 'warning'); return }
    let body = planHeader('Preventive Maintenance Plan')
    for (const it of its) {
      body += `<h2>${esc(itemName(it))}</h2>`
      it.locations.forEach((l: any, idx: number) => {
        body += `<h3>Location ${idx + 1}${l.location ? ': ' + esc(l.location) : ''}</h3>`
        body += `<table>
          <tr><th style="width:38%">Maintenance performed</th><td>${esc(l.maintenanceDesc) || '—'}</td></tr>
          <tr><th>Maintenance frequency</th><td>${esc(freqsSummary(l.maintainFreqs))}</td></tr>
          <tr><th>Maintenance performed by</th><td>${esc(whoSummary(l.maintainBy))}</td></tr>
          <tr><th>Inspection frequency</th><td>${esc(freqsSummary(l.inspectFreqs))}</td></tr>
          <tr><th>Inspection scheduled by</th><td>${esc(whoSummary(l.inspectScheduledBy))}</td></tr>
          <tr><th>Inspection performed by</th><td>${esc(whoSummary(l.inspectPerformedBy))}</td></tr>
          ${l.additionalInfo ? `<tr><th>Additional info</th><td>${esc(l.additionalInfo)}</td></tr>` : ''}
        </table>`
      })
    }
    printDoc('Preventive Maintenance Plan', body)
  }

  // Flatten the plan into individual maintenance/inspection tasks.
  const buildTasks = () => {
    const tasks: any[] = []
    for (const it of plannedItems()) {
      it.locations.forEach((l: any, idx: number) => {
        const loc = l.location || `Location ${idx + 1}`
        if (l.maintenanceDesc || (l.maintainFreqs || []).length) {
          tasks.push({ category: itemName(it), location: loc, kind: 'Maintenance', desc: l.maintenanceDesc, freqs: l.maintainFreqs || [], who: whoSummary(l.maintainBy) })
        }
        if ((l.inspectFreqs || []).length || (l.inspectPerformedBy || []).length || (l.inspectScheduledBy || []).length) {
          tasks.push({ category: itemName(it), location: loc, kind: 'Inspection', desc: '', freqs: l.inspectFreqs || [], who: whoSummary(l.inspectPerformedBy), scheduledBy: whoSummary(l.inspectScheduledBy) })
        }
      })
    }
    return tasks
  }

  const generateByTask = () => {
    const tasks = buildTasks()
    if (!tasks.length) { toast('Add at least one item with a location first.', 'warning'); return }
    let body = planHeader('Preventive Maintenance Schedule — by Task')
    body += `<table><tr>
      <th>Item</th><th>Location</th><th>Task</th><th>Description</th><th>Frequency</th><th>Responsible</th>
      <th style="width:70px">Done</th><th style="width:120px">Signature</th><th style="width:140px">Comments</th></tr>`
    for (const t of tasks) {
      body += `<tr>
        <td>${esc(t.category)}</td><td>${esc(t.location)}</td><td>${esc(t.kind)}</td>
        <td>${esc(t.desc) || (t.kind === 'Inspection' ? 'Inspection' : '—')}</td>
        <td>${esc(freqsSummary(t.freqs))}</td><td>${esc(t.who)}</td>
        <td class="sig"></td><td class="sig"></td><td class="sig"></td></tr>`
    }
    body += `</table>`
    printDoc('PM Schedule by Task', body)
  }

  const generateByYear = () => {
    const tasks = buildTasks()
    if (!tasks.length) { toast('Add at least one item with a location first.', 'warning'); return }
    let body = planHeader('Preventive Maintenance Schedule — Annual')
    for (let m = 1; m <= 12; m++) {
      const due = tasks.filter((t: any) => monthsForFreqs(t.freqs).has(m))
      body += `<h2>${MONTHS_LONG[m - 1]}</h2>`
      if (!due.length) { body += `<p class="muted">No scheduled tasks.</p>`; continue }
      body += `<table><tr><th>Item</th><th>Location</th><th>Task</th><th>Frequency</th><th>Responsible</th><th style="width:70px">Done</th><th style="width:120px">Signature</th></tr>`
      for (const t of due) body += `<tr><td>${esc(t.category)}</td><td>${esc(t.location)}</td><td>${esc(t.kind)}${t.desc ? ' — ' + esc(t.desc) : ''}</td><td>${esc(freqsSummary(t.freqs))}</td><td>${esc(t.who)}</td><td class="sig"></td><td class="sig"></td></tr>`
      body += `</table>`
    }
    const events = tasks.filter((t: any) => isEventBased(t.freqs))
    if (events.length) {
      body += `<h2>Event-based / as needed</h2><table><tr><th>Item</th><th>Location</th><th>Task</th><th>When</th><th>Responsible</th></tr>`
      for (const t of events) body += `<tr><td>${esc(t.category)}</td><td>${esc(t.location)}</td><td>${esc(t.kind)}</td><td>${esc(freqsSummary(t.freqs))}</td><td>${esc(t.who)}</td></tr>`
      body += `</table>`
    }
    printDoc('PM Annual Schedule', body)
  }

  const generateByMonth = () => {
    const tasks = buildTasks()
    if (!tasks.length) { toast('Add at least one item with a location first.', 'warning'); return }
    const due = tasks.filter((t: any) => monthsForFreqs(t.freqs).has(schedMonth))
    let body = planHeader(`Preventive Maintenance Schedule — ${MONTHS_LONG[schedMonth - 1]}`)
    if (!due.length) body += `<p class="muted">No scheduled tasks for ${MONTHS_LONG[schedMonth - 1]}.</p>`
    else {
      body += `<table><tr><th>Item</th><th>Location</th><th>Task</th><th>Frequency</th><th>Responsible</th><th style="width:70px">Done</th><th style="width:120px">Signature</th><th style="width:140px">Comments</th></tr>`
      for (const t of due) body += `<tr><td>${esc(t.category)}</td><td>${esc(t.location)}</td><td>${esc(t.kind)}${t.desc ? ' — ' + esc(t.desc) : ''}</td><td>${esc(freqsSummary(t.freqs))}</td><td>${esc(t.who)}</td><td class="sig"></td><td class="sig"></td><td class="sig"></td></tr>`
      body += `</table>`
    }
    printDoc(`PM Schedule — ${MONTHS_LONG[schedMonth - 1]}`, body)
  }

  // --- Render ----------------------------------------------------------------
  const renderCategoryRow = (category: string, isCustom = false) => {
    const item = getItem(category)
    const open = !!expanded[category]
    const locCount = item?.locations?.length || 0
    return (
      <div key={category} className="bg-white rounded-lg border border-gray-300 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 gap-2">
          <button onClick={() => setExpanded(e => ({ ...e, [category]: !open }))} className="flex items-center gap-2 text-left flex-1 min-w-0">
            <span className="text-gray-400 text-xs">{open ? '▼' : '▶'}</span>
            <span className={`text-sm font-medium ${locCount ? 'text-gray-800' : 'text-gray-500'}`}>{category}</span>
            {locCount > 0 && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{locCount} location{locCount === 1 ? '' : 's'}</span>}
          </button>
          <div className="flex items-center gap-2 shrink-0">
            {isCustom && item && <button onClick={() => removeItem(item.id)} className="text-red-400 hover:text-red-600 text-xs" title="Remove item">✕</button>}
            <button onClick={() => addLocation(item || ensureItem(category, isCustom))} className="text-xs bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700">+ Location</button>
          </div>
        </div>
        {open && item && item.locations.length > 0 && (
          <div className="border-t border-gray-200 divide-y divide-gray-200 bg-gray-50">
            {item.locations.map((loc: any, idx: number) => (
              <LocationEditor
                key={loc.id}
                item={item}
                loc={loc}
                index={idx}
                onChange={(patch: any) => updateLocation(item.id, loc.id, patch)}
                onRemove={() => removeLocation(item.id, loc.id)}
                onAddLocation={(copy: boolean) => addLocation(item, copy)}
              />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Preventive Maintenance Plan</h2>
            <p className="text-xs text-gray-500">{plannedCount} item{plannedCount === 1 ? '' : 's'} in the plan{saving ? ' · saving…' : ''}</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={generatePlan} className="bg-blue-600 text-white px-3 py-1.5 rounded text-sm hover:bg-blue-700">📄 Generate Plan</button>
            <button onClick={generateByTask} className="bg-gray-700 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-800">🗓️ Schedule by Task</button>
            <button onClick={generateByYear} className="bg-gray-700 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-800">📅 Annual Schedule</button>
            <div className="flex items-center gap-1">
              <select value={schedMonth} onChange={(e: any) => setSchedMonth(Number(e.target.value))} className="border border-gray-300 rounded px-2 py-1.5 text-sm">
                {MONTHS_LONG.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
              </select>
              <button onClick={generateByMonth} className="bg-gray-700 text-white px-3 py-1.5 rounded text-sm hover:bg-gray-800">📅 Month</button>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        {CATEGORIES.map((c) => renderCategoryRow(c, false))}
        {customItems.map((it: any) => renderCategoryRow(it.category, true))}
      </div>

      {showCustom ? (
        <div className="bg-white rounded-lg border border-gray-300 p-3 flex items-center gap-2">
          <input autoFocus value={customName} onChange={(e: any) => setCustomName(e.target.value)} onKeyDown={(e: any) => { if (e.key === 'Enter') addCustom() }} placeholder="Custom item name (e.g. Pool pump)" className="flex-1 border border-gray-300 rounded px-3 py-2 text-sm" />
          <button onClick={addCustom} className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700">Add</button>
          <button onClick={() => { setShowCustom(false); setCustomName('') }} className="text-sm text-gray-500 px-2">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setShowCustom(true)} className="text-sm text-blue-600 hover:underline">+ Add other item</button>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// One location's full question set.
// ---------------------------------------------------------------------------
function LocationEditor({ item, loc, index, onChange, onRemove, onAddLocation }: any) {
  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-gray-700">Location {index + 1}</span>
        <button onClick={onRemove} className="text-red-400 hover:text-red-600 text-xs">Remove location</button>
      </div>

      <div className="space-y-4">
        <Field label="1. Location (where these items are)">
          <input defaultValue={loc.location} onBlur={(e: any) => { if (e.target.value !== loc.location) onChange({ location: e.target.value }) }} placeholder="e.g. In units, Mechanical room" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </Field>

        <Field label="2. Describe the maintenance performed">
          <textarea defaultValue={loc.maintenanceDesc} onBlur={(e: any) => { if (e.target.value !== loc.maintenanceDesc) onChange({ maintenanceDesc: e.target.value }) }} rows={2} placeholder="What is done to maintain these items…" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </Field>

        <Field label="3. How often is it maintained?">
          <FreqEditor value={loc.maintainFreqs} onChange={(v: any) => onChange({ maintainFreqs: v })} />
        </Field>

        <Field label="4. Who performs the maintenance?">
          <WhoEditor roles={MAINTAIN_ROLES} nameRoles={['Other']} value={loc.maintainBy} onChange={(v: any) => onChange({ maintainBy: v })} />
        </Field>

        <Field label="5. How often is this area inspected?">
          <FreqEditor value={loc.inspectFreqs} onChange={(v: any) => onChange({ inspectFreqs: v })} />
        </Field>

        <Field label="6. Who schedules the inspection?">
          <WhoEditor roles={SCHEDULE_ROLES} nameRoles={['Third Party', 'Other']} value={loc.inspectScheduledBy} onChange={(v: any) => onChange({ inspectScheduledBy: v })} />
        </Field>

        <Field label="7. Who performs the inspection?">
          <WhoEditor roles={SCHEDULE_ROLES} nameRoles={['Third Party', 'Other']} value={loc.inspectPerformedBy} onChange={(v: any) => onChange({ inspectPerformedBy: v })} />
        </Field>

        <Field label="8. Additional info">
          <textarea defaultValue={loc.additionalInfo} onBlur={(e: any) => { if (e.target.value !== loc.additionalInfo) onChange({ additionalInfo: e.target.value }) }} rows={2} placeholder="Anything else…" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
        </Field>

        <div className="flex gap-3 pt-1">
          <button onClick={() => onAddLocation(false)} className="text-xs text-blue-600 hover:underline">+ Add another location</button>
          <button onClick={() => onAddLocation(true)} className="text-xs text-blue-600 hover:underline">+ Add location (copy from Location 1)</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: any) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Frequency editor: one or more frequencies, each with a detail sub-form.
// ---------------------------------------------------------------------------
function FreqEditor({ value, onChange }: any) {
  const freqs: any[] = value || []
  const update = (id: string, patch: any) => onChange(freqs.map((f: any) => (f.id === id ? { ...f, ...patch } : f)))
  const add = () => onChange([...freqs, newFreq()])
  const remove = (id: string) => onChange(freqs.filter((f: any) => f.id !== id))
  const toggleMonth = (f: any, m: number) => update(f.id, { months: f.months?.includes(m) ? f.months.filter((x: number) => x !== m) : [...(f.months || []), m].sort((a, b) => a - b) })
  const toggleWeekday = (f: any, d: string) => update(f.id, { weekdays: f.weekdays?.includes(d) ? f.weekdays.filter((x: string) => x !== d) : [...(f.weekdays || []), d] })

  return (
    <div className="space-y-2">
      {freqs.map((f: any) => (
        <div key={f.id} className="border border-gray-200 rounded bg-white p-2">
          <div className="flex items-center gap-2">
            <select value={f.type} onChange={(e: any) => update(f.id, { type: e.target.value })} className="border border-gray-300 rounded px-2 py-1 text-sm">
              {FREQ_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <button onClick={() => remove(f.id)} className="text-red-400 hover:text-red-600 text-xs ml-auto" title="Remove">✕</button>
          </div>
          {(f.type === 'Annually' || f.type === 'Quarterly') && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-1">{f.type === 'Quarterly' ? 'Pick the 4 months' : 'Pick the month(s)'}</p>
              <div className="flex flex-wrap gap-1">
                {MONTHS.map((m, i) => (
                  <button key={m} onClick={() => toggleMonth(f, i + 1)} className={`text-xs px-2 py-1 rounded border ${f.months?.includes(i + 1) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}>{m}</button>
                ))}
              </div>
            </div>
          )}
          {f.type === 'Monthly' && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-500">Day of month</span>
              <input type="number" min={1} max={31} value={f.dayOfMonth} onChange={(e: any) => update(f.id, { dayOfMonth: e.target.value })} className="w-20 border border-gray-300 rounded px-2 py-1 text-sm" placeholder="1-31" />
            </div>
          )}
          {f.type === 'Weekly' && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-500">Day of week</span>
              <select value={f.weekday} onChange={(e: any) => update(f.id, { weekday: e.target.value })} className="border border-gray-300 rounded px-2 py-1 text-sm">
                <option value="">Select</option>
                {WEEKDAYS.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          )}
          {f.type === 'Daily' && (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-1">Which days</p>
              <div className="flex flex-wrap gap-1">
                {WEEKDAYS.map((d) => (
                  <button key={d} onClick={() => toggleWeekday(f, d)} className={`text-xs px-2 py-1 rounded border ${f.weekdays?.includes(d) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300'}`}>{d}</button>
                ))}
              </div>
            </div>
          )}
          {f.type === 'Other' && (
            <input defaultValue={f.other} onBlur={(e: any) => { if (e.target.value !== f.other) update(f.id, { other: e.target.value }) }} placeholder="Describe the timing…" className="mt-2 w-full border border-gray-300 rounded px-2 py-1 text-sm" />
          )}
        </div>
      ))}
      <button onClick={add} className="text-xs text-blue-600 hover:underline">+ Add frequency</button>
    </div>
  )
}

// ---------------------------------------------------------------------------
// "Who" multi-select with an optional name for specific roles.
// ---------------------------------------------------------------------------
function WhoEditor({ roles, nameRoles, value, onChange }: any) {
  const selected: any[] = value || []
  const isOn = (role: string) => selected.some((w: any) => w.role === role)
  const toggle = (role: string) => onChange(isOn(role) ? selected.filter((w: any) => w.role !== role) : [...selected, { role, name: '' }])
  const setName = (role: string, name: string) => onChange(selected.map((w: any) => (w.role === role ? { ...w, name } : w)))
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2">
      {roles.map((role: string) => {
        const on = isOn(role)
        const needsName = nameRoles.includes(role)
        const w = selected.find((x: any) => x.role === role)
        return (
          <div key={role} className="flex items-center gap-2">
            <label className="flex items-center gap-1 text-sm text-gray-700">
              <input type="checkbox" checked={on} onChange={() => toggle(role)} />
              {role}
            </label>
            {on && needsName && (
              <input defaultValue={w?.name || ''} onBlur={(e: any) => { if (e.target.value !== (w?.name || '')) setName(role, e.target.value) }} placeholder="Name" className="border border-gray-300 rounded px-2 py-1 text-xs w-36" />
            )}
          </div>
        )
      })}
    </div>
  )
}
