'use client'
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function Dashboard() {
  const [user, setUser] = useState(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/'
      } else {
        setUser(user)
      }
    }
    getUser()
  }, [])

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">MOR Inspection Manager</h1>
        <button
          onClick={async () => {
            await supabase.auth.signOut()
            window.location.href = '/'
          }}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Sign Out
        </button>
      </nav>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Properties</h2>
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500">
          No properties yet. Click below to add your first property.
        </div>
        <button className="mt-4 bg-blue-600 text-white px-4 py-2 rounded font-medium hover:bg-blue-700">
          + Add Property
        </button>
      </main>
    </div>
  )
}