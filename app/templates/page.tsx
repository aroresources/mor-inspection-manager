'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function TemplatesPage() {
  const router = useRouter()
  const [docTemplates, setDocTemplates] = useState<any[]>([])
const [taskTemplates, setTaskTemplates] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('documents')
  const [loading, setLoading] = useState(true)
  const [newDoc, setNewDoc] = useState({ name: '', category: '' })
  const [newTask, setNewTask] = useState({ title: '', default_assignee_role: '' })
  const [showAddDoc, setShowAddDoc] = useState(false)
  const [showAddTask, setShowAddTask] = useState(false)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) router.push('/')
    }
    getUser()
    fetchTemplates()
  }, [])

  const fetchTemplates = async () => {
    setLoading(true)
    const { data: docs } = await supabase
      .from('document_templates')
      .select('*')
      .order('sort_order')
    const { data: tasks } = await supabase
      .from('task_templates')
      .select('*')
      .order('created_at')
    if (docs) setDocTemplates(docs)
    if (tasks) setTaskTemplates(tasks)
    setLoading(false)
  }

  const addDocTemplate = async (e: any) => {
    if (e) e.preventDefault()
    if (!newDoc.name) return
    const { data } = await supabase
      .from('document_templates')
      .insert([{ name: newDoc.name, category: newDoc.category || null, is_default: true }])
      .select()
    if (data) {
      setDocTemplates([...docTemplates, ...data])
      setNewDoc({ name: '', category: '' })
      setShowAddDoc(false)
    }
  }

  const deleteDocTemplate = async (id: any) => {
    await supabase.from('document_templates').delete().eq('id', id)
    setDocTemplates(docTemplates.filter((d: any) => d.id !== id))
  }

  const addTaskTemplate = async (e: any) => {
    if (e) e.preventDefault()
    if (!newTask.title) return
    const { data } = await supabase
      .from('task_templates')
      .insert([{ title: newTask.title, default_assignee_role: newTask.default_assignee_role || null }])
      .select()
    if (data) {
      setTaskTemplates([...taskTemplates, ...data])
      setNewTask({ title: '', default_assignee_role: '' })
      setShowAddTask(false)
    }
  }

  const deleteTaskTemplate = async (id: any) => {
    await supabase.from('task_templates').delete().eq('id', id)
    setTaskTemplates(taskTemplates.filter(t => t.id !== id))
  }

  const moveDoc = async (index: any, direction: any) => {
    const newDocs = [...docTemplates]
    const swapIndex = index + direction
    if (swapIndex < 0 || swapIndex >= newDocs.length) return
    const temp = newDocs[index]
    newDocs[index] = newDocs[swapIndex]
    newDocs[swapIndex] = temp
    const updated = newDocs.map((d, i) => ({ ...d, sort_order: i }))
    setDocTemplates(updated)
    await supabase.from('document_templates').update({ sort_order: updated[index].sort_order }).eq('id', updated[index].id)
    await supabase.from('document_templates').update({ sort_order: updated[swapIndex].sort_order }).eq('id', updated[swapIndex].id)
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-sm text-blue-600 hover:underline">
            ← Back to Dashboard
          </button>
          <h1 className="text-xl font-bold text-gray-800">Templates</h1>
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
          {['Documents', 'Tasks'].map(tab => (
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

      <main className="max-w-4xl mx-auto px-6 py-8">
        {activeTab === 'documents' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Document Templates</h2>
                <p className="text-sm text-gray-500">These documents will be pre-loaded for every new property.</p>
              </div>
              <button
                onClick={() => setShowAddDoc(true)}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                + Add Document
              </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              {loading ? (
                <p className="p-6 text-gray-500 text-sm">Loading...</p>
              ) : (
                <div className="divide-y">
                  {docTemplates.map((doc, index) => (
                    <div key={doc.id} className="p-4 flex items-center gap-3">
                      <div className="flex flex-col gap-1">
                        <button onClick={() => moveDoc(index, -1)} className="text-gray-400 hover:text-gray-600 text-xs leading-none">▲</button>
                        <button onClick={() => moveDoc(index, 1)} className="text-gray-400 hover:text-gray-600 text-xs leading-none">▼</button>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-gray-800">{doc.name}</p>
                        {doc.category && <p className="text-xs text-gray-500">{doc.category}</p>}
                      </div>
                      <button
                        onClick={() => deleteDocTemplate(doc.id)}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="text-lg font-bold text-gray-800">Task Templates</h2>
                <p className="text-sm text-gray-500">These tasks will be pre-loaded for every new property.</p>
              </div>
              <button
                onClick={() => setShowAddTask(true)}
                className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
              >
                + Add Task
              </button>
            </div>

            <div className="bg-white rounded-lg shadow overflow-hidden">
              {loading ? (
                <p className="p-6 text-gray-500 text-sm">Loading...</p>
              ) : (
                <div className="divide-y">
                  {taskTemplates.map((task) => (
                    <div key={task.id} className="p-4 flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-800">{task.title}</p>
                        {task.default_assignee_role && (
                          <p className="text-xs text-gray-500">Default: {task.default_assignee_role}</p>
                        )}
                      </div>
                      <button
                        onClick={() => deleteTaskTemplate(task.id)}
                        className="text-red-400 hover:text-red-600 text-xs"
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Add Document Modal */}
      {showAddDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Add Document Template</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Document name *"
                value={newDoc.name}
                onChange={(e: any) => setNewDoc({...newDoc, name: e.target.value})}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Category (optional)"
                value={newDoc.category}
                onChange={(e: any) => setNewDoc({...newDoc, category: e.target.value})}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setShowAddDoc(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button onClick={addDocTemplate} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Add</button>
            </div>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Add Task Template</h3>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Task title *"
                value={newTask.title}
                onChange={(e: any) => setNewTask({...newTask, title: e.target.value})}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
              <input
                type="text"
                placeholder="Default assignee role (optional)"
                value={newTask.default_assignee_role}
                onChange={(e: any) => setNewTask({...newTask, default_assignee_role: e.target.value})}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setShowAddTask(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button onClick={addTaskTemplate} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}