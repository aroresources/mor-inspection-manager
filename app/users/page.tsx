'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
const [companies, setCompanies] = useState<any[]>([])
const [properties, setProperties] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [newUser, setNewUser] = useState({ email: '', full_name: '', role: 'property_manager', company_id: '' })
  const [selectedUser, setSelectedUser] = useState<any>(null)
  const [userProperties, setUserProperties] = useState<any[]>([])
  const [showPropertyAccess, setShowPropertyAccess] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) window.location.href = '/'
    }
    getUser()
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data: profiles } = await supabase
      .from('profiles')
      .select('*, companies(name)')
      .order('full_name')
    const { data: companies } = await supabase
      .from('companies')
      .select('*')
      .order('name')
    const { data: properties } = await supabase
      .from('properties')
      .select('*, companies(name)')
      .order('name')
    if (profiles) setUsers(profiles)
    if (companies) setCompanies(companies)
    if (properties) setProperties(properties)
    setLoading(false)
  }

  const inviteUser = async (e: any) => {
    if (e) e.preventDefault()
    if (!newUser.email) return
    
    try {
      const { data, error } = await supabase.auth.signUp({
        email: newUser.email,
        password: Math.random().toString(36).slice(-10),
        options: {
          data: {
            full_name: newUser.full_name
          }
        }
      })
      
      if (error) {
        alert('Error creating user: ' + error.message)
        return
      }

      if (data?.user) {
        await supabase.from('profiles').insert([{
          id: data.user.id,
          email: newUser.email,
          full_name: newUser.full_name,
          role: newUser.role,
          company_id: newUser.company_id || null
        }])
      }

      alert(`User ${newUser.email} created! They will need to reset their password via the login page.`)
      setNewUser({ email: '', full_name: '', role: 'property_manager', company_id: '' })
      setShowInvite(false)
      fetchData()
    } catch (err: any) {
      alert('Error: ' + err.message)
    }
  }
  const updateUserRole = async (userId: any, role: any) => {
    await supabase.from('profiles').update({ role }).eq('id', userId)
    setUsers(users.map(u => u.id === userId ? { ...u, role } : u))
  }

  const updateUserCompany = async (userId: any, company_id: any) => {
    await supabase.from('profiles').update({ company_id: company_id || null }).eq('id', userId)
    setUsers(users.map(u => u.id === userId ? { ...u, company_id } : u))
  }

  const openPropertyAccess = async (user: any) => {
    setSelectedUser(user)
    const { data } = await supabase
      .from('property_access')
      .select('property_id')
      .eq('user_id', user.id)
    if (data) setUserProperties(data.map(d => d.property_id))
    setShowPropertyAccess(true)
  }

  const togglePropertyAccess = async (propertyId: any) => {
    if (userProperties.includes(propertyId)) {
      await supabase.from('property_access')
        .delete()
        .eq('user_id', selectedUser.id)
        .eq('property_id', propertyId)
      setUserProperties(userProperties.filter(id => id !== propertyId))
    } else {
      await supabase.from('property_access')
        .insert([{ user_id: selectedUser.id, property_id: propertyId }])
      setUserProperties([...userProperties, propertyId])
    }
  }

  const getRoleBadge = (role: any) => {
    const styles = {
      super_admin: 'bg-red-100 text-red-700',
      asset_manager: 'bg-blue-100 text-blue-700',
      property_manager: 'bg-green-100 text-green-700'
    }
    const labels = {
      super_admin: 'Super Admin',
      asset_manager: 'Asset Manager',
      property_manager: 'Property Manager'
    }
    return (
      <span className={`text-xs px-2 py-1 rounded ${styles[role] || 'bg-gray-100 text-gray-700'}`}>
        {labels[role] || role}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => window.location.href = '/dashboard'} className="text-sm text-blue-600 hover:underline">
            ← Back to Dashboard
          </button>
          <h1 className="text-xl font-bold text-gray-800">Team Members</h1>
        </div>
        <button
          onClick={async () => { await supabase.auth.signOut(); window.location.href = '/' }}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Sign Out
        </button>
      </nav>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Team Members</h2>
            <p className="text-sm text-gray-500">Manage access and roles for your team.</p>
          </div>
          <button
            onClick={() => setShowInvite(true)}
            className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            + Invite User
          </button>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <p className="p-6 text-gray-500 text-sm">Loading...</p>
          ) : users.length === 0 ? (
            <p className="p-6 text-gray-500 text-sm text-center">No team members yet.</p>
          ) : (
            <div className="divide-y">
              {users.map(user => (
                <div key={user.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{user.full_name || user.email}</p>
                      <p className="text-xs text-gray-500">{user.email}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      {getRoleBadge(user.role)}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-500">Role</label>
                      <select
                        value={user.role}
                        onChange={(e: any) => updateUserRole(user.id, e.target.value)}
                        className="w-full mt-1 border border-gray-200 rounded px-2 py-1 text-xs"
                      >
                        <option value="super_admin">Super Admin</option>
                        <option value="asset_manager">Asset Manager</option>
                        <option value="property_manager">Property Manager</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-gray-500">Company Access</label>
                      <select
                        value={user.company_id || ''}
                        onChange={(e: any) => updateUserCompany(user.id, e.target.value)}
                        className="w-full mt-1 border border-gray-200 rounded px-2 py-1 text-xs"
                      >
                        <option value="">All Companies</option>
                        {companies.map(c => (
                          <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {user.role === 'property_manager' && (
                    <button
                      onClick={() => openPropertyAccess(user)}
                      className="mt-2 text-xs text-blue-600 hover:underline"
                    >
                      Manage Property Access →
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Invite User Modal */}
      {showInvite && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Invite Team Member</h3>
            <div className="space-y-3">
              <input
                type="email"
                placeholder="Email address *"
                value={newUser.email}
                onChange={(e: any) => setNewUser({...newUser, email: e.target.value})}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Full name"
                value={newUser.full_name}
                onChange={(e: any) => setNewUser({...newUser, full_name: e.target.value})}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <select
                value={newUser.role}
                onChange={(e: any) => setNewUser({...newUser, role: e.target.value})}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="property_manager">Property Manager</option>
                <option value="asset_manager">Asset Manager</option>
                <option value="super_admin">Super Admin</option>
              </select>
              <select
                value={newUser.company_id}
                onChange={(e: any) => setNewUser({...newUser, company_id: e.target.value})}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              >
                <option value="">All Companies</option>
                {companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setShowInvite(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button onClick={inviteUser} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Send Invite</button>
            </div>
          </div>
        </div>
      )}

      {/* Property Access Modal */}
      {showPropertyAccess && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-1">Property Access</h3>
            <p className="text-sm text-gray-500 mb-4">{selectedUser.full_name || selectedUser.email}</p>
            <div className="space-y-2">
              {properties.map(property => (
                <label key={property.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={userProperties.includes(property.id)}
                    onChange={() => togglePropertyAccess(property.id)}
                  />
                  <div>
                    <p className="text-sm text-gray-800">{property.name}</p>
                    <p className="text-xs text-gray-500">{property.companies?.name}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowPropertyAccess(false)} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Done</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}