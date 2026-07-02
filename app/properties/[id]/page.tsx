'use client'
import { useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'
import { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle } from 'docx'
import { useToast } from '../../components/ToastProvider'
import { parseDate, formatDate, formatDateObj } from '../../../lib/dateUtils'

// File-attachment URLs are stored in a single text column as either a legacy
// plain URL string or a JSON-encoded array of URLs. These helpers bridge both
// so we can support multiple files without a schema change.
const parseAttachmentUrls = (val: any): string[] => {
  if (!val) return []
  if (Array.isArray(val)) return val
  try {
    const parsed = JSON.parse(val)
    return Array.isArray(parsed) ? parsed : [String(val)]
  } catch {
    return [String(val)]
  }
}

const serializeAttachmentUrls = (urls: string[]): string | null =>
  urls.length ? JSON.stringify(urls) : null

const attachmentFileName = (url: string): string => {
  try {
    return decodeURIComponent((url.split('/').pop() || 'file').split('?')[0])
  } catch {
    return 'file'
  }
}

function DocumentsTab({ propertyId, morId }: any) {
  const { toast } = useToast()
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddCustom, setShowAddCustom] = useState(false)
  const [showPacket, setShowPacket] = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [customDoc, setCustomDoc] = useState<any>({ name: '', assigned_to: '', due_date: '', notes: '' })
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterAssignee, setFilterAssignee] = useState('all')

  useEffect(() => {
    if (morId) fetchDocuments()
  }, [morId])

   const fetchDocuments = async () => {
    setLoading(true)
    if (!morId) { setLoading(false); return }

    // Use server-side function to initialize documents (prevents duplicates)
    await supabase.rpc('initialize_mor_documents', {
      p_mor_id: morId,
      p_property_id: propertyId
    })

    // Now fetch the documents
    const { data } = await supabase
      .from('documents')
      .select('*')
      .eq('mor_id', morId)
      .order('sort_order')
    
    if (data) setDocuments(data)
    setLoading(false)
  }

  const loadFromTemplates = async (activeMorId: string) => {
    // Double-check no documents exist before inserting
    const { count } = await supabase
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('mor_id', activeMorId)
    
    if (count && count > 0) {
      // Documents already exist, just fetch them
      const { data } = await supabase
        .from('documents')
        .select('*')
        .eq('mor_id', activeMorId)
        .order('sort_order')
      if (data) setDocuments(data)
      return
    }

    const { data: tmpl } = await supabase
      .from('document_templates')
      .select('*')
      .order('sort_order')
    if (tmpl) {
      const docs = tmpl.map((t: any, i: number) => ({
        property_id: propertyId,
        mor_id: activeMorId,
        name: t.name,
        category: t.category,
        is_required: true,
        status: 'Not Started',
        is_custom: false,
        sort_order: i
      }))
      const { data: inserted } = await supabase.from('documents').insert(docs).select()
      if (inserted) setDocuments(inserted.sort((a: any, b: any) => a.sort_order - b.sort_order))
    }
  }

  const updateDoc = async (id: any, updates: any) => {
    const { error } = await supabase.from('documents').update(updates).eq('id', id)
    if (error) { toast('Error saving document: ' + error.message, 'error'); return }
    setDocuments(docs => docs.map((d: any) => d.id === id ? { ...d, ...updates } : d))
    if ('status' in updates) toast('Document status updated.', 'success')
  }

  // Upload one or more files for a checklist item, appending to any existing files.
  const uploadDocFiles = async (doc: any, fileList: FileList | null) => {
    const files = Array.from(fileList || [])
    if (!files.length) return
    const existing = parseAttachmentUrls(doc.file_url)
    const added: string[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const filePath = `${propertyId}/${doc.id}/${Date.now()}-${i}/${safeName}`
      const { error } = await supabase.storage.from('mor-documents').upload(filePath, file, { upsert: true })
      if (error) { toast(`Error uploading ${file.name}: ${error.message}`, 'error'); continue }
      const { data: urlData } = supabase.storage.from('mor-documents').getPublicUrl(filePath)
      added.push(urlData.publicUrl)
    }
    if (added.length) await updateDoc(doc.id, { file_url: serializeAttachmentUrls([...existing, ...added]) })
  }

  const removeDocFile = async (doc: any, url: string) => {
    const remaining = parseAttachmentUrls(doc.file_url).filter((u: string) => u !== url)
    await updateDoc(doc.id, { file_url: serializeAttachmentUrls(remaining) })
  }

  const moveDoc = async (index: any, direction: any) => {
    const newDocs = [...documents]
    const swapIndex = index + direction
    if (swapIndex < 0 || swapIndex >= newDocs.length) return
    const temp = newDocs[index]
    newDocs[index] = newDocs[swapIndex]
    newDocs[swapIndex] = temp
    const updated = newDocs.map((d: any, i: number) => ({ ...d, sort_order: i }))
    setDocuments(updated)
    const { error: e1 } = await supabase.from('documents').update({ sort_order: updated[index].sort_order }).eq('id', updated[index].id)
    const { error: e2 } = await supabase.from('documents').update({ sort_order: updated[swapIndex].sort_order }).eq('id', updated[swapIndex].id)
    if (e1 || e2) toast('Error reordering documents: ' + (e1 || e2)!.message, 'error')
  }

  const addCustomDoc = async (e: any) => {
    if (e) e.preventDefault()
    if (!customDoc.name) return
    const docData = {
      name: customDoc.name,
      assigned_to: customDoc.assigned_to || null,
      due_date: customDoc.due_date || null,
      notes: customDoc.notes || null,
      property_id: propertyId,
      mor_id: morId,
      status: 'Not Started',
      is_custom: true,
      sort_order: documents.length
    }
    const { data, error } = await supabase.from('documents').insert([docData]).select()
    if (error) { toast('Error adding document: ' + error.message, 'error'); return }
    if (data) {
      if (customDoc.addToTemplate) {
        await supabase.from('document_templates').insert([{ name: customDoc.name }])
      }
      setDocuments([...documents, ...data])
      setCustomDoc({ name: '', assigned_to: '', due_date: '', notes: '' })
      setShowAddCustom(false)
      toast('Document added.', 'success')
    }
  }

  const completed = documents.filter((d: any) => d.status === 'Submitted').length
  const total = documents.length
  const assignees = ['all', ...Array.from(new Set(documents.map((d: any) => d.assigned_to).filter(Boolean)))]
  
  const filteredDocs = documents.filter((d: any) => {
    const statusMatch = filterStatus === 'all' ? true : filterStatus === 'required' ? d.is_required : d.status === filterStatus
    const assigneeMatch = filterAssignee === 'all' ? true : d.assigned_to === filterAssignee
    return statusMatch && assigneeMatch
  })
  
  const indexedDocs = filteredDocs.map((doc: any, index: number) => ({ ...doc, globalIndex: index }))
  if (loading) return <div className="bg-white rounded-lg shadow p-6 text-gray-500">Loading documents...</div>

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Progress: {completed} of {total} submitted</span>
          <div className="flex gap-2">
            <button onClick={() => setShowPacket(true)} className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">
              📦 Submission Packet
            </button>
            <button onClick={() => setShowAddCustom(true)} className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">
              + Add Custom Document
            </button>
          </div>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all" style={{ width: total > 0 ? `${(completed / total) * 100}%` : '0%' }} />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-lg shadow p-3 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium w-16">Status:</span>
          {['all', 'Not Started', 'In Progress', 'Uploaded', 'Submitted', 'required'].map(status => (
            <button
              key={status}
              onClick={() => setFilterStatus(status)}
              className={`text-xs px-3 py-1 rounded-full border transition ${
                filterStatus === status
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'
              }`}
            >
              {status === 'all' ? 'All' : status === 'required' ? 'Required Only' : status}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium w-16">Assigned:</span>
          {assignees.map((assignee: any) => (
            <button
              key={assignee}
              onClick={() => setFilterAssignee(assignee)}
              className={`text-xs px-3 py-1 rounded-full border transition ${
                filterAssignee === assignee
                  ? 'bg-green-600 text-white border-green-600'
                  : 'bg-white text-gray-600 border-gray-300 hover:border-green-400'
              }`}
            >
              {assignee === 'all' ? 'All' : assignee}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="divide-y">
          {indexedDocs.map((doc: any) => (
            <div key={doc.id} className="p-4">
              <div className="flex items-start gap-2">
                <div className="flex flex-col gap-1 mt-1">
                  <button onClick={() => moveDoc(doc.globalIndex, -1)} className="text-gray-400 hover:text-gray-600 text-xs leading-none">▲</button>
                  <button onClick={() => moveDoc(doc.globalIndex, 1)} className="text-gray-400 hover:text-gray-600 text-xs leading-none">▼</button>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={doc.is_required} onChange={(e: any) => updateDoc(doc.id, { is_required: e.target.checked })} className="mt-1" />
                    <span className={`text-sm ${!doc.is_required ? 'text-gray-400 line-through' : 'text-gray-800'}`}>
                      {doc.name}
                      {doc.is_custom && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1 rounded">Custom</span>}
                    </span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 ml-6">
                    <input type="text" placeholder="Assigned to" value={doc.assigned_to || ''} onChange={(e: any) => updateDoc(doc.id, { assigned_to: e.target.value })} className="border border-gray-200 rounded px-2 py-1 text-xs" />
                    <input type="date" value={doc.due_date || ''} onChange={(e: any) => updateDoc(doc.id, { due_date: e.target.value })} className="border border-gray-200 rounded px-2 py-1 text-xs" />
                    <select value={doc.status || 'Not Started'} onChange={(e: any) => updateDoc(doc.id, { status: e.target.value })} className="border border-gray-200 rounded px-2 py-1 text-xs">
                      <option value="Not Started">Not Started</option>
                      <option value="In Progress">In Progress</option>
                      <option value="Uploaded">Uploaded</option>
                      <option value="Submitted">Submitted</option>
                    </select>
                  </div>
                  <input type="text" placeholder="Notes" value={doc.notes || ''} onChange={(e: any) => updateDoc(doc.id, { notes: e.target.value })} className="mt-1 ml-6 w-[calc(100%-1.5rem)] border border-gray-200 rounded px-2 py-1 text-xs" />
                  <div className="mt-2 ml-6 flex flex-wrap items-center gap-3">
                    {parseAttachmentUrls(doc.file_url).map((url: string, i: number) => (
                      <span key={i} className="flex items-center gap-1">
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">📎 {attachmentFileName(url)}</a>
                        <button onClick={() => removeDocFile(doc, url)} className="text-xs text-red-400 hover:text-red-600" title="Remove file">✕</button>
                      </span>
                    ))}
                    <label className="cursor-pointer text-xs text-blue-600 hover:underline">
                      📎 Upload File(s)
                      <input type="file" multiple className="hidden" onChange={async (e: any) => { await uploadDocFiles(doc, e.target.files); e.target.value = '' }} />
                    </label>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {showPacket && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-2">Submission Packet</h3>
            <p className="text-sm text-gray-500 mb-4">All uploaded documents for this property.</p>
            {documents.filter((d: any) => parseAttachmentUrls(d.file_url).length > 0).length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No files uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {documents.filter((d: any) => parseAttachmentUrls(d.file_url).length > 0).map((doc: any) => (
                  <div key={doc.id} className="flex items-start justify-between p-3 border border-gray-200 rounded">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{doc.name}</p>
                      <p className="text-xs text-gray-500">{doc.status}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 ml-3">
                      {parseAttachmentUrls(doc.file_url).map((url: string, i: number) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">📎 {attachmentFileName(url)}</a>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 p-3 bg-gray-50 rounded text-xs text-gray-500">
              💡 To share this packet, right-click each file link and select "Save link as" to download.
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={() => setShowPacket(false)} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Close</button>
            </div>
          </div>
        </div>
      )}

      {showAddCustom && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Add Custom Document</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Document name *" value={customDoc.name} onChange={(e: any) => setCustomDoc({...customDoc, name: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              <input type="text" placeholder="Assigned to" value={customDoc.assigned_to} onChange={(e: any) => setCustomDoc({...customDoc, assigned_to: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              <input type="date" value={customDoc.due_date || ''} onChange={(e: any) => setCustomDoc({...customDoc, due_date: e.target.value || null})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              <input type="text" placeholder="Notes" value={customDoc.notes} onChange={(e: any) => setCustomDoc({...customDoc, notes: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={customDoc.addToTemplate || false} onChange={(e: any) => setCustomDoc({...customDoc, addToTemplate: e.target.checked})} />
                Add to template (include on all future properties)
              </label>
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
function TasksTab({ propertyId, morId }: any) {
  const { toast } = useToast()
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTask, setNewTask] = useState<any>({ title: '', assigned_to: '', due_date: '' })

  useEffect(() => {
    fetchTasks()
  }, [propertyId, morId])

  // Order by sort_order (falling back to created_at). Resilient to the
  // sort_order column not existing yet (treated as 0).
  const sortTasks = (arr: any[]) =>
    [...arr].sort((a, b) =>
      ((a.sort_order ?? 0) - (b.sort_order ?? 0)) ||
      (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()))

  const fetchTasks = async () => {
    setLoading(true)
    if (!morId) { setLoading(false); return }
    const { data } = await supabase.from('tasks').select('*').eq('property_id', propertyId).eq('mor_id', morId).order('created_at')
    if (data && data.length > 0) {
      setTasks(sortTasks(data))
    } else {
      await loadFromTemplates()
    }
    setLoading(false)
  }

  const loadFromTemplates = async () => {
    const { data: tmpl } = await supabase.from('task_templates').select('*').order('created_at')
    if (tmpl && tmpl.length > 0) {
      const ordered = sortTasks(tmpl)
      const tasks = ordered.map((t: any, i: number) => ({
        property_id: propertyId,
        mor_id: morId,
        title: t.title,
        assigned_to: '',
        due_date: null,
        completed: false,
        is_custom: false,
        sort_order: t.sort_order ?? i
      }))
      const { data: inserted } = await supabase.from('tasks').insert(tasks).select()
      if (inserted) setTasks(sortTasks(inserted))
    }
  }

  const updateTask = async (id: any, updates: any) => {
    const { error } = await supabase.from('tasks').update(updates).eq('id', id)
    if (error) { toast('Error saving task: ' + error.message, 'error'); return }
    setTasks(tasks => tasks.map((t: any) => t.id === id ? { ...t, ...updates } : t))
    if (updates.completed === true) toast('Task completed.', 'success')
  }

  // Upload one or more documents for a checklist task, appending to existing ones.
  const uploadTaskFiles = async (task: any, fileList: FileList | null) => {
    const files = Array.from(fileList || [])
    if (!files.length) return
    const existing = parseAttachmentUrls(task.document_url)
    const added: string[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const filePath = `${propertyId}/tasks/${task.id}/${Date.now()}-${i}/${safeName}`
      const { error } = await supabase.storage.from('mor-documents').upload(filePath, file, { upsert: true })
      if (error) { toast(`Error uploading ${file.name}: ${error.message}`, 'error'); continue }
      const { data: urlData } = supabase.storage.from('mor-documents').getPublicUrl(filePath)
      added.push(urlData.publicUrl)
    }
    if (added.length) await updateTask(task.id, { document_url: serializeAttachmentUrls([...existing, ...added]) })
  }

  const removeTaskFile = async (task: any, url: string) => {
    const remaining = parseAttachmentUrls(task.document_url).filter((u: string) => u !== url)
    await updateTask(task.id, { document_url: serializeAttachmentUrls(remaining) })
  }

  const addTask = async (e: any) => {
    if (e) e.preventDefault()
    if (!newTask.title) return
    const taskData = {
      title: newTask.title,
      assigned_to: newTask.assigned_to || null,
      due_date: newTask.due_date || null,
      property_id: propertyId,
      mor_id: morId,
      completed: false,
      is_custom: true,
      sort_order: tasks.length
    }
    const { data, error } = await supabase.from('tasks').insert([taskData]).select()
    if (error) { toast('Error adding task: ' + error.message, 'error'); return }
    if (data) {
      if (newTask.addToTemplate) {
        await supabase.from('task_templates').insert([{ title: newTask.title }])
      }
      setTasks(sortTasks([...tasks, ...data]))
      setNewTask({ title: '', assigned_to: '', due_date: '' })
      setShowAddTask(false)
      toast('Task added.', 'success')
    }
  }

  const completed = tasks.filter((t: any) => t.completed).length
  const total = tasks.length

  if (loading) return <div className="bg-white rounded-lg shadow p-6 text-gray-500">Loading tasks...</div>

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Progress: {completed} of {total} completed</span>
          <button onClick={() => setShowAddTask(true)} className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">+ Add Task</button>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: total > 0 ? `${(completed / total) * 100}%` : '0%' }} />
        </div>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {tasks.length === 0 ? (
          <div className="p-6 text-center text-gray-500 text-sm">No tasks yet. Click "+ Add Task" to get started.</div>
        ) : (
          <div className="divide-y">
            {tasks.map((task: any) => (
              <div key={task.id} className={`p-4 ${task.completed ? 'bg-gray-50' : ''}`}>
                <div className="flex items-start gap-3">
                  <input type="checkbox" checked={task.completed} onChange={(e: any) => updateTask(task.id, { completed: e.target.checked })} className="mt-1" />
                  <div className="flex-1">
                    <span className={`text-sm ${task.completed ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                      {task.title}
                      {task.is_custom && <span className="ml-2 text-xs bg-purple-100 text-purple-700 px-1 rounded">Custom</span>}
                    </span>
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <input type="text" placeholder="Assigned to" value={task.assigned_to || ''} onChange={(e: any) => updateTask(task.id, { assigned_to: e.target.value })} className="border border-gray-200 rounded px-2 py-1 text-xs" />
                      <input type="date" value={task.due_date || ''} onChange={(e: any) => updateTask(task.id, { due_date: e.target.value })} className="border border-gray-200 rounded px-2 py-1 text-xs" />
                    </div>
                    <div className="mt-2">
                      <label className="text-xs text-gray-500">Notes</label>
                      <textarea
                        key={task.id}
                        defaultValue={task.notes || ''}
                        onBlur={(e: any) => { if (e.target.value !== (task.notes || '')) updateTask(task.id, { notes: e.target.value || null }) }}
                        rows={2}
                        placeholder="Notes..."
                        className="w-full mt-1 border border-gray-200 rounded px-2 py-1 text-xs"
                      />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      {parseAttachmentUrls(task.document_url).map((url: string, i: number) => (
                        <span key={i} className="flex items-center gap-1">
                          <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">📎 {attachmentFileName(url)}</a>
                          <button onClick={() => removeTaskFile(task, url)} className="text-xs text-red-400 hover:text-red-600" title="Remove file">✕</button>
                        </span>
                      ))}
                      <label className="cursor-pointer text-xs text-blue-600 hover:underline">
                        📎 Upload Document(s)
                        <input type="file" multiple className="hidden" onChange={async (e: any) => { await uploadTaskFiles(task, e.target.files); e.target.value = '' }} />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showAddTask && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-bold mb-4">Add Task</h3>
            <div className="space-y-3">
              <input type="text" placeholder="Task title *" value={newTask.title} onChange={(e: any) => setNewTask({...newTask, title: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              <input type="text" placeholder="Assigned to" value={newTask.assigned_to} onChange={(e: any) => setNewTask({...newTask, assigned_to: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              <input type="date" value={newTask.due_date || ''} onChange={(e: any) => setNewTask({...newTask, due_date: e.target.value || null})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input type="checkbox" checked={newTask.addToTemplate || false} onChange={(e: any) => setNewTask({...newTask, addToTemplate: e.target.checked})} />
                Add to template (include on all future properties)
              </label>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setShowAddTask(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button onClick={addTask} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Add Task</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MeetingsTab({ propertyId, morId }: any) {
  const { toast } = useToast()
  const [meetings, setMeetings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddMeeting, setShowAddMeeting] = useState(false)
  const [newMeeting, setNewMeeting] = useState<any>({ meeting_date: '', attendees: '', notes: '', action_items: '' })

  useEffect(() => {
    fetchMeetings()
  }, [propertyId, morId])

 const fetchMeetings = async () => {
    setLoading(true)
    if (!morId) { setLoading(false); return }
    const { data } = await supabase.from('meetings').select('*').eq('property_id', propertyId).eq('mor_id', morId).order('meeting_date', { ascending: false })
    if (data) setMeetings(data)
    setLoading(false)
  }

  const addMeeting = async (e: any) => {
    if (e) e.preventDefault()
    if (!newMeeting.notes) return
    const { data, error } = await supabase.from('meetings').insert([{
      property_id: propertyId,
      mor_id: morId,
      meeting_date: newMeeting.meeting_date || null,
      attendees: newMeeting.attendees || null,
      notes: newMeeting.notes,
      action_items: newMeeting.action_items || null
    }]).select()
    if (error) { toast('Error saving meeting: ' + error.message, 'error'); return }
    if (data) {
      setMeetings([...data, ...meetings])
      setNewMeeting({ meeting_date: '', attendees: '', notes: '', action_items: '' })
      setShowAddMeeting(false)
      toast('Meeting saved.', 'success')
    }
  }

  const deleteMeeting = async (id: any) => {
    const { error } = await supabase.from('meetings').delete().eq('id', id)
    if (error) { toast('Error deleting meeting: ' + error.message, 'error'); return }
    setMeetings(meetings.filter((m: any) => m.id !== id))
    toast('Meeting deleted.', 'success')
  }

  if (loading) return <div className="bg-white rounded-lg shadow p-6 text-gray-500">Loading meetings...</div>

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-800">Meeting Notes</h2>
        <button onClick={() => setShowAddMeeting(true)} className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">+ Log Meeting</button>
      </div>

      {meetings.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500 text-sm">No meetings logged yet. Click "+ Log Meeting" to add one.</div>
      ) : (
        <div className="space-y-3">
          {meetings.map((meeting: any) => (
            <div key={meeting.id} className="bg-white rounded-lg shadow p-5">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-sm font-medium text-gray-800">
                    {meeting.meeting_date ? formatDate(meeting.meeting_date) : 'No date'}
                  </p>
                  {meeting.attendees && <p className="text-xs text-gray-500 mt-1">Attendees: {meeting.attendees}</p>}
                </div>
                <button onClick={() => deleteMeeting(meeting.id)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
              </div>
              <div className="mt-3">
                <p className="text-xs text-gray-500 font-medium mb-1">Notes:</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{meeting.notes}</p>
              </div>
              {meeting.action_items && (
                <div className="mt-3">
                  <p className="text-xs text-gray-500 font-medium mb-1">Action Items:</p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{meeting.action_items}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showAddMeeting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold mb-4">Log Meeting</h3>
            <div className="space-y-3">
              <input type="date" value={newMeeting.meeting_date} onChange={(e: any) => setNewMeeting({...newMeeting, meeting_date: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              <input type="text" placeholder="Attendees" value={newMeeting.attendees} onChange={(e: any) => setNewMeeting({...newMeeting, attendees: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              <textarea placeholder="Meeting notes *" value={newMeeting.notes} onChange={(e: any) => setNewMeeting({...newMeeting, notes: e.target.value})} rows={4} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              <textarea placeholder="Action items" value={newMeeting.action_items} onChange={(e: any) => setNewMeeting({...newMeeting, action_items: e.target.value})} rows={3} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setShowAddMeeting(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button onClick={addMeeting} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Save Meeting</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
// Textarea with local state that only saves to the database onBlur.
// Keeps the cursor from jumping to the end while typing.
function FindingTextarea({ value, onSave, ...props }: any) {
  const [local, setLocal] = useState(value || '')
  useEffect(() => { setLocal(value || '') }, [value])
  return (
    <textarea
      {...props}
      value={local}
      onChange={(e: any) => setLocal(e.target.value)}
      onBlur={() => { if (local !== (value || '')) onSave(local) }}
    />
  )
}

// Like FindingTextarea but saves on every keystroke (debounced) instead of on
// blur, so the parent's findings state stays current as the user types.
function DebouncedFindingTextarea({ value, onSave, onType, delay = 1000, ...props }: any) {
  const [local, setLocal] = useState(value || '')
  const timerRef = useRef<any>(null)
  useEffect(() => { setLocal(value || '') }, [value])
  // Cancel any pending save when the component unmounts.
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])
  return (
    <textarea
      {...props}
      value={local}
      onChange={(e: any) => {
        const v = e.target.value
        setLocal(v)
        if (onType) onType(v)
        if (timerRef.current) clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => onSave(v), delay)
      }}
    />
  )
}

function FindingsTab({ propertyId, morId, currentMor, property, onCompleteMor, onUpdateMor }: any) {
  const { toast, confirm } = useToast()
  const [findings, setFindings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedFindingIds, setSelectedFindingIds] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState('')
  const [showAddFinding, setShowAddFinding] = useState(false)
  const [newFinding, setNewFinding] = useState<any>({ finding: '', assigned_to: '', response: '', due_date: '' })
  const [introText, setIntroText] = useState('Below is our response to the Management and Occupancy Review above:')
  const [signatoryName, setSignatoryName] = useState('')
  const [showReportSettings, setShowReportSettings] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extractProgress, setExtractProgress] = useState('')
  const [extractedFindings, setExtractedFindings] = useState<any[]>([])
  const [showExtracted, setShowExtracted] = useState(false)
  const [morRating, setMorRating] = useState(currentMor?.rating || '')
  const [responseDueDate, setResponseDueDate] = useState(currentMor?.response_due_date || '')
  const [responseSubmittedDate, setResponseSubmittedDate] = useState(currentMor?.response_submitted_date || '')
  const [followUp, setFollowUp] = useState(!!currentMor?.follow_up)
  const [followUpDueDate, setFollowUpDueDate] = useState(currentMor?.follow_up_response_due_date || '')
  const [followUpSubmittedDate, setFollowUpSubmittedDate] = useState(currentMor?.follow_up_response_submitted_date || '')
  const [completing, setCompleting] = useState(false)
  // Tracks the latest typed response per finding id, including values not yet
  // persisted by the debounced save, so reports can use the most current text.
  const pendingResponses = useRef<{ [key: string]: string }>({})

  useEffect(() => {
    fetchFindings()
  }, [propertyId, morId])

  useEffect(() => {
    setResponseDueDate(currentMor?.response_due_date || '')
    setResponseSubmittedDate(currentMor?.response_submitted_date || '')
    setMorRating(currentMor?.rating || '')
    setFollowUp(!!currentMor?.follow_up)
    setFollowUpDueDate(currentMor?.follow_up_response_due_date || '')
    setFollowUpSubmittedDate(currentMor?.follow_up_response_submitted_date || '')
  }, [currentMor])

  const fetchFindings = async () => {
    setLoading(true)
    if (!morId) { setLoading(false); return }
    const { data } = await supabase.from('findings').select('*').eq('property_id', propertyId).eq('mor_id', morId).order('created_at')
    if (data) {
      // Initialize sort_order based on created_at order the first time (all defaults are 0)
      const needsInit = data.length > 0 && data.every((f: any) => !f.sort_order)
      if (needsInit) {
        const ordered = data.map((f: any, i: number) => ({ ...f, sort_order: i }))
        await Promise.all(ordered.map((f: any) => supabase.from('findings').update({ sort_order: f.sort_order }).eq('id', f.id)))
        setFindings(ordered)
      } else {
        setFindings([...data].sort((a: any, b: any) => a.sort_order - b.sort_order))
      }
    }
    setLoading(false)
  }

  const addFinding = async (e: any) => {
    if (e) e.preventDefault()
    if (!newFinding.finding) return
    const { data, error } = await supabase.from('findings').insert([{
      property_id: propertyId,
      mor_id: morId,
      finding: newFinding.finding,
      assigned_to: newFinding.assigned_to || null,
      response: newFinding.response || null,
      due_date: newFinding.due_date || null,
      status: 'Open',
      sort_order: findings.length
    }]).select()
    if (error) { toast('Error saving finding: ' + error.message, 'error'); return }
    if (data) {
      setFindings([...findings, ...data])
      setNewFinding({ finding: '', assigned_to: '', response: '', due_date: '' })
      setShowAddFinding(false)
      toast('Finding saved.', 'success')
    }
  }

  const updateFinding = async (id: any, updates: any) => {
    const { error } = await supabase.from('findings').update(updates).eq('id', id)
    if (error) { toast('Error saving finding: ' + error.message, 'error'); return error }
    setFindings(findings => findings.map((f: any) => f.id === id ? { ...f, ...updates } : f))
    return null
  }

  // Upload one or more supporting documents for a finding, keeping existing ones.
  const uploadFindingFiles = async (finding: any, fileList: FileList | null) => {
    const files = Array.from(fileList || [])
    if (!files.length) return
    const existing = parseAttachmentUrls(finding.document_url)
    const added: string[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const filePath = `${propertyId}/findings/${finding.id}/${Date.now()}-${i}/${safeName}`
      const { error: uploadError } = await supabase.storage.from('mor-documents').upload(filePath, file, { upsert: true })
      if (uploadError) {
        console.error('[finding upload] storage upload failed:', uploadError)
        toast(`Error uploading ${file.name}: ${uploadError.message}`, 'error')
        continue
      }
      const { data: urlData } = supabase.storage.from('mor-documents').getPublicUrl(filePath)
      added.push(urlData.publicUrl)
    }
    if (added.length) {
      const updateError = await updateFinding(finding.id, { document_url: serializeAttachmentUrls([...existing, ...added]) })
      if (!updateError) toast(`Uploaded ${added.length} document${added.length === 1 ? '' : 's'}.`, 'success')
    }
  }

  const removeFindingFile = async (finding: any, url: string) => {
    const remaining = parseAttachmentUrls(finding.document_url).filter((u: string) => u !== url)
    await updateFinding(finding.id, { document_url: serializeAttachmentUrls(remaining) })
  }

  const moveFinding = async (index: any, direction: any) => {
    const newFindings = [...findings]
    const swapIndex = index + direction
    if (swapIndex < 0 || swapIndex >= newFindings.length) return
    const temp = newFindings[index]
    newFindings[index] = newFindings[swapIndex]
    newFindings[swapIndex] = temp
    const updated = newFindings.map((f: any, i: number) => ({ ...f, sort_order: i }))
    setFindings(updated)
    const { error: e1 } = await supabase.from('findings').update({ sort_order: updated[index].sort_order }).eq('id', updated[index].id)
    const { error: e2 } = await supabase.from('findings').update({ sort_order: updated[swapIndex].sort_order }).eq('id', updated[swapIndex].id)
    if (e1 || e2) toast('Error reordering findings: ' + (e1 || e2)!.message, 'error')
  }

  const moveFindingTo = async (index: any, position: 'top' | 'bottom') => {
    if (index < 0 || index >= findings.length) return
    if ((position === 'top' && index === 0) || (position === 'bottom' && index === findings.length - 1)) return
    const newFindings = [...findings]
    const [moved] = newFindings.splice(index, 1)
    if (position === 'top') newFindings.unshift(moved)
    else newFindings.push(moved)
    const updated = newFindings.map((f: any, i: number) => ({ ...f, sort_order: i }))
    setFindings(updated)
    // Persist only the rows whose sort_order actually changed.
    const changed = updated.filter((f: any) => {
      const prev = findings.find((p: any) => p.id === f.id)
      return !prev || prev.sort_order !== f.sort_order
    })
    const results = await Promise.all(
      changed.map((f: any) => supabase.from('findings').update({ sort_order: f.sort_order }).eq('id', f.id))
    )
    const err = results.map((r: any) => r.error).find(Boolean)
    if (err) toast('Error reordering findings: ' + err.message, 'error')
  }

  const deleteFinding = async (id: any) => {
    const { error } = await supabase.from('findings').delete().eq('id', id)
    if (error) { toast('Error deleting finding: ' + error.message, 'error'); return }
    setFindings(findings.filter((f: any) => f.id !== id))
    toast('Finding deleted.', 'success')
  }

  const deadline = parseDate(responseDueDate)
  const daysLeft = deadline ? Math.ceil((deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null
  const open = findings.filter((f: any) => f.status !== 'Submitted' && f.status !== 'Closed').length
  const total = findings.length
  const findingStatuses = ['Open', 'In Progress', 'Ready', 'Follow Up', 'Submitted', 'Closed']
  const statusClasses = (status: string) =>
    status === 'Submitted' ? 'bg-green-100 text-green-700 border-green-200' :
    status === 'Closed' ? 'bg-gray-200 text-gray-700 border-gray-300' :
    status === 'Ready' ? 'bg-blue-100 text-blue-700 border-blue-200' :
    status === 'Follow Up' ? 'bg-orange-100 text-orange-700 border-orange-200' :
    status === 'In Progress' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' :
    'bg-red-100 text-red-700 border-red-200'
  const visibleFindings = statusFilter === 'all' ? findings : findings.filter((f: any) => f.status === statusFilter)

  const toggleSelectFinding = (id: string) =>
    setSelectedFindingIds(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id])

  const bulkUpdateStatus = async (status: string) => {
    if (!status || selectedFindingIds.length === 0) return
    const { error } = await supabase.from('findings').update({ status }).in('id', selectedFindingIds)
    if (error) { toast('Error updating findings: ' + error.message, 'error'); return }
    setFindings(findings => findings.map((f: any) => selectedFindingIds.includes(f.id) ? { ...f, status } : f))
    toast(`Updated ${selectedFindingIds.length} finding${selectedFindingIds.length === 1 ? '' : 's'} to "${status}".`, 'success')
    setSelectedFindingIds([])
    setBulkStatus('')
  }

  const completeMor = async () => {
    if (!morRating) { toast('Please select an MOR rating before completing.', 'warning'); return }
    if (!morId) { toast('No MOR is selected to complete.', 'error'); return }
    const ok = await confirm({
      title: 'Complete MOR?',
      message: 'Mark this MOR as Completed? This will update the Last MOR Date and Rating on the property.',
      confirmLabel: 'Complete MOR',
    })
    if (!ok) return
    setCompleting(true)

    const { data: propUpdated, error: propErr } = await supabase.from('properties').update({
      last_mor_date: currentMor?.mor_date || null,
      last_mor_rating: morRating
    }).eq('id', property.id).select()
    if (propErr) { setCompleting(false); toast('Error updating property: ' + propErr.message, 'error'); return }
    if (!propUpdated || propUpdated.length === 0) {
      setCompleting(false)
      toast('Could not update the property (0 rows — likely a permissions/RLS issue).', 'error')
      return
    }

    // Keep the MOR's scheduled date so completed MORs still show their date in
    // the selector; the 'Completed' status excludes it from active-status logic.
    const { data: updated, error: morErr } = await supabase
      .from('mors')
      .update({ status: 'Completed' })
      .eq('id', morId)
      .select()
    setCompleting(false)
    if (morErr) { toast('Error completing MOR: ' + morErr.message, 'error'); return }
    if (!updated || updated.length === 0) {
      toast('Could not complete the MOR — the update affected no rows (likely a permissions/RLS issue).', 'error')
      return
    }

    toast('MOR marked as Completed.', 'success')
    if (onCompleteMor) onCompleteMor()
  }


  const extractFindingsFromPDF = async (e: any) => {
    const file = e.target.files[0]
    if (!file) return
    setExtracting(true)
    setExtractProgress('Reading the report…')

    try {
      // Convert PDF to base64
      const base64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          resolve(result.split(',')[1])
        }
        reader.readAsDataURL(file)
      })

      const { data: { session } } = await supabase.auth.getSession()
      const authHeader = `Bearer ${session?.access_token || ''}`
      const callApi = async (body: any) => {
        const r = await fetch('/api/extract-findings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: authHeader },
          body: JSON.stringify(body)
        })
        const d = await r.json()
        if (d.error) throw new Error(d.error)
        return d
      }

      // Pass 1 — index every finding that requires a response (small, fast).
      setExtractProgress('Finding the items that need a response…')
      const { index } = await callApi({ base64PDF: base64, mode: 'index' })
      if (!index || index.length === 0) {
        toast('No findings requiring a response were found in this report.', 'warning')
        setExtracting(false); setExtractProgress(''); return
      }

      // Pass 2 — pull the full verbatim text in small batches, in parallel.
      // Each call's output is bounded so it stays well under the time limit.
      const BATCH = 5
      const batches: any[][] = []
      for (let i = 0; i < index.length; i += BATCH) batches.push(index.slice(i, i + BATCH))
      setExtractProgress(`Extracting ${index.length} ${index.length === 1 ? 'finding' : 'findings'}…`)
      const results = await Promise.all(
        batches.map((b) => callApi({ base64PDF: base64, mode: 'extract', targets: b }))
      )

      // Zip extracted text back onto the index entries (keeps order + due dates).
      const all: any[] = []
      results.forEach((res: any, bi: number) => {
        const got = res.findings || []
        batches[bi].forEach((t: any, j: number) => {
          all.push({ item: t.item, finding: got[j]?.finding || '', due_date: t.due_date || null })
        })
      })

      setExtractedFindings(all)
      setShowExtracted(true)
    } catch (err: any) {
      toast(err?.message ? `Error extracting findings: ${err.message}` : 'Error extracting findings. Please try again.', 'error')
      console.error(err)
    }
    setExtractProgress('')
    setExtracting(false)
  }
        

  const importFindings = async () => {
    let order = findings.length
    let imported = 0
    for (const f of extractedFindings) {
      const findingText = [f.item, f.finding].filter(Boolean).join('\n\n')
      const { error } = await supabase.from('findings').insert([{
        property_id: propertyId,
        mor_id: morId,
        finding: findingText,
        due_date: f.due_date || null,
        status: 'Open',
        sort_order: order++
      }])
      if (error) { toast('Error importing a finding: ' + error.message, 'error'); break }
      imported++
    }
    setShowExtracted(false)
    setExtractedFindings([])
    fetchFindings()
    if (imported > 0) toast(`Imported ${imported} finding${imported === 1 ? '' : 's'}.`, 'success')
  }

  const readyCount = () => findings.filter((f: any) => f.status === 'Ready').length

  const generatePDF = async () => {
    if (readyCount() === 0) { toast('No findings are marked "Ready" to include in the report.', 'warning'); return }
    // Merge in any responses still pending the debounced save.
    // Only findings marked "Ready" are included in the submitted response report.
    const findingsWithPending = findings
      .filter((f: any) => f.status === 'Ready')
      .map((f: any) => ({
        ...f,
        response: pendingResponses.current[f.id] ?? f.response,
      }))

    const esc = (s: any) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')

    // Render finding text as HTML, bolding the first line (item code + title)
    // and any "Condition:" / "Corrective Action:" style labels.
    const renderFindingBody = (text: string) => {
      const labelRegex = /^(Condition|Corrective Action|Criteria|Cause|Effect):\s*([\s\S]*)$/
      let firstContentDone = false
      const parts: string[] = []
      for (const line of (text || '').split('\n')) {
        if (line.trim() === '') continue
        const m = line.match(labelRegex)
        if (m) {
          parts.push(`<p style="margin:0 0 6px 0;"><strong>${esc(m[1])}:</strong> ${esc(m[2])}</p>`)
          firstContentDone = true
        } else if (!firstContentDone) {
          parts.push(`<p style="margin:0 0 6px 0;"><strong>${esc(line)}</strong></p>`)
          firstContentDone = true
        } else {
          parts.push(`<p style="margin:0 0 6px 0;">${esc(line)}</p>`)
        }
      }
      return parts.join('')
    }

    const headerMeta: string[] = []
    headerMeta.push(`<p style="margin:0 0 4px 0;">Date Generated: ${esc(new Date().toLocaleDateString())}</p>`)
    if (property.section8_number) {
      headerMeta.push(`<p style="margin:0 0 4px 0;">Section 8 Project Number: ${esc(property.section8_number)}</p>`)
    }
    if (property.mor_date) {
      headerMeta.push(`<p style="margin:0 0 4px 0;">Date of MOR: ${esc(formatDate(property.mor_date))}</p>`)
    }

    const findingsHtml = findingsWithPending.map((finding: any, index: number) => {
      const assigned = finding.assigned_to
        ? `<p style="margin:0 0 6px 0; font-style:italic;">Assigned to: ${esc(finding.assigned_to)}</p>`
        : ''
      const responseLines = finding.response
        ? String(finding.response).split('\n').filter((l: string) => l.trim() !== '')
          .map((l: string) => `<p style="margin:0 0 6px 0;">${esc(l)}</p>`).join('')
        : ''
      const response = finding.response
        ? `<p style="margin:8px 0 4px 0;"><strong>Response:</strong></p>${responseLines}`
        : ''
      const attachment = parseAttachmentUrls(finding.document_url)
        .map((u: string) => `<p style="margin:6px 0 0 0; font-style:italic;">See attached: ${esc(attachmentFileName(u))}</p>`)
        .join('')
      return `
        <div style="page-break-inside: avoid; margin:0 0 16px 0; padding:0 0 10px 0; border-bottom:1px solid #ddd;">
          <p style="margin:0 0 6px 0; font-weight:bold; font-size:13px;">Finding ${index + 1}:</p>
          ${renderFindingBody(finding.finding || '')}
          ${assigned}
          ${response}
          ${attachment}
        </div>`
    }).join('')

    const signatureHtml = signatoryName
      ? `
        <div style="page-break-inside: avoid; margin-top:40px;">
          <p style="margin:0 0 24px 0;">${esc(signatoryName)}</p>
          <p style="margin:0; width:200px; border-top:1px solid #000; padding-top:4px;">Signature</p>
          <p style="margin:8px 0 0 0;">Date: ${esc(new Date().toLocaleDateString())}</p>
        </div>`
      : ''

    const html = `
      <div style="font-family: Helvetica, Arial, sans-serif; font-size:11px; line-height:1.5; color:#000;">
        <h1 style="text-align:center; font-size:18px; font-weight:bold; margin:0 0 12px 0;">${esc(property.name || 'Property Name')}</h1>
        ${headerMeta.join('')}
        <hr style="border:none; border-top:1px solid #999; margin:12px 0;" />
        <p style="margin:0 0 12px 0;">${esc(introText)}</p>
        <hr style="border:none; border-top:1px solid #999; margin:12px 0;" />
        ${findingsHtml}
        ${signatureHtml}
      </div>`

    // Render off-screen so html2canvas can measure the layout, then clean up.
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.left = '-10000px'
    container.style.top = '0'
    container.style.width = '180mm'
    container.innerHTML = html
    document.body.appendChild(container)

    try {
      const html2pdf = (await import('html2pdf.js')).default
      await html2pdf().set({
        margin: [15, 15, 15, 15],
        filename: 'MOR-Response-Report.pdf',
        html2canvas: { scale: 2 },
        jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' },
      }).from(container).save()
    } finally {
      document.body.removeChild(container)
    }
  }

  // Build the Word report (shared by the standalone download and the ZIP package).
  const buildReportDocx = () => {
    // Merge in any responses still pending the debounced save (same as the PDF).
    // Only findings marked "Ready" are included in the submitted response report.
    const findingsWithPending = findings
      .filter((f: any) => f.status === 'Ready')
      .map((f: any) => ({
        ...f,
        response: pendingResponses.current[f.id] ?? f.response,
      }))

    // A full-width bottom border makes a horizontal rule.
    const hr = (color: string, size: number) =>
      new Paragraph({
        spacing: { before: 120, after: 120 },
        border: { bottom: { style: BorderStyle.SINGLE, size, color, space: 1 } },
        children: [],
      })

    // Render the finding text, bolding the first line (item code + title) and
    // any "Condition:" / "Corrective Action:" style labels.
    const renderFindingBody = (text: string): Paragraph[] => {
      const labelRegex = /^(Condition|Corrective Action|Criteria|Cause|Effect):\s*([\s\S]*)$/
      const paragraphs: Paragraph[] = []
      let firstContentDone = false
      for (const line of (text || '').split('\n')) {
        if (line.trim() === '') continue
        const m = line.match(labelRegex)
        if (m) {
          paragraphs.push(new Paragraph({ children: [
            new TextRun({ text: `${m[1]}: `, bold: true }),
            new TextRun(m[2]),
          ] }))
          firstContentDone = true
        } else if (!firstContentDone) {
          // First content line = item code + title.
          paragraphs.push(new Paragraph({ children: [new TextRun({ text: line, bold: true })] }))
          firstContentDone = true
        } else {
          paragraphs.push(new Paragraph({ children: [new TextRun(line)] }))
        }
      }
      return paragraphs
    }

    const children: Paragraph[] = []

    // Header
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: property.name || 'Property Name', bold: true, size: 36 })],
    }))
    children.push(new Paragraph({ children: [new TextRun(`Date Generated: ${new Date().toLocaleDateString()}`)] }))
    if (property.section8_number) {
      children.push(new Paragraph({ children: [new TextRun(`Section 8 Project Number: ${property.section8_number}`)] }))
    }
    if (property.mor_date) {
      children.push(new Paragraph({ children: [new TextRun(`Date of MOR: ${formatDate(property.mor_date)}`)] }))
    }
    children.push(new Paragraph({ children: [] })) // blank line
    children.push(new Paragraph({ children: [new TextRun(introText)] }))
    children.push(hr('000000', 6))

    // Findings
    findingsWithPending.forEach((finding: any, index: number) => {
      children.push(new Paragraph({
        spacing: { before: 240 },
        children: [new TextRun({ text: `Finding ${index + 1}:`, bold: true })],
      }))
      children.push(...renderFindingBody(finding.finding || ''))
      if (finding.assigned_to) {
        children.push(new Paragraph({ children: [new TextRun({ text: `Assigned to: ${finding.assigned_to}`, italics: true })] }))
      }
      if (finding.response) {
        children.push(new Paragraph({ children: [new TextRun({ text: 'Response:', bold: true })] }))
        for (const line of String(finding.response).split('\n')) {
          children.push(new Paragraph({ children: [new TextRun(line)] }))
        }
      }
      for (const url of parseAttachmentUrls(finding.document_url)) {
        children.push(new Paragraph({ children: [new TextRun({ text: `See attached: ${attachmentFileName(url)}`, italics: true })] }))
      }
      children.push(hr('CCCCCC', 4))
    })

    // Signature block
    if (signatoryName) {
      children.push(new Paragraph({ spacing: { before: 480 }, children: [new TextRun(signatoryName)] }))
      children.push(new Paragraph({ children: [new TextRun('Signature')] }))
      children.push(new Paragraph({ children: [new TextRun(`Date: ${new Date().toLocaleDateString()}`)] }))
    }

    return new Document({ sections: [{ children }] })
  }

  const generateDOCX = async () => {
    if (readyCount() === 0) { toast('No findings are marked "Ready" to include in the report.', 'warning'); return }
    const blob = await Packer.toBlob(buildReportDocx())
    saveAs(blob, 'MOR-Response-Report.docx')
  }

  const downloadZip = async () => {
    if (readyCount() === 0) { toast('No findings are marked "Ready" to include in the report.', 'warning'); return }
    // Merge in any responses still pending the debounced save.
    // Only findings marked "Ready" are included in the submitted response report.
    const findingsWithPending = findings
      .filter((f: any) => f.status === 'Ready')
      .map((f: any) => ({
        ...f,
        response: pendingResponses.current[f.id] ?? f.response,
      }))
    const zip = new JSZip()

    // Word version of the response report (same content as the standalone download).
    const docxBlob = await Packer.toBlob(buildReportDocx())
    zip.file('MOR_Response_Report.docx', docxBlob)

    for (let i = 0; i < findingsWithPending.length; i++) {
      const finding = findingsWithPending[i]
      const urls = parseAttachmentUrls(finding.document_url)
      for (let j = 0; j < urls.length; j++) {
        const url = urls[j]
        try {
          const response = await fetch(url)
          const blob = await response.blob()
          const originalExt = (url.split('.').pop() || 'bin').split('?')[0]
          const shortDesc = finding.finding ? finding.finding.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_') : 'attachment'
          const suffix = urls.length > 1 ? `_${j + 1}` : ''
          const fileName = `Finding_${i + 1}${suffix}_${shortDesc}.${originalExt}`
          zip.file(fileName, blob)
        } catch (err) {
          console.error(`Failed to fetch attachment ${j + 1} for finding ${i + 1}`)
        }
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    saveAs(zipBlob, `MOR_Response_${property.name || 'Package'}.zip`)
  }

  if (loading) return <div className="bg-white rounded-lg shadow p-6 text-gray-500">Loading findings...</div>

  return (
    <div className="space-y-4">
      {/* MOR Info */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Response Due Date</label>
            <input
              type="date"
              value={responseDueDate}
              onChange={(e: any) => setResponseDueDate(e.target.value)}
              onBlur={async (e: any) => {
                if (!morId) return
                await supabase.from('mors').update({ response_due_date: e.target.value || null }).eq('id', morId)
                if (onUpdateMor) onUpdateMor()
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">MOR Rating</label>
            <select
              value={morRating}
              onChange={async (e: any) => {
                const value = e.target.value
                setMorRating(value)
                if (!morId) return
                const { error } = await supabase.from('mors').update({ rating: value || null }).eq('id', morId)
                if (error) { toast('Error saving rating: ' + error.message, 'error'); return }
                if (onUpdateMor) onUpdateMor()
                if (value) toast('MOR rating saved.', 'success')
              }}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
            >
              <option value="">Select Rating</option>
              <option value="Unsatisfactory">Unsatisfactory</option>
              <option value="Below Average">Below Average</option>
              <option value="Satisfactory">Satisfactory</option>
              <option value="Above Average">Above Average</option>
              <option value="Superior">Superior</option>
            </select>
          </div>
        </div>
        <div className="flex justify-end mt-3">
          <button
            onClick={completeMor}
            disabled={completing}
            className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50"
          >
            {completing ? 'Completing...' : '✓ Complete MOR'}
          </button>
        </div>
      </div>

      {deadline && (
        <div className={`rounded-lg p-4 ${daysLeft !== null && daysLeft < 0 ? 'bg-red-50 border border-red-200' : daysLeft !== null && daysLeft <= 7 ? 'bg-yellow-50 border border-yellow-200' : 'bg-blue-50 border border-blue-200'}`}>
          <p className={`text-sm font-medium ${daysLeft !== null && daysLeft < 0 ? 'text-red-700' : daysLeft !== null && daysLeft <= 7 ? 'text-yellow-700' : 'text-blue-700'}`}>
            {daysLeft !== null && daysLeft < 0 ? `⚠️ Response deadline was ${Math.abs(daysLeft)} days ago!` : daysLeft === 0 ? '⚠️ Response due today!' : `📅 Response deadline: ${formatDateObj(deadline)} (${daysLeft} days remaining)`}
          </p>
        </div>
      )}

      {/* Response Submitted to CA */}
      <div className={`rounded-lg p-4 ${responseSubmittedDate ? 'bg-green-50 border border-green-200' : 'bg-white shadow'}`}>
        <label className="block text-xs text-gray-500 mb-1">Response Submitted to CA:</label>
        <input
          type="date"
          value={responseSubmittedDate}
          onChange={(e: any) => setResponseSubmittedDate(e.target.value)}
          onBlur={async (e: any) => {
            if (!morId) return
            await supabase.from('mors').update({ response_submitted_date: e.target.value || null }).eq('id', morId)
            if (onUpdateMor) onUpdateMor()
          }}
          className={`border rounded px-3 py-2 text-sm ${responseSubmittedDate ? 'border-green-300 bg-white text-green-700 font-medium' : 'border-gray-300'}`}
        />
        {responseSubmittedDate && (
          <p className="mt-2 text-sm font-medium text-green-700">✅ Response Sent: {formatDate(responseSubmittedDate)}</p>
        )}
      </div>

      {/* Follow-up (after CA review/rejection) */}
      <div className="bg-white rounded-lg shadow p-4">
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={followUp}
            onChange={async (e: any) => {
              const checked = e.target.checked
              setFollowUp(checked)
              if (!morId) return
              const { error } = await supabase.from('mors').update({ follow_up: checked }).eq('id', morId)
              if (error) { toast('Could not save follow-up — run the mor_followup_fields.sql migration in Supabase. (' + error.message + ')', 'error'); return }
              if (onUpdateMor) onUpdateMor()
            }}
          />
          Follow-up needed (CA rejected one or more responses)
        </label>
        {followUp && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Follow-up Response Due Date:</label>
              <input
                type="date"
                value={followUpDueDate}
                onChange={(e: any) => setFollowUpDueDate(e.target.value)}
                onBlur={async (e: any) => {
                  if (!morId) return
                  const { error } = await supabase.from('mors').update({ follow_up_response_due_date: e.target.value || null }).eq('id', morId)
                  if (error) { toast('Could not save follow-up date: ' + error.message, 'error'); return }
                  if (onUpdateMor) onUpdateMor()
                }}
                className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Follow-up Response Submitted to CA:</label>
              <input
                type="date"
                value={followUpSubmittedDate}
                onChange={(e: any) => setFollowUpSubmittedDate(e.target.value)}
                onBlur={async (e: any) => {
                  if (!morId) return
                  const { error } = await supabase.from('mors').update({ follow_up_response_submitted_date: e.target.value || null }).eq('id', morId)
                  if (error) { toast('Could not save follow-up date: ' + error.message, 'error'); return }
                  if (onUpdateMor) onUpdateMor()
                }}
                className={`w-full border rounded px-3 py-2 text-sm ${followUpSubmittedDate ? 'border-green-300 text-green-700 font-medium' : 'border-gray-300'}`}
              />
            </div>
          </div>
        )}
        {followUp && followUpSubmittedDate && (
          <p className="mt-2 text-sm font-medium text-green-700">✅ Follow-up Sent: {formatDate(followUpSubmittedDate)}</p>
        )}
      </div>

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-800">
          Findings & Response
          {total > 0 && <span className="ml-2 text-sm font-normal text-gray-500">({open} open of {total})</span>}
        </h2>
        <div className="flex gap-2">
          <label className="bg-yellow-500 text-white px-3 py-1 rounded text-sm hover:bg-yellow-600 cursor-pointer">
            🤖 Extract Findings from PDF
            <input type="file" accept=".pdf" className="hidden" onChange={extractFindingsFromPDF} />
          </label>

          {findings.length > 0 && (
            <>
              <button onClick={() => setShowReportSettings(true)} className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700">⚙️ Report Settings</button>
              <button onClick={generatePDF} className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">📄 Generate PDF Report</button>
              <button onClick={generateDOCX} className="bg-blue-700 text-white px-3 py-1 rounded text-sm hover:bg-blue-800">📝 Download as Word</button>
              <button onClick={downloadZip} className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700">📦 Download Full Package (ZIP)</button>
            </>
          )}
          <button onClick={() => setShowAddFinding(true)} className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">+ Add Finding</button>
        </div>
      </div>

      {findings.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Filter by status:</span>
          {['all', ...findingStatuses].map((s) => {
            const count = s === 'all' ? findings.length : findings.filter((f: any) => f.status === s).length
            return (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`text-xs px-3 py-1 rounded-full border transition ${statusFilter === s ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:border-blue-400'}`}
              >
                {s === 'all' ? 'All' : s} ({count})
              </button>
            )
          })}
        </div>
      )}

      {findings.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap bg-white rounded-lg shadow px-3 py-2">
          <label className="flex items-center gap-1 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={visibleFindings.length > 0 && visibleFindings.every((f: any) => selectedFindingIds.includes(f.id))}
              onChange={(e: any) => {
                const visibleIds = visibleFindings.map((f: any) => f.id)
                setSelectedFindingIds(ids => e.target.checked
                  ? Array.from(new Set([...ids, ...visibleIds]))
                  : ids.filter(id => !visibleIds.includes(id)))
              }}
            />
            Select all shown
          </label>
          <span className="text-xs text-gray-500">{selectedFindingIds.length} selected</span>
          <select
            value={bulkStatus}
            onChange={(e: any) => setBulkStatus(e.target.value)}
            disabled={selectedFindingIds.length === 0}
            className="text-xs border border-gray-300 rounded px-2 py-1 disabled:opacity-50"
          >
            <option value="">Set status to…</option>
            {findingStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <button
            onClick={() => bulkUpdateStatus(bulkStatus)}
            disabled={!bulkStatus || selectedFindingIds.length === 0}
            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Apply
          </button>
          {selectedFindingIds.length > 0 && (
            <button onClick={() => setSelectedFindingIds([])} className="text-xs text-gray-500 hover:text-gray-700 underline">Clear</button>
          )}
        </div>
      )}

      {findings.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500 text-sm">No findings yet. Click "+ Add Finding" to log findings from the MOR report.</div>
      ) : visibleFindings.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500 text-sm">No findings with status &quot;{statusFilter}&quot;.</div>
      ) : (
        <div className="space-y-3">
          {visibleFindings.map((finding: any) => {
            const index = findings.findIndex((f: any) => f.id === finding.id)
            return (
            <div key={finding.id} className="bg-white rounded-lg shadow p-5">
              <div className="flex items-start gap-3">
                <div className="flex flex-col gap-1 mt-1">
                  <button onClick={() => moveFindingTo(index, 'top')} title="Move to top" className="text-gray-400 hover:text-gray-600 text-xs leading-none">⤒</button>
                  <button onClick={() => moveFinding(index, -1)} title="Move up" className="text-gray-400 hover:text-gray-600 text-xs leading-none">▲</button>
                  <button onClick={() => moveFinding(index, 1)} title="Move down" className="text-gray-400 hover:text-gray-600 text-xs leading-none">▼</button>
                  <button onClick={() => moveFindingTo(index, 'bottom')} title="Move to bottom" className="text-gray-400 hover:text-gray-600 text-xs leading-none">⤓</button>
                </div>
                <div className="flex-1">
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <input type="checkbox" checked={selectedFindingIds.includes(finding.id)} onChange={() => toggleSelectFinding(finding.id)} title="Select for bulk status change" />
                  <select value={finding.status} onChange={(e: any) => updateFinding(finding.id, { status: e.target.value })} className={`text-xs px-2 py-1 rounded border ${statusClasses(finding.status)}`}>
                    {findingStatuses.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <button onClick={() => deleteFinding(finding.id)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500">Finding</label>
                  <FindingTextarea value={finding.finding} onSave={(v: string) => updateFinding(finding.id, { finding: v })} rows={12} className="w-full mt-1 border border-gray-200 rounded px-3 py-2 text-sm resize-y" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500">Assigned To</label>
                    <input type="text" value={finding.assigned_to || ''} onChange={(e: any) => updateFinding(finding.id, { assigned_to: e.target.value })} className="w-full mt-1 border border-gray-200 rounded px-3 py-2 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500">Due Date</label>
                    <input type="date" value={finding.due_date || ''} onChange={(e: any) => updateFinding(finding.id, { due_date: e.target.value || null })} className="w-full mt-1 border border-gray-200 rounded px-3 py-2 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-gray-500">Written Response</label>
                  <DebouncedFindingTextarea value={finding.response || ''} onType={(v: string) => { pendingResponses.current[finding.id] = v }} onSave={(v: string) => updateFinding(finding.id, { response: v || null })} rows={3} placeholder="Type your response to this finding here..." className="w-full mt-1 border border-gray-200 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Supporting Documents</label>
                  <div className="mt-1 flex flex-wrap items-center gap-3">
                    {parseAttachmentUrls(finding.document_url).map((url: string, i: number) => (
                      <span key={i} className="flex items-center gap-1">
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">📎 {attachmentFileName(url)}</a>
                        <button onClick={() => removeFindingFile(finding, url)} className="text-xs text-red-400 hover:text-red-600" title="Remove file">✕</button>
                      </span>
                    ))}
                    <label className="cursor-pointer text-xs text-blue-600 hover:underline">
                      📎 Upload Document(s)
                      <input type="file" multiple className="hidden" onChange={async (e: any) => { await uploadFindingFiles(finding, e.target.files); e.target.value = '' }} />
                    </label>
                  </div>
                </div>
              </div>
                </div>
              </div>
            </div>
            )
          })}
        </div>
      )}

      {showAddFinding && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold mb-4">Add Finding</h3>
            <div className="space-y-3">
              <textarea placeholder="Finding description *" value={newFinding.finding} onChange={(e: any) => setNewFinding({...newFinding, finding: e.target.value})} rows={3} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              <input type="text" placeholder="Assigned to" value={newFinding.assigned_to} onChange={(e: any) => setNewFinding({...newFinding, assigned_to: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              <input type="date" value={newFinding.due_date} onChange={(e: any) => setNewFinding({...newFinding, due_date: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              <textarea placeholder="Initial response (optional)" value={newFinding.response} onChange={(e: any) => setNewFinding({...newFinding, response: e.target.value})} rows={3} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setShowAddFinding(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button onClick={addFinding} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Add Finding</button>
            </div>
          </div>
        </div>
      )}

      {showReportSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-bold mb-4">Report Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Intro Text</label>
                <textarea value={introText} onChange={(e: any) => setIntroText(e.target.value)} rows={4} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Signatory Name & Title</label>
                <input type="text" value={signatoryName} onChange={(e: any) => setSignatoryName(e.target.value)} placeholder="e.g. Ari Rubinfeld, Director of Compliance" className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              </div>
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setShowReportSettings(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
              <button onClick={() => setShowReportSettings(false)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Extracting indicator */}
      {extracting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 text-center">
            <p className="text-lg font-medium">🤖 Extracting findings...</p>
            <p className="text-sm text-gray-500 mt-2">{extractProgress || 'Claude is reading your MOR report'}</p>
            <p className="text-xs text-gray-400 mt-1">Large reports can take a minute or two — please keep this tab open.</p>
          </div>
        </div>
      )}

      {/* Extracted Findings Preview */}
      {showExtracted && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <h3 className="text-lg font-bold mb-2">Extracted Findings</h3>
            <p className="text-sm text-gray-500 mb-4">{extractedFindings.length} {extractedFindings.length === 1 ? 'finding' : 'findings'} requiring a response. Review before importing.</p>
            <div className="space-y-3">
              {extractedFindings.map((f: any, i: number) => (
                <div key={i} className="p-3 border border-gray-200 rounded">
                  <p className="text-xs font-bold text-blue-600">
                    {f.item}{f.due_date ? ` · Due ${f.due_date}` : ''}
                  </p>
                  {f.finding && <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap">{f.finding}</p>}
                </div>
              ))}
            </div>
            <div className="flex gap-3 justify-end mt-4">
              <button onClick={() => setShowExtracted(false)} className="px-4 py-2 text-sm text-gray-600 border rounded">Cancel</button>
              <button onClick={importFindings} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Import All Findings</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default function PropertyPage() {
  const { toast, confirm } = useToast()
  const router = useRouter()
  const { id } = useParams()
  const [property, setProperty] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>({})
  const [saving, setSaving] = useState(false)
  const [mors, setMors] = useState<any[]>([])
  const [currentMorId, setCurrentMorId] = useState<any>(null)
  const [currentMor, setCurrentMor] = useState<any>(null)
  const [showNewMor, setShowNewMor] = useState(false)
  const [newMorDate, setNewMorDate] = useState('')
  const [showEditMorDate, setShowEditMorDate] = useState(false)
  const [editMorDate, setEditMorDate] = useState('')
  const [companies, setCompanies] = useState<any[]>([])

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) router.push('/')
    }
    getUser()
    fetchProperty()
    fetchMors()
    fetchCompanies()
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

  const fetchCompanies = async () => {
    const { data } = await supabase.from('companies').select('*').order('name')
    if (data) setCompanies(data)
  }

const fetchMors = async () => {
    const { data } = await supabase
      .from('mors')
      .select('*')
      .eq('property_id', id)
      .order('created_at', { ascending: false })
    if (data) {
      setMors(data)
      if (data.length > 0) {
        const found = currentMorId ? data.find((m: any) => m.id === currentMorId) : null
        const selected = found || data[0]
        if (!currentMorId) setCurrentMorId(selected.id)
        setCurrentMor(selected)
      }
    }
  }

  const deleteMor = async (morIdToDelete: string) => {
    if (!morIdToDelete) return
    const ok = await confirm({
      title: 'Delete MOR?',
      message: 'Delete this MOR? This will permanently delete all documents, tasks, meetings, and findings associated with it. This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true,
    })
    if (!ok) return

    await supabase.from('documents').delete().eq('mor_id', morIdToDelete)
    await supabase.from('tasks').delete().eq('mor_id', morIdToDelete)
    await supabase.from('meetings').delete().eq('mor_id', morIdToDelete)
    await supabase.from('findings').delete().eq('mor_id', morIdToDelete)
    await supabase.from('mors').delete().eq('id', morIdToDelete)

    const { data } = await supabase
      .from('mors')
      .select('*')
      .eq('property_id', id)
      .order('created_at', { ascending: false })
    const list = data || []
    setMors(list)
    if (currentMorId === morIdToDelete) {
      const next = list[0] || null
      setCurrentMorId(next?.id || null)
      setCurrentMor(next)
    }
  }

  // Single lifecycle status for the currently selected Active MOR:
  // scheduled -> awaiting report -> response due -> response sent ->
  // (follow-up) follow-up due -> follow-up sent. Returns null when not Active.
  const getCurrentMorStatus = () => {
    if (!currentMor || currentMor.status !== 'Active') return null
    const fmt = (s: string) => formatDate(s)
    if (currentMor.follow_up) {
      if (currentMor.follow_up_response_submitted_date)
        return { label: `✅ Follow-up Sent - ${fmt(currentMor.follow_up_response_submitted_date)}`, classes: 'bg-green-100 text-green-700' }
      if (currentMor.follow_up_response_due_date)
        return { label: `📝 Follow-up Response Due - ${fmt(currentMor.follow_up_response_due_date)}`, classes: 'bg-orange-100 text-orange-700' }
    }
    if (currentMor.response_submitted_date)
      return { label: `✅ Response Sent - ${fmt(currentMor.response_submitted_date)}`, classes: 'bg-green-100 text-green-700' }
    if (currentMor.response_due_date)
      return { label: `📝 Response Due - ${fmt(currentMor.response_due_date)}`, classes: 'bg-orange-100 text-orange-700' }
    if (!currentMor.mor_date) return null
    const morDate = parseDate(currentMor.mor_date)!
    const now = new Date()
    const todayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    if (morDate.getTime() >= todayUTC)
      return { label: `📋 Scheduled - ${fmt(currentMor.mor_date)}`, classes: 'bg-blue-100 text-blue-700' }
    return { label: `⏳ Awaiting Report - ${fmt(currentMor.mor_date)}`, classes: 'bg-orange-100 text-orange-700' }
  }

  const saveMorDate = async () => {
    if (!currentMorId) return
    const { error } = await supabase.from('mors').update({ mor_date: editMorDate || null }).eq('id', currentMorId)
    if (error) {
      toast('Error updating MOR date: ' + error.message, 'error')
      return
    }
    setShowEditMorDate(false)
    await fetchMors()
    toast('MOR date updated.', 'success')
  }

  const saveProperty = async () => {
    setSaving(true)
    const { companies, created_at, ...updateData } = form
    const { error } = await supabase.from('properties').update(updateData).eq('id', id)
    if (error) {
      setSaving(false)
      toast('Error saving property: ' + error.message, 'error')
      return
    }
    await fetchProperty()
    setEditing(false)
    setSaving(false)
    toast('Property saved successfully.', 'success')
  }

  if (!property) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <p className="text-gray-500">Loading...</p>
    </div>
  )

  const tabs = ['Overview', ...(mors.length > 0 ? ['MOR Binder', 'Tasks', 'Meetings', 'Findings'] : [])]

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow-sm px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-sm text-blue-600 hover:underline">
            ← Back to Dashboard
          </button>
          <h1 className="text-xl font-bold text-gray-800">{property.name}</h1>
          <span className="text-sm text-gray-500">{property.companies?.name}</span>
        </div>
        <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/' }} className="text-sm text-gray-500 hover:text-gray-700">
          Sign Out
        </button>
      </nav>

      <div className="bg-white border-b px-6">
        {/* MOR Selector */}
        <div className="flex items-center justify-between py-3 border-b">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-600">MOR:</span>
            <select
              value={currentMorId || ''}
              onChange={(e: any) => {
                setCurrentMorId(e.target.value)
                setCurrentMor(mors.find((m: any) => m.id === e.target.value) || null)
              }}
              className="border border-gray-300 rounded px-3 py-1 text-sm"
            >
              {mors.map((mor: any) => (
                <option key={mor.id} value={mor.id}>
                  {mor.mor_date ? parseDate(mor.mor_date)!.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }) : 'No date'} — {mor.status}
                </option>
              ))}
            </select>
            {currentMorId && (
              <button
                onClick={() => { setEditMorDate(currentMor?.mor_date || ''); setShowEditMorDate(true) }}
                title="Edit MOR date"
                className="text-gray-400 hover:text-blue-600 text-base"
              >
                ✏️
              </button>
            )}
            {(() => {
              const status = getCurrentMorStatus()
              return status ? (
                <span className={`text-xs px-2 py-1 rounded ${status.classes}`}>{status.label}</span>
              ) : null
            })()}
            {currentMorId && (
              <button
                onClick={() => deleteMor(currentMorId)}
                title="Delete this MOR and all its documents, tasks, meetings, and findings"
                className="text-red-400 hover:text-red-600 text-sm"
              >
                🗑️ Delete MOR
              </button>
            )}
          </div>
          <button
            onClick={() => setShowNewMor(true)}
            className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700"
          >
            + New MOR
          </button>
        </div>

        <div className="flex gap-6">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab.toLowerCase())}
              className={`py-4 text-sm font-medium border-b-2 transition ${activeTab === tab.toLowerCase() ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
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
                <button onClick={() => setEditing(true)} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">Edit</button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm text-gray-600 border rounded hover:bg-gray-50">Cancel</button>
                  <button onClick={saveProperty} className="bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">{saving ? 'Saving...' : 'Save'}</button>
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
                { label: 'Last MOR Date', field: 'last_mor_date', type: 'date' },
              ].map(({ label, field, type }) => (
                <div key={field}>
                  <label className="block text-xs text-gray-500 mb-1">{label}</label>
                  {editing ? (
                    <input type={type} value={form[field] || ''} onChange={(e: any) => setForm({...form, [field]: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
                  ) : (
                    <p className="text-sm font-medium text-gray-800">{property[field] || '—'}</p>
                  )}
                </div>
              ))}

              <div>
                <label className="block text-xs text-gray-500 mb-1">Management Company</label>
                {editing ? (
                  <select value={form.company_id || ''} onChange={(e: any) => setForm({...form, company_id: e.target.value || null})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
                    <option value="">Select Company</option>
                    {companies.map((c: any) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm font-medium text-gray-800">{property.companies?.name || '—'}</p>
                )}
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Last MOR Rating</label>
                {editing ? (
                  <select value={form.last_mor_rating || ''} onChange={(e: any) => setForm({...form, last_mor_rating: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
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
                  <select value={form.contract_type || ''} onChange={(e: any) => setForm({...form, contract_type: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
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
                  <select value={form.risk_classification || ''} onChange={(e: any) => setForm({...form, risk_classification: e.target.value})} className="w-full border border-gray-300 rounded px-3 py-2 text-sm">
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

              <div>
                <label className="block text-xs text-gray-500 mb-1">Scheduled MOR Date</label>
                <p className="text-sm font-medium text-gray-800">
                  {currentMor?.mor_date ? formatDate(currentMor.mor_date) : '—'}
                </p>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Response Due Date</label>
                <p className="text-sm font-medium text-gray-800">
                  {currentMor?.response_due_date
                    ? formatDate(currentMor.response_due_date)
                    : '—'}
                </p>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Management/Ownership Change</label>
                {editing ? (
                  <label className="flex items-center gap-2 text-sm text-gray-800 mt-1">
                    <input
                      type="checkbox"
                      checked={!!form.management_change}
                      onChange={(e: any) => setForm({ ...form, management_change: e.target.checked, management_change_date: e.target.checked ? form.management_change_date : null })}
                    />
                    Yes
                  </label>
                ) : (
                  <p className="text-sm font-medium text-gray-800">{property.management_change ? 'Yes' : 'No'}</p>
                )}
              </div>

              {(editing ? form.management_change : property.management_change) && (
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Change Date</label>
                  {editing ? (
                    <input
                      type="date"
                      value={form.management_change_date || ''}
                      onChange={(e: any) => setForm({ ...form, management_change_date: e.target.value || null })}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                    />
                  ) : (
                    <p className="text-sm font-medium text-gray-800">
                      {property.management_change_date ? formatDate(property.management_change_date) : '—'}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-xs text-gray-500 mb-1">HUD Communication Notes</label>
              {editing ? (
                <textarea value={form.hud_notes || ''} onChange={(e: any) => setForm({...form, hud_notes: e.target.value})} rows={3} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              ) : (
                <p className="text-sm text-gray-800">{property.hud_notes || '—'}</p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'mor binder' && (
          <DocumentsTab propertyId={id} morId={currentMorId} />
        )}

        {activeTab === 'tasks' && (
          <div className="space-y-4">
            {/* MOR Scheduling Email — standalone info block at the very top (not a checklist item). */}
            <div className="bg-white rounded-lg shadow p-4">
              <h3 className="text-sm font-medium text-gray-700 mb-3">MOR Scheduling Email</h3>
              <div className="mb-3">
                <label className="block text-xs text-gray-500 mb-1">Notes</label>
                <textarea
                  key={property.id}
                  defaultValue={property.mor_scheduling_email_notes || ''}
                  onBlur={async (e: any) => {
                    await supabase.from('properties').update({ mor_scheduling_email_notes: e.target.value }).eq('id', id)
                    fetchProperty()
                  }}
                  rows={3}
                  className="w-full border border-gray-200 rounded px-3 py-2 text-sm"
                  placeholder="Enter notes about the MOR scheduling email..."
                />
              </div>
              <div className="space-y-2">
                {(property.overview_files || []).map((file: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 border border-gray-200 rounded">
                    <a href={file.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline">
                      📎 {file.name}
                    </a>
                    <button
                      onClick={async () => {
                        const updated = (property.overview_files || []).filter((_: any, idx: number) => idx !== i)
                        await supabase.from('properties').update({ overview_files: updated }).eq('id', id)
                        fetchProperty()
                      }}
                      className="text-xs text-red-400 hover:text-red-600"
                    >
                      Remove
                    </button>
                  </div>
                ))}
                <label className="cursor-pointer inline-flex items-center gap-2 text-sm text-blue-600 hover:underline">
                  📎 Upload Document(s)
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={async (e: any) => {
                      const files = Array.from(e.target.files || []) as File[]
                      if (!files.length) return
                      const currentFiles = property.overview_files || []
                      const added: any[] = []
                      for (const file of files) {
                        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
                        const filePath = `${id}/overview/${Date.now()}-${safeName}`
                        const { error } = await supabase.storage.from('mor-documents').upload(filePath, file, { upsert: true })
                        if (error) { toast(`Error uploading ${file.name}: ${error.message}`, 'error'); continue }
                        const { data: urlData } = supabase.storage.from('mor-documents').getPublicUrl(filePath)
                        added.push({ name: file.name, url: urlData.publicUrl })
                      }
                      if (added.length) {
                        await supabase.from('properties').update({ overview_files: [...currentFiles, ...added] }).eq('id', id)
                        fetchProperty()
                      }
                      e.target.value = ''
                    }}
                  />
                </label>
              </div>
            </div>
            <TasksTab propertyId={id} morId={currentMorId} />
          </div>
        )}

        {activeTab === 'meetings' && (
          <MeetingsTab propertyId={id} morId={currentMorId} />
        )}

        {activeTab === 'findings' && (
          <FindingsTab
            propertyId={id}
            morId={currentMorId}
            currentMor={currentMor}
            property={property}
            onCompleteMor={async () => { await fetchProperty(); await fetchMors() }}
            onUpdateMor={fetchMors}
          />
        )}
      {/* New MOR Modal */}
        {showNewMor && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">Create New MOR</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Scheduled MOR Date</label>
                  <input
                    type="date"
                    value={newMorDate}
                    onChange={(e: any) => setNewMorDate(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-4">
                <button onClick={() => setShowNewMor(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
                <button
                  onClick={async () => {
                    const { data } = await supabase.from('mors').insert([{
                      property_id: id,
                      mor_date: newMorDate || null,
                      status: 'Active',
                      documents_initialized: true
                    }]).select()

                    if (data && data[0]) {
                      const newMorData = data[0]

                      if (currentMorId) {
                        await supabase.rpc('copy_mor_documents', {
                          p_source_mor_id: currentMorId,
                          p_target_mor_id: newMorData.id,
                          p_property_id: id
                        })
                      }

                      setNewMorDate('')
                      setShowNewMor(false)
                      await fetchMors()
                      setCurrentMorId(newMorData.id)
                      setCurrentMor(newMorData)
                    }
                  }}
                  className="bg-blue-600 text-white px-4 py-2 rounded text-sm"
                >
                  Create MOR
                </button>
              </div>
            </div>
          </div>
        )}

        {showEditMorDate && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-bold mb-4">Edit MOR Date</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Scheduled MOR Date</label>
                  <input
                    type="date"
                    value={editMorDate}
                    onChange={(e: any) => setEditMorDate(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex gap-3 justify-end mt-4">
                <button onClick={() => setShowEditMorDate(false)} className="px-4 py-2 text-sm text-gray-600">Cancel</button>
                <button onClick={saveMorDate} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">Save</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}