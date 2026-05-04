'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

function DocumentsTab({ propertyId }) {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddCustom, setShowAddCustom] = useState(false)
  const [customDoc, setCustomDoc] = useState({ name: '', assigned_to: '', due_date: '', notes: '' })

  useEffect(() => {
    fetchDocuments()
  }, [propertyId])

  const fetchDocuments = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('property_id', propertyId)
      .order('sort_order')
    if (data && data.length > 0) {
      setDocuments(data)
    } else {
      await loadFromTemplates()
    }
    setLoading(false)
  }

  const loadFromTemplates = async () => {
    const { data: tmpl } = await supabase
      .from('document_templates')
      .select('*')
      .order('sort_order')
    if (tmpl) {
      const docs = tmpl.map((t, i) => ({
        property_id: propertyId,
        name: t.name,
        category: t.category,
        is_required: true,
        status: 'Not Started',
        is_custom: false,
        sort_order: i
      }))
      const { data: inserted } = await supabase
        .from('documents')
        .insert(docs)
        .select()
      if (inserted) setDocuments(inserted.sort((a, b) => a.sort_order - b.sort_order))
    }
  }

  const updateDoc = async (id, updates) => {
    await supabase.from('documents').update(updates).eq('id', id)
    setDocuments(docs => docs.map(d => d.id === id ? { ...d, ...updates } : d))
  }

  const moveDoc = async (index, direction) => {
    const newDocs = [...documents]
    const swapIndex = index + direction
    if (swapIndex < 0 || swapIndex >= newDocs.length) return
    
    const temp = newDocs[index]
    newDocs[index] = newDocs[swapIndex]
    newDocs[swapIndex] = temp

    const updated = newDocs.map((d, i) => ({ ...d, sort_order: i }))
    setDocuments(updated)

    await supabase.from('documents').update({ sort_order: updated[index].sort_order }).eq('id', updated[index].id)
    await supabase.from('documents').update({ sort_order: updated[swapIndex].sort_order }).eq('id', updated[swapIndex].id)
  }

  const addCustomDoc = async () => {
    if (!customDoc.name) return
    const maxOrder = documents.length
    const { data } = await supabase
      .from('documents')
      .insert([{ ...customDoc, property_id: propertyId, status: 'Not Started', is_custom: true, sort_order: maxOrder }])
      .select()
    if (data) {
      setDocuments([...documents, ...data])
      setCustomDoc({ name: '', assigned_to: '', due_date: '', notes: '' })
      setShowAddCustom(false)
    }
  }

const indexedDocs = documents.map((doc, index) => ({ ...doc, globalIndex: index }))
  const completed = documents.filter(d => d.status === 'Submitted').length
  const total = documents.length

  if (loading) return <div className="bg-white rounded-lg shadow p-6 text-gray-500">Loading documents...</div>

  return (
    <div className="space-y-4">
      {/* Progress Bar */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Progress: {completed} of {total} submitted</span>
          <button
            onClick={() => setShowAddCustom(true)}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
          >
            + Add Custom Document
          </button>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{ width: total > 0 ? `${(completed / total) * 100}%` : '0%' }}
          />
        </div>
      </div>

{/* Documents List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="divide-y">
          {indexedDocs.map((doc) => (
              <div key={doc.id} className="p-4">
                <div className="flex items-start gap-2">
                  {/* Up/Down arrows */}
                  <div className="flex flex-col gap-1 mt-1">
                    <button
                      onClick={() => moveDoc(doc.globalIndex, -1)}
                      className="text-gray-400 hover:text-gray-600 text-xs leading-none"
                    >▲</button>
                    <button
                      onClick={() => moveDoc(doc.globalIndex, 1)}
                      className="text-gray-400 hover:text-gray-600 text-xs leading-none"
                    >▼</button>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={doc.is_required}
                        onChange={(e) => updateDoc(doc.id, { is_required: e.target.checked })}
                        className="mt-1"
                      />
                      <span className={`text-sm ${!doc.is_required ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                        {doc.name}
                        {doc.is_custom && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1 rounded">Custom</span>}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 ml-6">
                      <input
                        type="text"
                        placeholder="Assigned to"
                        value={doc.assigned_to || ''}
                        onChange={(e) => updateDoc(doc.id, { assigned_to: e.target.value })}
                        className="border border-gray-200 rounded px-2 py-1 text-xs"
                      />
                      <input
                        type="date"
                        value={doc.due_date || ''}
                        onChange={(e) => updateDoc(doc.id, { due_date: e.target.value })}
                        className="border border-gray-200 rounded px-2 py-1 text-xs"
                      />
                      <select
                        value={doc.status || 'Not Started'}
                        onChange={(e) => updateDoc(doc.id, { status: e.target.value })}
                        className="border border-gray-200 rounded px-2 py-1 text-xs"
                      >
                        <option value="Not Started">Not Started</option>
                        <option value="In Progress">In Progress</option>
                        <option value="Uploaded">Uploaded</option>
                        <option value="Submitted">Submitted</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      placeholder="Notes"
                      value={doc.notes || ''}
                      onChange={(e) => updateDoc(doc.id, { notes: e.target.value })}
                      className="mt-1 ml-6 w-full border border-gray-200 rounded px-2 py-1 text-xs"
                    />
                  </div>
                </div>
              </div>
       ))}
        </div>
      </div>

      {/* Add Custom Document Modal */}
      {showAddCustom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Add Custom Document</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Document name *"
                value={customDoc.name}
                onChange={(e) => setCustomDoc({...customDoc, name: e.target.value})}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Assigned to"
                value={customDoc.assigned_to}
                onChange={(e) => setCustomDoc({...customDoc, assigned_to: e.target.value})}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={customDoc.due_date}
                onChange={(e) => setCustomDoc({...customDoc, due_date: e.target.value})}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Notes"
                value={customDoc.notes}
                onChange={(e) => setCustomDoc({...customDoc, notes: e.target.value})}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setShowAddCustom(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button onClick={addCustomDoc} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Add Document</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function PropertyPage() {
  const { id } = useParams()
  const [property, setProperty] = useState(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) window.location.href = '/'
    }
    getUser()
    fetchProperty()
  }, [id])

  const fetchProperty = async () => {
    const { data } = await supabase
      .from('properties')
      .select('*, companies(name)')
      .eq('id', id)
      .single()
    if (data) {
      setProperty(data)
      setForm(data)
    }
  }

  const saveProperty = async () => {
    setSaving(true)
    await supabase.from('properties').update(form).eq('id', id)
    await fetchProperty()
    setEditing(false)
    setSaving(false)
  }

  if (!property) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  )

  const tabs = ['Overview', 'Documents', 'Tasks', 'Meetings', 'Findings']

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => window.location.href = '/dashboard'} className="text-sm text-blue-600 hover:underline">
            ← Back to Dashboard
          </button>
          <h1 className="text-xl font-bold text-gray-800">{property.name}</h1>
          <span className="text-sm text-gray-500">{property.companies?.name}</span>
        </div>
        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.href = '/' }}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Sign Out
        </button>
      </nav>

      {/* Tabs */}
      <div className="bg-white border-b px-6">
        <div className="flex gap-6">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab.toLowerCase())}
              className={`py-4 text-sm font-medium border-b-2 transition ${
                activeTab === tab.toLowerCase()
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-6 py-8">
        {activeTab === 'overview' && (
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-bold text-gray-800">Property Overview</h2>
              {!editing ? (
                <button onClick={() => setEditing(true)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
                  Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">
                    Cancel
                  </button>
                  <button onClick={saveProperty} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { label: 'Property Name', field: 'name', type: 'text' },
                { label: 'Address', field: 'address', type: 'text' },
                { label: 'FHA Number', field: 'fha_number', type: 'text' },
                { label: 'Section 8 / PAC / PRAC #', field: 'section8_number', type: 'text' },
                { label: 'Contract Administrator', field: 'contract_administrator', type: 'text' },
                { label: 'MOR Date', field: 'mor_date', type: 'date' },
                { label: 'Last MOR Date', field: 'last_mor_date', type: 'date' },
                { label: 'Last MOR Score', field: 'last_mor_score', type: 'text' },
              ].map(({ label, field, type }) => (
                <div key={field}>
                  <label className="block text-xs text-gray-500 mb-1">{label}</label>
                  {editing ? (
                    <input
                      type={type}
                      value={form[field] || ''}
                      onChange={(e) => setForm({...form, [field]: e.target.value})}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                  ) : (
                    <p className="text-sm font-medium text-gray-800">{property[field] || '—'}</p>
                  )}
                </div>
              ))}

              <div>
                <label className="block text-xs text-gray-500 mb-1">Last MOR Rating</label>
                {editing ? (
                  <select
                    value={form.last_mor_rating || ''}
                    onChange={(e) => setForm({...form, last_mor_rating: e.target.value})}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  >
                    <option value="">Select Rating</option>
                    <option value="Unsatisfactory">Unsatisfactory</option>
                    <option value="Below Average">Below Average</option>
                    <option value="Satisfactory">Satisfactory</option>
                    <option value="Above Average">Above Average</option>
                    <option value="Superior">Superior</option>
                  </select>
                ) : (
                  <p className="text-sm font-medium text-gray-800">{property.last_mor_rating || '—'}</p>
                )}
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Contract Type</label>
                {editing ? (
                  <select
                    value={form.contract_type || ''}
                    onChange={(e) => setForm({...form, contract_type: e.target.value})}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  >
                    <option value="">Select Type</option>
                    <option value="Option 1">Option 1</option>
                    <option value="Option 2">Option 2</option>
                    <option value="Option 3">Option 3</option>
                  </select>
                ) : (
                  <p className="text-sm font-medium text-gray-800">{property.contract_type || '—'}</p>
                )}
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Risk Classification</label>
                {editing ? (
                  <select
                    value={form.risk_classification || ''}
                    onChange={(e) => setForm({...form, risk_classification: e.target.value})}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  >
                    <option value="">Select Classification</option>
                    <option value="Unknown">Unknown</option>
                    <option value="Troubled">Troubled</option>
                    <option value="Potentially Troubled">Potentially Troubled</option>
                    <option value="Not Troubled">Not Troubled</option>
                  </select>
                ) : (
                  <p className="text-sm font-medium text-gray-800">{property.risk_classification || '—'}</p>
                )}
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-xs text-gray-500 mb-1">HUD Communication Notes</label>
              {editing ? (
                <textarea
                  value={form.hud_notes || ''}
                  onChange={(e) => setForm({...form, hud_notes: e.target.value})}
                  rows={3}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              ) : (
                <p className="text-sm text-gray-800">{property.hud_notes || '—'}</p>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-xs text-gray-500 mb-1">Last NSPIRE Notes</label>
              {editing ? (
                <textarea
                  value={form.last_nspire_notes || ''}
                  onChange={(e) => setForm({...form, last_nspire_notes: e.target.value})}
                  rows={3}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
              ) : (
                <p className="text-sm text-gray-800">{property.last_nspire_notes || '—'}</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'documents' && (
          <DocumentsTab propertyId={id} />
        )}

        {activeTab === 'tasks' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Prep Tasks</h2>
            <p className="text-gray-500 text-sm">Coming soon.</p>
          </div>
        )}

        {activeTab === 'meetings' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Meeting Notes</h2>
            <p className="text-gray-500 text-sm">Coming soon.</p>
          </div>
        )}

        {activeTab === 'findings' && (
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4">Findings & Response</h2>
            <p className="text-gray-500 text-sm">Coming soon.</p>
          </div>
        )}
      </main>
    </div>
  )
}