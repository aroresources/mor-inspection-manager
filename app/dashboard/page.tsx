'use client'
import { useEffect, useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '../../lib/supabase'

export default function Dashboard() {
  const [user, setUser] = useState<any>(null)
  const [userRole, setUserRole] = useState('')
  const [properties, setProperties] = useState<any[]>([])
  const [companies, setCompanies] = useState<any[]>([])
  const [showAddProperty, setShowAddProperty] = useState(false)
  const [showAddCompany, setShowAddCompany] = useState(false)
  const [newProperty, setNewProperty] = useState<any>({
    name: '', address: '', company_id: '', contract_type: ''
  })
  const [newCompany, setNewCompany] = useState({ name: '' })
  const [filterCompany, setFilterCompany] = useState('all')
  const [sortBy, setSortBy] = useState('name')
  const [sortAsc, setSortAsc] = useState(true)
  const [showImportPreview, setShowImportPreview] = useState(false)
  const [importRows, setImportRows] = useState<any[]>([])
  const [importing, setImporting] = useState(false)
  const importInputRef = useRef<HTMLInputElement>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')

  useEffect(() => {
    const saved = localStorage.getItem('dashboardViewMode')
    if (saved === 'grid' || saved === 'list') setViewMode(saved)
  }, [])

  const changeViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode)
    localStorage.setItem('dashboardViewMode', mode)
  }

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/'
      } else {
        setUser(user)
        fetchProperties()
        fetchCompanies()
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
        if (profile) setUserRole(profile.role)
      }
    }
    getUser()
  }, [])

  const fetchProperties = async () => {
    const { data } = await supabase
      .from('properties')
      .select('*, companies(name), mors(mor_date, response_due_date, status, created_at)')
      .order('name')
    if (data) setProperties(data)
  }

  const fetchCompanies = async () => {
    const { data } = await supabase.from('companies').select('*').order('name')
    if (data) setCompanies(data)
  }

  const addCompany = async () => {
    if (!newCompany.name) return
    await supabase.from('companies').insert([newCompany])
    setNewCompany({ name: '' })
    setShowAddCompany(false)
    fetchCompanies()
  }

  const addProperty = async () => {
    if (!newProperty.name) return
    await supabase.from('properties').insert([newProperty])
    setNewProperty({ name: '', address: '', company_id: '', contract_type: '' })
    setShowAddProperty(false)
    fetchProperties()
  }

  const pad = (n: number) => String(n).padStart(2, '0')

  const formatImportDate = (v: any) => {
    if (v === null || v === undefined || v === '') return ''
    if (v instanceof Date && !isNaN(v.getTime())) {
      return `${v.getFullYear()}-${pad(v.getMonth() + 1)}-${pad(v.getDate())}`
    }
    if (typeof v === 'number') {
      const parsed = XLSX.SSF?.parse_date_code(v)
      if (parsed) return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)}`
    }
    const d = new Date(v)
    if (!isNaN(d.getTime())) return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
    return String(v)
  }

  const handleImportFile = async (e: any) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const buffer = await file.arrayBuffer()
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
      const ws = wb.Sheets[wb.SheetNames[0]]
      const json: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

      const getField = (row: any, names: string[]) => {
        const keys = Object.keys(row)
        for (const name of names) {
          const k = keys.find((key) => key.trim().toLowerCase() === name.toLowerCase())
          if (k !== undefined) return row[k]
        }
        return ''
      }

      const rows = json
        .map((r: any) => ({
          name: String(getField(r, ['Property Name']) ?? '').trim(),
          address: String(getField(r, ['Address']) ?? '').trim(),
          company: String(getField(r, ['Management Company']) ?? '').trim(),
          contractType: String(getField(r, ['Contract Type']) ?? '').trim(),
          last_mor_date: formatImportDate(getField(r, ['Last MOR Date'])),
          last_mor_rating: String(getField(r, ['Last MOR Rating']) ?? '').trim(),
          risk_classification: String(getField(r, ['Risk Classification']) ?? '').trim(),
        }))
        .filter((r: any) => r.name)

      if (rows.length === 0) {
        alert('No valid rows found. Make sure the spreadsheet has a "Property Name" column with values.')
      } else {
        setImportRows(rows)
        setShowImportPreview(true)
      }
    } catch (err: any) {
      console.error(err)
      alert('Could not read the file. Please make sure it is a valid .xlsx or .xls spreadsheet.')
    }
    e.target.value = ''
  }

  const confirmImport = async () => {
    setImporting(true)

    // Map existing company names (case-insensitive) to ids
    const companyMap: Record<string, string> = {}
    companies.forEach((c: any) => { companyMap[(c.name || '').trim().toLowerCase()] = c.id })

    // Create any companies that don't exist yet
    const uniqueCompanies = Array.from(new Set(importRows.map((r) => r.company).filter(Boolean)))
    for (const cname of uniqueCompanies) {
      const key = cname.trim().toLowerCase()
      if (!companyMap[key]) {
        const { data } = await supabase.from('companies').insert([{ name: cname }]).select()
        if (data && data[0]) companyMap[key] = data[0].id
      }
    }

    // Existing properties for duplicate detection (same name + company, case-insensitive)
    const { data: existing } = await supabase.from('properties').select('name, company_id')
    const dupKey = (companyId: any, name: string) => `${companyId ?? 'null'}|${(name || '').trim().toLowerCase()}`
    const seen = new Set<string>()
    ;(existing || []).forEach((p: any) => seen.add(dupKey(p.company_id, p.name)))

    // Build property rows, skipping duplicates
    let skipped = 0
    const propsToInsert: any[] = []
    for (const r of importRows) {
      const company_id = r.company ? (companyMap[r.company.trim().toLowerCase()] || null) : null
      const key = dupKey(company_id, r.name)
      if (seen.has(key)) { skipped++; continue }
      seen.add(key)
      propsToInsert.push({
        name: r.name,
        address: r.address || null,
        company_id,
        contract_type: r.contractType || null,
        last_mor_date: r.last_mor_date || null,
        last_mor_rating: r.last_mor_rating || null,
        risk_classification: r.risk_classification || null,
      })
    }

    let importedCount = 0
    if (propsToInsert.length > 0) {
      const { data: inserted, error } = await supabase.from('properties').insert(propsToInsert).select()
      if (error) {
        setImporting(false)
        alert('Import failed: ' + error.message)
        return
      }
      importedCount = inserted?.length ?? 0
    }
    setImporting(false)

    setShowImportPreview(false)
    setImportRows([])
    await fetchCompanies()
    await fetchProperties()
    alert(`Imported ${importedCount} ${importedCount === 1 ? 'property' : 'properties'}, skipped ${skipped} ${skipped === 1 ? 'duplicate' : 'duplicates'}.`)
  }

  const getActiveMor = (property: any) => {
    const activeMors = (property.mors || [])
      .filter((m: any) => m.status === 'Active')
      .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    return activeMors[0] || null
  }

  const getActiveMorDate = (property: any) => {
    const activeMor = getActiveMor(property)
    if (!activeMor || !activeMor.mor_date) return null
    return new Date(activeMor.mor_date)
  }

  const getResponseDueDate = (property: any) => {
    const activeMor = getActiveMor(property)
    if (!activeMor || !activeMor.response_due_date) return null
    return new Date(activeMor.response_due_date)
  }

  const getResponseUrgency = (dueDate: any) => {
    if (!dueDate) return 'none'
    const daysUntil = Math.ceil((dueDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntil < 0) return 'overdue'
    if (daysUntil <= 7) return 'urgent'
    if (daysUntil <= 14) return 'warning'
    return 'ok'
  }

  const ratingRank: Record<string, number> = {
    'Unsatisfactory': 1, 'Below Average': 2, 'Satisfactory': 3, 'Above Average': 4, 'Superior': 5
  }

  const riskRank: Record<string, number> = {
    'Not Troubled': 1, 'Unknown': 2, 'Potentially Troubled': 3, 'Troubled': 4
  }

  const toggleSort = (key: string) => {
    if (sortBy === key) setSortAsc(!sortAsc)
    else { setSortBy(key); setSortAsc(true) }
  }

  const getNextMorDate = (property: any) => {
    if (!property.last_mor_date) return null

    const lastMor = new Date(property.last_mor_date)
    let monthsToAdd = 12 // default

    if (property.contract_type === 'Option 3') {
      monthsToAdd = 12
    } else {
      const risk = property.risk_classification
      const rating = property.last_mor_rating

      if (risk === 'Troubled' || risk === 'Potentially Troubled' || risk === 'Unknown') {
        monthsToAdd = 12
      } else if (risk === 'Not Troubled') {
        if (rating === 'Unsatisfactory' || rating === 'Below Average') {
          monthsToAdd = 12
        } else if (rating === 'Satisfactory') {
          monthsToAdd = 24
        } else if (rating === 'Above Average' || rating === 'Superior') {
          monthsToAdd = 36
        }
      }
    }

    const nextDate = new Date(lastMor)
    nextDate.setMonth(nextDate.getMonth() + monthsToAdd)
    return nextDate
  }

  const getMorUrgency = (nextDate: any) => {
    if (!nextDate) return 'none'
    const daysUntil = Math.ceil((nextDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    if (daysUntil < 0) return 'overdue'
    if (daysUntil <= 90) return 'urgent'
    if (daysUntil <= 180) return 'warning'
    return 'ok'
  }

  const urgencyClasses = (urgency: string) =>
    urgency === 'overdue' ? 'bg-red-100 text-red-700' :
    urgency === 'urgent' ? 'bg-orange-100 text-orange-700' :
    urgency === 'warning' ? 'bg-yellow-100 text-yellow-700' :
    'bg-green-100 text-green-700'

  const riskBadgeClasses = (risk: string) =>
    risk === 'Troubled' ? 'bg-red-100 text-red-700' :
    risk === 'Potentially Troubled' ? 'bg-yellow-100 text-yellow-700' :
    risk === 'Unknown' ? 'bg-gray-100 text-gray-700' :
    'bg-green-100 text-green-700'

  const getMorCell = (property: any) => {
    const activeMorDate = getActiveMorDate(property)
    if (activeMorDate) {
      return { label: `📋 MOR Scheduled: ${activeMorDate.toLocaleDateString('en-US', { timeZone: 'UTC' })}`, classes: 'bg-blue-100 text-blue-700' }
    }
    const nextMor = getNextMorDate(property)
    if (!nextMor) return { label: 'No MOR date recorded', classes: 'bg-gray-100 text-gray-400' }
    const urgency = getMorUrgency(nextMor)
    const daysUntil = Math.ceil((nextMor.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    const label = urgency === 'overdue'
      ? `⚠️ MOR overdue by ${Math.abs(daysUntil)} days`
      : `📅 Next MOR due: ${nextMor.toLocaleDateString()} (${daysUntil} days)`
    return { label, classes: urgencyClasses(urgency) }
  }

  const getResponseCell = (property: any) => {
    const responseDue = getResponseDueDate(property)
    if (!responseDue) return { label: 'No response due date set', classes: 'bg-gray-100 text-gray-500' }
    const urgency = getResponseUrgency(responseDue)
    const daysUntil = Math.ceil((responseDue.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
    const label = urgency === 'overdue'
      ? `⚠️ Response overdue by ${Math.abs(daysUntil)} days`
      : `📝 Response Due: ${responseDue.toLocaleDateString('en-US', { timeZone: 'UTC' })} (${daysUntil} days)`
    return { label, classes: urgencyClasses(urgency) }
  }

  const deleteProperty = (property: any) => {
    if (confirm('Are you sure you want to delete this property? This will delete all documents, tasks, meetings and findings associated with it.')) {
      supabase.from('properties').delete().eq('id', property.id).then(() => fetchProperties())
    }
  }

  const getEffectiveMorDate = (property: any) => getActiveMorDate(property) || getNextMorDate(property)

  const filtered =[...(filterCompany === 'all' ? properties : properties.filter((p: any) => p.company_id === filterCompany))].sort((a: any, b: any) => {
    let aVal: any, bVal: any
    if (sortBy === 'name') { aVal = (a.name || '').toLowerCase(); bVal = (b.name || '').toLowerCase() }
    else if (sortBy === 'company') { aVal = (a.companies?.name || '').toLowerCase(); bVal = (b.companies?.name || '').toLowerCase() }
    else if (sortBy === 'next_mor') {
      aVal = getNextMorDate(a)?.getTime() ?? Infinity
      bVal = getNextMorDate(b)?.getTime() ?? Infinity
    }
    else if (sortBy === 'response_due') {
      aVal = getResponseDueDate(a)?.getTime() ?? Infinity
      bVal = getResponseDueDate(b)?.getTime() ?? Infinity
    }
    else if (sortBy === 'rating') {
      aVal = ratingRank[a.last_mor_rating] ?? 0
      bVal = ratingRank[b.last_mor_rating] ?? 0
    }
    else if (sortBy === 'contract') { aVal = (a.contract_type || '').toLowerCase(); bVal = (b.contract_type || '').toLowerCase() }
    else if (sortBy === 'risk') {
      aVal = riskRank[a.risk_classification] ?? 0
      bVal = riskRank[b.risk_classification] ?? 0
    }
    else if (sortBy === 'mor_date') {
      aVal = getEffectiveMorDate(a)?.getTime() ?? Infinity
      bVal = getEffectiveMorDate(b)?.getTime() ?? Infinity
    }
    if (aVal < bVal) return sortAsc ? -1 : 1
    if (aVal > bVal) return sortAsc ? 1 : -1
    return 0
  })

  const exportToExcel = () => {
    if (filtered.length === 0) { alert('No properties to export.'); return }
    const fmt = (d: Date | null, utc = false) =>
      d ? d.toLocaleDateString('en-US', utc ? { timeZone: 'UTC' } : undefined) : ''
    const headers = ['Property Name', 'Company', 'Address', 'Contract Type', 'Risk Classification', 'Last MOR Rating', 'Scheduled MOR Date', 'Next MOR Due', 'Response Due By']
    const rows = filtered.map((p: any) => ({
      'Property Name': p.name || '',
      'Company': p.companies?.name || '',
      'Address': p.address || '',
      'Contract Type': p.contract_type || '',
      'Risk Classification': p.risk_classification || '',
      'Last MOR Rating': p.last_mor_rating || '',
      'Scheduled MOR Date': fmt(getActiveMorDate(p), true),
      'Next MOR Due': fmt(getNextMorDate(p)),
      'Response Due By': fmt(getResponseDueDate(p), true),
    }))
    const ws = XLSX.utils.json_to_sheet(rows, { header: headers })
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Properties')
    XLSX.writeFile(wb, `properties-export-${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">MOR Inspection Manager</h1>
        <div className="flex items-center gap-4">
          <button
            onClick={() => window.location.href = '/templates'}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            Templates
          </button>
          <button
            onClick={() => window.location.href = '/users'}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            Team Members
          </button>
          <button
            onClick={async () => { await supabase.auth.signOut(); window.location.href = '/' }}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Sign Out
          </button>
          </div>
        </nav>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-gray-800">Properties</h2>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAddCompany(true)}
              className="bg-gray-600 text-white px-4 py-2 rounded font-medium hover:bg-gray-700 text-sm"
            >
              + Add Company
            </button>
            <input
              ref={importInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImportFile}
            />
            <button
              onClick={() => importInputRef.current?.click()}
              className="bg-green-600 text-white px-4 py-2 rounded font-medium hover:bg-green-700 text-sm"
            >
              ⬆ Import Properties
            </button>
            <button
              onClick={exportToExcel}
              className="bg-indigo-600 text-white px-4 py-2 rounded font-medium hover:bg-indigo-700 text-sm"
            >
              ⬇ Export
            </button>
            <button
              onClick={() => setShowAddProperty(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 text-sm"
            >
              + Add Property
            </button>
          </div>
        </div>

        {/* Company Filter */}
        <div className="mb-4 flex items-center gap-3">
          <select
            value={filterCompany}
            onChange={(e: any) => setFilterCompany(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="all">All Companies</option>
            {companies.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {filterCompany !== 'all' && userRole === 'super_admin' && (
            <button
              onClick={() => {
                if (confirm('Are you sure you want to delete this company? This will also delete all properties under it.')) {
                  supabase.from('companies').delete().eq('id', filterCompany).then(() => {
                    setFilterCompany('all')
                    fetchCompanies()
                    fetchProperties()
                  })
                }
              }}
              className="text-red-400 hover:text-red-600 text-sm"
            >
              🗑️ Delete Company
            </button>
          )}
        </div>

        {/* Sort Controls */}
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Sort by:</span>
          {[
            { key: 'name', label: 'Property Name' },
            { key: 'company', label: 'Company' },
            { key: 'next_mor', label: 'Next MOR Date' },
            { key: 'response_due', label: 'Response Due By' },
            { key: 'rating', label: 'Last MOR Rating' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { if (sortBy === key) setSortAsc(!sortAsc); else { setSortBy(key); setSortAsc(true) } }}
              className={`text-xs px-3 py-1 rounded border transition ${
                sortBy === key
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              {label}{sortBy === key ? (sortAsc ? ' ↑' : ' ↓') : ''}
            </button>
          ))}

          <div className="ml-auto flex items-center border border-gray-300 rounded overflow-hidden">
            <button
              onClick={() => changeViewMode('list')}
              title="List view"
              className={`px-2 py-1 ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="2" rx="1" /><rect x="1" y="7" width="14" height="2" rx="1" /><rect x="1" y="12" width="14" height="2" rx="1" /></svg>
            </button>
            <button
              onClick={() => changeViewMode('grid')}
              title="Grid view"
              className={`px-2 py-1 ${viewMode === 'grid' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" /><rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" /></svg>
            </button>
          </div>
        </div>

        {/* Properties List */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            No properties yet. Click "+ Add Property" to get started.
          </div>
        ) : viewMode === 'list' ? (
          <div className="bg-white rounded-lg shadow overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr className="text-left text-xs text-gray-500">
                  {[
                    { key: 'name', label: 'Property Name' },
                    { key: 'company', label: 'Company' },
                    { key: 'contract', label: 'Contract Type' },
                    { key: 'risk', label: 'Risk Classification' },
                    { key: 'rating', label: 'Last MOR Rating' },
                    { key: 'mor_date', label: 'MOR Date' },
                    { key: 'response_due', label: 'Response Due By' },
                  ].map(({ key, label }) => (
                    <th
                      key={key}
                      onClick={() => toggleSort(key)}
                      className="px-4 py-3 font-medium cursor-pointer select-none hover:text-gray-700 whitespace-nowrap"
                    >
                      {label}{sortBy === key ? (sortAsc ? ' ▲' : ' ▼') : ''}
                    </th>
                  ))}
                  {userRole === 'super_admin' && <th className="px-4 py-3 font-medium"></th>}
                </tr>
              </thead>
              <tbody className="divide-y">
                {filtered.map(property => {
                  const mor = getMorCell(property)
                  const resp = getResponseCell(property)
                  return (
                    <tr key={property.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 align-top">
                        <button
                          onClick={() => window.location.href = `/properties/${property.id}`}
                          className="font-medium text-blue-600 hover:underline text-left"
                        >
                          {property.name}
                        </button>
                        {property.address && <p className="text-xs text-gray-400">{property.address}</p>}
                      </td>
                      <td className="px-4 py-3 align-top text-gray-600">{property.companies?.name || '—'}</td>
                      <td className="px-4 py-3 align-top">
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded whitespace-nowrap">{property.contract_type || '—'}</span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {property.risk_classification
                          ? <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${riskBadgeClasses(property.risk_classification)}`}>{property.risk_classification}</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {property.last_mor_rating
                          ? <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded whitespace-nowrap">{property.last_mor_rating}</span>
                          : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${mor.classes}`}>{mor.label}</span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className={`text-xs px-2 py-1 rounded whitespace-nowrap ${resp.classes}`}>{resp.label}</span>
                      </td>
                      {userRole === 'super_admin' && (
                        <td className="px-4 py-3 align-top text-right">
                          <button onClick={() => deleteProperty(property)} className="text-red-400 hover:text-red-600 text-xs" title="Delete property">🗑️</button>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(property => (
              <div
              key={property.id}
              className="bg-white rounded-lg shadow p-5 hover:shadow-md transition relative"
            >
              {userRole === 'super_admin' && (
              <button
                onClick={(e: any) => {
                  e.stopPropagation()
                  if (confirm('Are you sure you want to delete this property? This will delete all documents, tasks, meetings and findings associated with it.')) {
                    supabase.from('properties').delete().eq('id', property.id).then(() => fetchProperties())
                  }
                }}
                className="absolute top-3 right-3 text-red-400 hover:text-red-600 text-xs"
              >
                🗑️
              </button>
              )}
              <div onClick={() => window.location.href = `/properties/${property.id}`} className="cursor-pointer">
              <h3 className="font-bold text-gray-800">{property.name}</h3>
              <p className="text-sm text-gray-500 mt-1">{property.companies?.name}</p>
              <p className="text-sm text-gray-500">{property.address}</p>


              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                  {property.contract_type || 'No contract type'}
                </span>
                {property.risk_classification && (
                  <span className={`text-xs px-2 py-1 rounded ${
                    property.risk_classification === 'Troubled' ? 'bg-red-100 text-red-700' :
                    property.risk_classification === 'Potentially Troubled' ? 'bg-yellow-100 text-yellow-700' :
                    property.risk_classification === 'Unknown' ? 'bg-gray-100 text-gray-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {property.risk_classification}
                  </span>
                )}
                {property.last_mor_rating && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded">
                    {property.last_mor_rating}
                  </span>
                )}
              </div>

              {(() => {
                const activeMorDate = getActiveMorDate(property)
                if (activeMorDate) return (
                  <div className="mt-3 text-xs px-2 py-1 rounded bg-blue-100 text-blue-700">
                    📋 MOR Scheduled: {activeMorDate.toLocaleDateString('en-US', { timeZone: 'UTC' })}
                  </div>
                )
                const nextMor = getNextMorDate(property)
                const urgency = getMorUrgency(nextMor)
                if (!nextMor) return (
                  <p className="text-xs text-gray-400 mt-3">No MOR date recorded</p>
                )
                const daysUntil = Math.ceil((nextMor.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                return (
                  <div className={`mt-3 text-xs px-2 py-1 rounded ${
                    urgency === 'overdue' ? 'bg-red-100 text-red-700' :
                    urgency === 'urgent' ? 'bg-orange-100 text-orange-700' :
                    urgency === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {urgency === 'overdue'
                      ? `⚠️ MOR overdue by ${Math.abs(daysUntil)} days`
                      : `📅 Next MOR due: ${nextMor.toLocaleDateString()} (${daysUntil} days)`
                    }
                  </div>
                )
              })()}

              {(() => {
                const responseDue = getResponseDueDate(property)
                const urgency = getResponseUrgency(responseDue)
                if (!responseDue) return (
                  <div className="mt-2 text-xs px-2 py-1 rounded bg-gray-100 text-gray-500">
                    No response due date set
                  </div>
                )
                const daysUntil = Math.ceil((responseDue.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                return (
                  <div className={`mt-2 text-xs px-2 py-1 rounded ${
                    urgency === 'overdue' ? 'bg-red-100 text-red-700' :
                    urgency === 'urgent' ? 'bg-orange-100 text-orange-700' :
                    urgency === 'warning' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-green-100 text-green-700'
                  }`}>
                    {urgency === 'overdue'
                      ? `⚠️ Response overdue by ${Math.abs(daysUntil)} days`
                      : `📝 Response Due: ${responseDue.toLocaleDateString('en-US', { timeZone: 'UTC' })} (${daysUntil} days)`
                    }
                  </div>
                )
              })()}
            </div>
            </div>
            ))}
          </div>
        )}

        {/* Import Preview Modal */}
        {showImportPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-5xl max-h-[85vh] flex flex-col">
              <h3 className="text-lg font-bold mb-1">Import Properties</h3>
              <p className="text-sm text-gray-500 mb-4">{importRows.length} {importRows.length === 1 ? 'property' : 'properties'} ready to import. Review before confirming.</p>
              <div className="overflow-auto border border-gray-200 rounded">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr className="text-left text-xs text-gray-500">
                      <th className="px-3 py-2 font-medium">Property Name</th>
                      <th className="px-3 py-2 font-medium">Address</th>
                      <th className="px-3 py-2 font-medium">Management Company</th>
                      <th className="px-3 py-2 font-medium">Contract Type</th>
                      <th className="px-3 py-2 font-medium">Last MOR Date</th>
                      <th className="px-3 py-2 font-medium">Last MOR Rating</th>
                      <th className="px-3 py-2 font-medium">Risk Classification</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {importRows.map((r: any, i: number) => (
                      <tr key={i} className="text-gray-800">
                        <td className="px-3 py-2">{r.name || '—'}</td>
                        <td className="px-3 py-2">{r.address || '—'}</td>
                        <td className="px-3 py-2">{r.company || '—'}</td>
                        <td className="px-3 py-2">{r.contractType || '—'}</td>
                        <td className="px-3 py-2">{r.last_mor_date || '—'}</td>
                        <td className="px-3 py-2">{r.last_mor_rating || '—'}</td>
                        <td className="px-3 py-2">{r.risk_classification || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3 justify-end mt-4">
                <button
                  onClick={() => { setShowImportPreview(false); setImportRows([]) }}
                  disabled={importing}
                  className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmImport}
                  disabled={importing}
                  className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50"
                >
                  {importing ? 'Importing...' : `Import ${importRows.length} ${importRows.length === 1 ? 'Property' : 'Properties'}`}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Add Company Modal */}
        {showAddCompany && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">Add Company</h3>
              <input
                type="text"
                placeholder="Company name"
                value={newCompany.name}
                onChange={(e) => setNewCompany({ name: e.target.value })}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm mb-4"
              />
              <div className="flex gap-3 justify-end">
                <button onClick={() => setShowAddCompany(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
                <button onClick={addCompany} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Add Company</button>
              </div>
            </div>
          </div>
        )}

        {/* Add Property Modal */}
        {showAddProperty && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">Add Property</h3>
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Property name *"
                  value={newProperty.name}
                  onChange={(e) => setNewProperty({...newProperty, name: e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
                <input
                  type="text"
                  placeholder="Address"
                  value={newProperty.address}
                  onChange={(e) => setNewProperty({...newProperty, address: e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
                <select
                  value={newProperty.company_id}
                  onChange={(e) => setNewProperty({...newProperty, company_id: e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option value="">Select Company</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                <select
                  value={newProperty.contract_type}
                  onChange={(e) => setNewProperty({...newProperty, contract_type: e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                >
                  <option value="">Select Contract Type</option>
                  <option value="Option 1">Option 1</option>
                  <option value="Option 2">Option 2</option>
                  <option value="Option 3">Option 3</option>
                </select>
              </div>
              <div className="flex gap-3 justify-end mt-4">
                <button onClick={() => setShowAddProperty(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
                <button onClick={addProperty} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Add Property</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}