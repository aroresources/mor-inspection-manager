'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Dashboard() {
  const [user, setUser] = useState(null)
  const [properties, setProperties] = useState([])
  const [companies, setCompanies] = useState([])
  const [showAddProperty, setShowAddProperty] = useState(false)
  const [showAddCompany, setShowAddCompany] = useState(false)
  const [newProperty, setNewProperty] = useState({
    name: '', address: '', company_id: '', contract_type: '', mor_date: ''
  })
  const [newCompany, setNewCompany] = useState({ name: '' })
  const [filterCompany, setFilterCompany] = useState('all')

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/'
      } else {
        setUser(user)
        fetchProperties()
        fetchCompanies()
      }
    }
    getUser()
  }, [])

  const fetchProperties = async () => {
    const { data } = await supabase
      .from('properties')
      .select('*, companies(name)')
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
    setNewProperty({ name: '', address: '', company_id: '', contract_type: '', mor_date: '' })
    setShowAddProperty(false)
    fetchProperties()
  }

  const filtered = filterCompany === 'all'
    ? properties
    : properties.filter(p => p.company_id === filterCompany)

  const getNextMorDate = (property) => {
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
        if (rating === 'Unsatisfactory' || rating === 'Below Average' || rating === 'Satisfactory') {
          monthsToAdd = 12
        } else if (rating === 'Above Average' || rating === 'Superior') {
          monthsToAdd = 36
        }
      }
    }

    const nextDate = new Date(lastMor)
    nextDate.setMonth(nextDate.getMonth() + monthsToAdd)
    return nextDate
  }

  const getMorUrgency = (nextDate) => {
    if (!nextDate) return 'none'
    const daysUntil = Math.ceil((nextDate - new Date()) / (1000 * 60 * 60 * 24))
    if (daysUntil < 0) return 'overdue'
    if (daysUntil <= 90) return 'urgent'
    if (daysUntil <= 180) return 'warning'
    return 'ok'
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">MOR Inspection Manager</h1>
        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.href = '/' }}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Sign Out
        </button>
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
            <button
              onClick={() => setShowAddProperty(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700 text-sm"
            >
              + Add Property
            </button>
          </div>
        </div>

        {/* Company Filter */}
        <div className="mb-4">
          <select
            value={filterCompany}
            onChange={(e) => setFilterCompany(e.target.value)}
            className="border border-gray-300 rounded px-3 py-2 text-sm"
          >
            <option value="all">All Companies</option>
            {companies.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Properties List */}
        {filtered.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
            No properties yet. Click "+ Add Property" to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(property => (
              <div
              key={property.id}
              onClick={() => window.location.href = `/properties/${property.id}`}
              className="bg-white rounded-lg shadow p-5 cursor-pointer hover:shadow-md transition"
            >
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
                const nextMor = getNextMorDate(property)
                const urgency = getMorUrgency(nextMor)
                if (!nextMor) return (
                  <p className="text-xs text-gray-400 mt-3">No MOR date recorded</p>
                )
                const daysUntil = Math.ceil((nextMor - new Date()) / (1000 * 60 * 60 * 24))
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
            </div>
            ))}
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
                <input
                  type="date"
                  placeholder="MOR Date"
                  value={newProperty.mor_date}
                  onChange={(e) => setNewProperty({...newProperty, mor_date: e.target.value})}
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                />
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