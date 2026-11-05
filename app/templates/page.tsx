'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'
import { useToast } from '../components/ToastProvider'
import { Button, Icon } from '../components/ui'

const STORAGE_BUCKET = 'mor-documents'
const parseUrls = (val: any): string[] => {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : [String(val)] } catch { return [String(val)] }
}
const serializeUrls = (urls: string[]): string | null => (urls.length ? JSON.stringify(urls) : null)
const fileName = (url: string): string => { try { return decodeURIComponent((url.split('/').pop() || 'file').split('?')[0]) } catch { return 'file' } }
const storagePath = (url: string): string | null => {
  const marker = `/object/public/${STORAGE_BUCKET}/`
  const i = url.indexOf(marker)
  if (i !== -1) return decodeURIComponent(url.slice(i + marker.length).split('?')[0])
  return url.startsWith('http') ? null : url
}
const openStoredFile = async (url: string): Promise<string | null> => {
  const win = typeof window !== 'undefined' ? window.open('', '_blank') : null
  const path = storagePath(url)
  if (!path) { win?.close(); return 'Could not determine the file location.' }
  const { data, error } = await supabase.storage.from(STORAGE_BUCKET).createSignedUrl(path, 300)
  if (error || !data?.signedUrl) { win?.close(); return error?.message || 'Could not open the file.' }
  if (win) win.location.href = data.signedUrl; else window.open(data.signedUrl, '_blank', 'noopener')
  return null
}

export default function TemplatesPage() {
  const router = useRouter()
  const { toast, confirm } = useToast()
  const [docTemplates, setDocTemplates] = useState<any[]>([])
  const [taskTemplates, setTaskTemplates] = useState<any[]>([])
  const [activeTab, setActiveTab] = useState('documents')
  const [loading, setLoading] = useState(true)
  const [newDoc, setNewDoc] = useState({ name: '', category: '' })
  const [showAddDoc, setShowAddDoc] = useState(false)
  const [addTask, setAddTask] = useState<any>(null) // { category, title, description, newCategory }

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
    const { data: docs } = await supabase.from('document_templates').select('*').order('sort_order')
    const { data: tasks } = await supabase.from('task_templates').select('*').order('sort_order')
    if (docs) setDocTemplates(docs)
    if (tasks) setTaskTemplates(tasks)
    setLoading(false)
  }

  // --- Document templates (unchanged behavior) -----------------------------
  const addDocTemplate = async (e: any) => {
    if (e) e.preventDefault()
    if (!newDoc.name) return
    const { data } = await supabase.from('document_templates').insert([{ name: newDoc.name, category: newDoc.category || null, is_default: true }]).select()
    if (data) { setDocTemplates([...docTemplates, ...data]); setNewDoc({ name: '', category: '' }); setShowAddDoc(false) }
  }
  const deleteDocTemplate = async (id: any) => {
    await supabase.from('document_templates').delete().eq('id', id)
    setDocTemplates(docTemplates.filter((d: any) => d.id !== id))
  }
  const moveDoc = async (index: any, direction: any) => {
    const arr = [...docTemplates]
    const swap = index + direction
    if (swap < 0 || swap >= arr.length) return
    const tmp = arr[index]; arr[index] = arr[swap]; arr[swap] = tmp
    const updated = arr.map((d, i) => ({ ...d, sort_order: i }))
    setDocTemplates(updated)
    await supabase.from('document_templates').update({ sort_order: updated[index].sort_order }).eq('id', updated[index].id)
    await supabase.from('document_templates').update({ sort_order: updated[swap].sort_order }).eq('id', updated[swap].id)
  }

  // --- Prep (task) templates ------------------------------------------------
  const updateTaskTemplate = async (id: any, patch: any) => {
    const { error } = await supabase.from('task_templates').update(patch).eq('id', id)
    if (error) { toast('Could not save — run the prep_tasks.sql migration. (' + error.message + ')', 'error'); return }
    setTaskTemplates(ts => ts.map((t: any) => (t.id === id ? { ...t, ...patch } : t)))
  }
  const deleteTaskTemplate = async (id: any) => {
    await supabase.from('task_templates').delete().eq('id', id)
    setTaskTemplates(taskTemplates.filter((t: any) => t.id !== id))
  }
  const removeTaskCategory = async (category: string) => {
    const ids = taskTemplates.filter((t: any) => (t.category || 'Other') === category).map((t: any) => t.id)
    if (!ids.length) return
    const ok = await confirm({ title: 'Remove category?', message: `Remove "${category}" and its ${ids.length} template item${ids.length === 1 ? '' : 's'}?`, confirmLabel: 'Remove', danger: true })
    if (!ok) return
    await supabase.from('task_templates').delete().in('id', ids)
    setTaskTemplates(taskTemplates.filter((t: any) => !ids.includes(t.id)))
  }
  const saveAddTask = async () => {
    const m = addTask
    const category = (m.newCategory ? m.category?.trim() : m.category) || 'Other'
    if (!m.title?.trim()) { toast('Enter an item name.', 'warning'); return }
    const maxOrder = taskTemplates.reduce((mx: number, t: any) => Math.max(mx, t.sort_order ?? 0), -1)
    const { data, error } = await supabase.from('task_templates').insert([{ category, title: m.title.trim(), description: m.description?.trim() || null, sort_order: maxOrder + 1 }]).select()
    if (error) { toast('Could not add — run the prep_tasks.sql migration. (' + error.message + ')', 'error'); return }
    if (data) setTaskTemplates([...taskTemplates, ...data])
    setAddTask(null)
  }
  const uploadTemplateDoc = async (tmpl: any, fileList: FileList | null) => {
    const files = Array.from(fileList || [])
    if (!files.length) return
    const existing = parseUrls(tmpl.document_url)
    const added: string[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const filePath = `templates/tasks/${tmpl.id}/${Date.now()}-${i}-${safeName}`
      const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(filePath, file, { upsert: true })
      if (error) { toast(`Error uploading ${file.name}: ${error.message}`, 'error'); continue }
      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath)
      added.push(urlData.publicUrl)
    }
    if (added.length) await updateTaskTemplate(tmpl.id, { document_url: serializeUrls([...existing, ...added]) })
  }
  const removeTemplateDoc = async (tmpl: any, url: string) => {
    await updateTaskTemplate(tmpl.id, { document_url: serializeUrls(parseUrls(tmpl.document_url).filter((u: string) => u !== url)) })
  }

  const sortedTasks = [...taskTemplates].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
  const taskCategories: string[] = []
  for (const t of sortedTasks) { const c = t.category || 'Other'; if (!taskCategories.includes(c)) taskCategories.push(c) }

  return (
    <div className="min-h-screen bg-slate-100">
      <nav className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3 flex flex-wrap justify-between items-center gap-x-4 gap-y-2 sticky top-0 z-30">
        <div className="flex items-center flex-wrap gap-x-4 gap-y-1">
          <button onClick={() => router.push('/dashboard')} className="text-sm text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"><Icon name="chevron" size={14} className="rotate-90" /> Back to dashboard</button>
          <h1 className="text-lg font-semibold text-slate-800">Templates</h1>
        </div>
        <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/' }} className="text-sm text-slate-400 hover:text-slate-700">Sign out</button>
      </nav>

      <div className="bg-white border-b border-slate-200 px-4 sm:px-6">
        <div className="flex gap-6">
          {['Documents', 'Prep'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab.toLowerCase())}
              className={`py-4 text-sm font-medium border-b-2 transition ${activeTab === tab.toLowerCase() ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
              {tab}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {activeTab === 'documents' && (
          <div className="space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Document Templates</h2>
                <p className="text-sm text-slate-500">These documents will be pre-loaded for every new MOR.</p>
              </div>
              <Button variant="primary" onClick={() => setShowAddDoc(true)}><Icon name="plus" /> Add document</Button>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              {loading ? <p className="p-6 text-slate-500 text-sm">Loading...</p> : (
                <div className="divide-y divide-slate-100">
                  {docTemplates.map((doc, index) => (
                    <div key={doc.id} className="p-4 flex items-center gap-3">
                      <div className="flex flex-col gap-1">
                        <button onClick={() => moveDoc(index, -1)} className="text-slate-400 hover:text-slate-600 text-xs leading-none">▲</button>
                        <button onClick={() => moveDoc(index, 1)} className="text-slate-400 hover:text-slate-600 text-xs leading-none">▼</button>
                      </div>
                      <div className="flex-1">
                        <p className="text-sm text-slate-800">{doc.name}</p>
                        {doc.category && <p className="text-xs text-slate-500">{doc.category}</p>}
                      </div>
                      <button onClick={() => deleteDocTemplate(doc.id)} className="text-slate-300 hover:text-red-500 text-xs">Delete</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'prep' && (
          <div className="space-y-5">
            <div className="flex flex-wrap justify-between items-center gap-2">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Prep Templates</h2>
                <p className="text-sm text-slate-500">These items, with their descriptions and documents, load onto every new MOR. Descriptions can still be edited per MOR.</p>
              </div>
              <Button variant="primary" onClick={() => setAddTask({ category: taskCategories[0] || '', title: '', description: '', newCategory: !taskCategories.length })}><Icon name="plus" /> Add prep item</Button>
            </div>

            {loading ? <p className="p-6 text-slate-500 text-sm">Loading...</p> : taskCategories.map((cat) => (
              <div key={cat} className="space-y-3 pt-5">
                <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                  <h3 className="text-lg font-semibold text-slate-800">{cat}</h3>
                  <button onClick={() => removeTaskCategory(cat)} className="text-xs text-slate-300 hover:text-red-500">Remove category</button>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
                  {sortedTasks.filter((t: any) => (t.category || 'Other') === cat).map((t: any) => (
                    <div key={t.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-slate-800">{t.title}</p>
                        <button onClick={() => deleteTaskTemplate(t.id)} className="shrink-0 text-slate-300 hover:text-red-500 text-xs" title="Delete">✕</button>
                      </div>
                      <textarea
                        defaultValue={t.description || ''}
                        onBlur={(e: any) => { if (e.target.value !== (t.description || '')) updateTaskTemplate(t.id, { description: e.target.value || null }) }}
                        rows={2} placeholder="Default description / instructions…"
                        className="w-full mt-2 border border-slate-200 rounded-lg px-2 py-1 text-xs"
                      />
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        {parseUrls(t.document_url).map((url: string, i: number) => (
                          <span key={i} className="flex items-center gap-1">
                            <button onClick={async () => { const err = await openStoredFile(url); if (err) toast(err, 'error') }} className="text-xs font-medium text-indigo-600 hover:text-indigo-800">📎 {fileName(url)}</button>
                            <button onClick={() => removeTemplateDoc(t, url)} className="text-xs text-slate-300 hover:text-red-500" title="Remove file">✕</button>
                          </span>
                        ))}
                        <label className="cursor-pointer text-xs font-medium text-indigo-600 hover:text-indigo-800">
                          📎 Attach document (copied to each MOR)
                          <input type="file" multiple className="hidden" onChange={async (e: any) => { await uploadTemplateDoc(t, e.target.files); e.target.value = '' }} />
                        </label>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showAddDoc && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Add Document Template</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Document name *" value={newDoc.name} onChange={(e: any) => setNewDoc({ ...newDoc, name: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none" />
              <input type="text" placeholder="Category (optional)" value={newDoc.category} onChange={(e: any) => setNewDoc({ ...newDoc, category: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none" />
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <Button variant="ghost" onClick={() => setShowAddDoc(false)}>Cancel</Button>
              <Button variant="primary" onClick={addDocTemplate}>Add</Button>
            </div>
          </div>
        </div>
      )}

      {addTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 shadow-xl w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Add Prep Template Item</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Category</label>
                {addTask.newCategory ? (
                  <div className="flex gap-2">
                    <input type="text" autoFocus placeholder="New category name" value={addTask.category} onChange={(e: any) => setAddTask({ ...addTask, category: e.target.value })} className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none" />
                    {taskCategories.length > 0 && <button onClick={() => setAddTask({ ...addTask, newCategory: false, category: taskCategories[0] })} className="text-xs text-slate-500 px-2">Pick existing</button>}
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <select value={addTask.category} onChange={(e: any) => setAddTask({ ...addTask, category: e.target.value })} className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none">
                      {taskCategories.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button onClick={() => setAddTask({ ...addTask, newCategory: true, category: '' })} className="text-xs text-indigo-600 px-2">+ New</button>
                  </div>
                )}
              </div>
              <input type="text" placeholder="Item name *" value={addTask.title} onChange={(e: any) => setAddTask({ ...addTask, title: e.target.value })} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none" />
              <textarea placeholder="Default description (optional)" value={addTask.description} onChange={(e: any) => setAddTask({ ...addTask, description: e.target.value })} rows={2} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 outline-none" />
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <Button variant="ghost" onClick={() => setAddTask(null)}>Cancel</Button>
              <Button variant="primary" onClick={saveAddTask}>Add</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
