'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import jsPDF from 'jspdf'
import JSZip from 'jszip'
import { saveAs } from 'file-saver'

function DocumentsTab({ propertyId }: any) {
  const [documents, setDocuments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddCustom, setShowAddCustom] = useState(false)
  const [showPacket, setShowPacket] = useState(false)
  const [customDoc, setCustomDoc] = useState<any>({ name: '', assigned_to: '', due_date: '', notes: '' })

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
      const docs = tmpl.map((t: any, i: number) => ({
        property_id: propertyId,
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
    await supabase.from('documents').update(updates).eq('id', id)
    setDocuments(docs => docs.map((d: any) => d.id === id ? { ...d, ...updates } : d))
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
    await supabase.from('documents').update({ sort_order: updated[index].sort_order }).eq('id', updated[index].id)
    await supabase.from('documents').update({ sort_order: updated[swapIndex].sort_order }).eq('id', updated[swapIndex].id)
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
      status: 'Not Started',
      is_custom: true,
      sort_order: documents.length
    }
    const { data } = await supabase.from('documents').insert([docData]).select()
    if (data) {
      if (customDoc.addToTemplate) {
        await supabase.from('document_templates').insert([{ name: customDoc.name }])
      }
      setDocuments([...documents, ...data])
      setCustomDoc({ name: '', assigned_to: '', due_date: '', notes: '' })
      setShowAddCustom(false)
    }
  }

  const completed = documents.filter((d: any) => d.status === 'Submitted').length
  const total = documents.length
  const indexedDocs = documents.map((doc: any, index: number) => ({ ...doc, globalIndex: index }))

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
                  <input type="text" placeholder="Notes" value={doc.notes || ''} onChange={(e: any) => updateDoc(doc.id, { notes: e.target.value })} className="mt-1 ml-6 w-full border border-gray-200 rounded px-2 py-1 text-xs" />
                  <div className="mt-2 ml-6 flex items-center gap-2">
                    {doc.file_url ? (
                      <div className="flex items-center gap-2">
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">📎 View File</a>
                        <button onClick={() => updateDoc(doc.id, { file_url: null })} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                      </div>
                    ) : (
                      <label className="cursor-pointer text-xs text-blue-600 hover:underline">
                        📎 Upload File
                        <input type="file" className="hidden" onChange={async (e: any) => {
                          const file = e.target.files[0]
                          if (!file) return
                          const filePath = `${propertyId}/${doc.id}/${file.name}`
                          const { error } = await supabase.storage.from('mor-documents').upload(filePath, file, { upsert: true })
                          if (!error) {
                            const { data: urlData } = supabase.storage.from('mor-documents').getPublicUrl(filePath)
                            await updateDoc(doc.id, { file_url: urlData.publicUrl })
                          }
                        }} />
                      </label>
                    )}
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
            {documents.filter((d: any) => d.file_url).length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-4">No files uploaded yet.</p>
            ) : (
              <div className="space-y-2">
                {documents.filter((d: any) => d.file_url).map((doc: any) => (
                  <div key={doc.id} className="flex items-center justify-between p-3 border border-gray-200 rounded">
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-800">{doc.name}</p>
                      <p className="text-xs text-gray-500">{doc.status}</p>
                    </div>
                    <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline ml-3">📎 View</a>
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
function TasksTab({ propertyId }: any) {
  const [tasks, setTasks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddTask, setShowAddTask] = useState(false)
  const [newTask, setNewTask] = useState<any>({ title: '', assigned_to: '', due_date: '' })

  useEffect(() => {
    fetchTasks()
  }, [propertyId])

  const fetchTasks = async () => {
    setLoading(true)
    const { data } = await supabase.from('tasks').select('*').eq('property_id', propertyId).order('created_at')
    if (data && data.length > 0) {
      setTasks(data)
    } else {
      await loadFromTemplates()
    }
    setLoading(false)
  }

  const loadFromTemplates = async () => {
    const { data: tmpl } = await supabase.from('task_templates').select('*').order('created_at')
    if (tmpl && tmpl.length > 0) {
      const tasks = tmpl.map((t: any) => ({
        property_id: propertyId,
        title: t.title,
        assigned_to: '',
        due_date: null,
        completed: false,
        is_custom: false
      }))
      const { data: inserted } = await supabase.from('tasks').insert(tasks).select()
      if (inserted) setTasks(inserted)
    }
  }

  const updateTask = async (id: any, updates: any) => {
    await supabase.from('tasks').update(updates).eq('id', id)
    setTasks(tasks => tasks.map((t: any) => t.id === id ? { ...t, ...updates } : t))
  }

  const addTask = async (e: any) => {
    if (e) e.preventDefault()
    if (!newTask.title) return
    const taskData = {
      title: newTask.title,
      assigned_to: newTask.assigned_to || null,
      due_date: newTask.due_date || null,
      property_id: propertyId,
      completed: false,
      is_custom: true
    }
    const { data } = await supabase.from('tasks').insert([taskData]).select()
    if (data) {
      if (newTask.addToTemplate) {
        await supabase.from('task_templates').insert([{ title: newTask.title }])
      }
      setTasks([...tasks, ...data])
      setNewTask({ title: '', assigned_to: '', due_date: '' })
      setShowAddTask(false)
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

function MeetingsTab({ propertyId }: any) {
  const [meetings, setMeetings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddMeeting, setShowAddMeeting] = useState(false)
  const [newMeeting, setNewMeeting] = useState<any>({ meeting_date: '', attendees: '', notes: '', action_items: '' })

  useEffect(() => {
    fetchMeetings()
  }, [propertyId])

  const fetchMeetings = async () => {
    setLoading(true)
    const { data } = await supabase.from('meetings').select('*').eq('property_id', propertyId).order('meeting_date', { ascending: false })
    if (data) setMeetings(data)
    setLoading(false)
  }

  const addMeeting = async (e: any) => {
    if (e) e.preventDefault()
    if (!newMeeting.notes) return
    const { data } = await supabase.from('meetings').insert([{
      property_id: propertyId,
      meeting_date: newMeeting.meeting_date || null,
      attendees: newMeeting.attendees || null,
      notes: newMeeting.notes,
      action_items: newMeeting.action_items || null
    }]).select()
    if (data) {
      setMeetings([...data, ...meetings])
      setNewMeeting({ meeting_date: '', attendees: '', notes: '', action_items: '' })
      setShowAddMeeting(false)
    }
  }

  const deleteMeeting = async (id: any) => {
    await supabase.from('meetings').delete().eq('id', id)
    setMeetings(meetings.filter((m: any) => m.id !== id))
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
                    {meeting.meeting_date ? new Date(meeting.meeting_date).toLocaleDateString('en-US', { timeZone: 'UTC' }) : 'No date'}
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
function FindingsTab({ propertyId, reportDate, property }: any) {
  const [findings, setFindings] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddFinding, setShowAddFinding] = useState(false)
  const [newFinding, setNewFinding] = useState<any>({ finding: '', assigned_to: '', response: '', due_date: '' })
  const [introText, setIntroText] = useState('Below is our response to the Management and Occupancy Review above:')
  const [signatoryName, setSignatoryName] = useState('')
  const [showReportSettings, setShowReportSettings] = useState(false)

  useEffect(() => {
    fetchFindings()
  }, [propertyId])

  const fetchFindings = async () => {
    setLoading(true)
    const { data } = await supabase.from('findings').select('*').eq('property_id', propertyId).order('created_at')
    if (data) setFindings(data)
    setLoading(false)
  }

  const addFinding = async (e: any) => {
    if (e) e.preventDefault()
    if (!newFinding.finding) return
    const { data } = await supabase.from('findings').insert([{
      property_id: propertyId,
      finding: newFinding.finding,
      assigned_to: newFinding.assigned_to || null,
      response: newFinding.response || null,
      due_date: newFinding.due_date || null,
      status: 'Open'
    }]).select()
    if (data) {
      setFindings([...findings, ...data])
      setNewFinding({ finding: '', assigned_to: '', response: '', due_date: '' })
      setShowAddFinding(false)
    }
  }

  const updateFinding = async (id: any, updates: any) => {
    await supabase.from('findings').update(updates).eq('id', id)
    setFindings(findings => findings.map((f: any) => f.id === id ? { ...f, ...updates } : f))
  }

  const deleteFinding = async (id: any) => {
    await supabase.from('findings').delete().eq('id', id)
    setFindings(findings.filter((f: any) => f.id !== id))
  }

  const deadline = reportDate ? new Date(new Date(reportDate).getTime() + 30 * 24 * 60 * 60 * 1000) : null
  const daysLeft = deadline ? Math.ceil((deadline.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) : null
  const open = findings.filter((f: any) => f.status !== 'Submitted').length
  const total = findings.length

  const generatePDF = () => {
    const doc = new jsPDF()
    let y = 20

    const addHeader = () => {
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(property.name || 'Property Name', 105, 12, { align: 'center' })
      doc.setDrawColor(200, 200, 200)
      doc.line(15, 16, 195, 16)
    }

    addHeader()
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Date Generated: ${new Date().toLocaleDateString()}`, 15, y)
    y += 6
    if (property.section8_number) {
      doc.text(`Section 8 Project Number: ${property.section8_number}`, 15, y)
      y += 6
    }
    if (property.mor_date) {
      doc.text(`Date of MOR: ${new Date(property.mor_date).toLocaleDateString('en-US', { timeZone: 'UTC' })}`, 15, y)
      y += 6
    }
    y += 6
    doc.line(15, y, 195, y)
    y += 10

    const introLines = doc.splitTextToSize(introText, 175)
    doc.text(introLines, 15, y)
    y += introLines.length * 6 + 10
    doc.line(15, y, 195, y)
    y += 10

    findings.forEach((finding: any, index: number) => {
      if (y > 240) { doc.addPage(); y = 20; addHeader(); y += 10 }
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text(`Finding ${index + 1}:`, 15, y)
      y += 7
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const findingLines = doc.splitTextToSize(finding.finding || '', 175)
      doc.text(findingLines, 15, y)
      y += findingLines.length * 6 + 4
      if (finding.assigned_to) {
        doc.setFont('helvetica', 'italic')
        doc.text(`Assigned to: ${finding.assigned_to}`, 15, y)
        doc.setFont('helvetica', 'normal')
        y += 6
      }
      if (finding.response) {
        doc.setFont('helvetica', 'bold')
        doc.text('Response:', 15, y)
        y += 6
        doc.setFont('helvetica', 'normal')
        const responseLines = doc.splitTextToSize(finding.response, 175)
        doc.text(responseLines, 15, y)
        y += responseLines.length * 6 + 4
      }
      if (finding.document_url) {
        doc.setFont('helvetica', 'italic')
        doc.text(`See attached: Finding_${index + 1}_attachment`, 15, y)
        doc.setFont('helvetica', 'normal')
        y += 6
      }
      doc.setDrawColor(220, 220, 220)
      doc.line(15, y, 195, y)
      y += 10
    })

    if (signatoryName) {
      if (y > 220) { doc.addPage(); y = 20; addHeader(); y += 10 }
      y += 10
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(signatoryName, 15, y)
      y += 10
      doc.line(15, y, 100, y)
      y += 6
      doc.text('Signature', 15, y)
      y += 6
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 15, y)
    }

    doc.save('MOR-Response-Report.pdf')
  }

  const downloadZip = async () => {
    const zip = new JSZip()
    const doc = new jsPDF()
    let y = 20

    const addHeader = () => {
      doc.setFontSize(14)
      doc.setFont('helvetica', 'bold')
      doc.text(property.name || 'Property Name', 105, 12, { align: 'center' })
      doc.setDrawColor(200, 200, 200)
      doc.line(15, 16, 195, 16)
    }

    addHeader()
    doc.setFontSize(10)
    doc.setFont('helvetica', 'normal')
    doc.text(`Date Generated: ${new Date().toLocaleDateString()}`, 15, y)
    y += 6
    if (property.section8_number) {
      doc.text(`Section 8 Project Number: ${property.section8_number}`, 15, y)
      y += 6
    }
    if (property.mor_date) {
      doc.text(`Date of MOR: ${new Date(property.mor_date).toLocaleDateString('en-US', { timeZone: 'UTC' })}`, 15, y)
      y += 6
    }
    y += 6
    doc.line(15, y, 195, y)
    y += 10

    const introLines = doc.splitTextToSize(introText, 175)
    doc.text(introLines, 15, y)
    y += introLines.length * 6 + 10
    doc.line(15, y, 195, y)
    y += 10

    findings.forEach((finding: any, index: number) => {
      if (y > 240) { doc.addPage(); y = 20; addHeader(); y += 10 }
      doc.setFontSize(11)
      doc.setFont('helvetica', 'bold')
      doc.text(`Finding ${index + 1}:`, 15, y)
      y += 7
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      const findingLines = doc.splitTextToSize(finding.finding || '', 175)
      doc.text(findingLines, 15, y)
      y += findingLines.length * 6 + 4
      if (finding.response) {
        doc.setFont('helvetica', 'bold')
        doc.text('Response:', 15, y)
        y += 6
        doc.setFont('helvetica', 'normal')
        const responseLines = doc.splitTextToSize(finding.response, 175)
        doc.text(responseLines, 15, y)
        y += responseLines.length * 6 + 4
      }
      if (finding.document_url) {
        doc.setFont('helvetica', 'italic')
        doc.text(`See attached: Finding_${index + 1}_attachment`, 15, y)
        doc.setFont('helvetica', 'normal')
        y += 6
      }
      doc.setDrawColor(220, 220, 220)
      doc.line(15, y, 195, y)
      y += 10
    })

    if (signatoryName) {
      if (y > 220) { doc.addPage(); y = 20; addHeader(); y += 10 }
      y += 10
      doc.setFontSize(10)
      doc.setFont('helvetica', 'normal')
      doc.text(signatoryName, 15, y)
      y += 10
      doc.line(15, y, 100, y)
      y += 6
      doc.text('Signature', 15, y)
      y += 6
      doc.text(`Date: ${new Date().toLocaleDateString()}`, 15, y)
    }

    const pdfBlob = doc.output('blob')
    zip.file('MOR_Response_Report.pdf', pdfBlob)

    for (let i = 0; i < findings.length; i++) {
      const finding = findings[i]
      if (finding.document_url) {
        try {
          const response = await fetch(finding.document_url)
          const blob = await response.blob()
          const originalExt = finding.document_url.split('.').pop().split('?')[0]
          const shortDesc = finding.finding ? finding.finding.substring(0, 30).replace(/[^a-zA-Z0-9]/g, '_') : 'attachment'
          const fileName = `Finding_${i + 1}_${shortDesc}.${originalExt}`
          zip.file(fileName, blob)
        } catch (err) {
          console.error(`Failed to fetch attachment for finding ${i + 1}`)
        }
      }
    }

    const zipBlob = await zip.generateAsync({ type: 'blob' })
    saveAs(zipBlob, `MOR_Response_${property.name || 'Package'}.zip`)
  }

  if (loading) return <div className="bg-white rounded-lg shadow p-6 text-gray-500">Loading findings...</div>

  return (
    <div className="space-y-4">
      {deadline && (
        <div className={`rounded-lg p-4 ${daysLeft !== null && daysLeft < 0 ? 'bg-red-50 border border-red-200' : daysLeft !== null && daysLeft <= 7 ? 'bg-yellow-50 border border-yellow-200' : 'bg-blue-50 border border-blue-200'}`}>
          <p className={`text-sm font-medium ${daysLeft !== null && daysLeft < 0 ? 'text-red-700' : daysLeft !== null && daysLeft <= 7 ? 'text-yellow-700' : 'text-blue-700'}`}>
            {daysLeft !== null && daysLeft < 0 ? `⚠️ Response deadline was ${Math.abs(daysLeft)} days ago!` : daysLeft === 0 ? '⚠️ Response due today!' : `📅 Response deadline: ${deadline.toLocaleDateString()} (${daysLeft} days remaining)`}
          </p>
        </div>
      )}

      <div className="flex justify-between items-center">
        <h2 className="text-lg font-bold text-gray-800">
          Findings & Response
          {total > 0 && <span className="ml-2 text-sm font-normal text-gray-500">({open} open of {total})</span>}
        </h2>
        <div className="flex gap-2">
          {findings.length > 0 && (
            <>
              <button onClick={() => setShowReportSettings(true)} className="bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700">⚙️ Report Settings</button>
              <button onClick={generatePDF} className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700">📄 Generate PDF Report</button>
              <button onClick={downloadZip} className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700">📦 Download Full Package (ZIP)</button>
            </>
          )}
          <button onClick={() => setShowAddFinding(true)} className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700">+ Add Finding</button>
        </div>
      </div>

      {findings.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500 text-sm">No findings yet. Click "+ Add Finding" to log findings from the MOR report.</div>
      ) : (
        <div className="space-y-3">
          {findings.map((finding: any) => (
            <div key={finding.id} className="bg-white rounded-lg shadow p-5">
              <div className="flex justify-between items-start mb-3">
                <select value={finding.status} onChange={(e: any) => updateFinding(finding.id, { status: e.target.value })} className={`text-xs px-2 py-1 rounded border ${finding.status === 'Submitted' ? 'bg-green-100 text-green-700 border-green-200' : finding.status === 'Ready' ? 'bg-blue-100 text-blue-700 border-blue-200' : finding.status === 'In Progress' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                  <option value="Open">Open</option>
                  <option value="In Progress">In Progress</option>
                  <option value="Ready">Ready</option>
                  <option value="Submitted">Submitted</option>
                </select>
                <button onClick={() => deleteFinding(finding.id)} className="text-red-400 hover:text-red-600 text-xs">Delete</button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-gray-500">Finding</label>
                  <textarea value={finding.finding} onChange={(e: any) => updateFinding(finding.id, { finding: e.target.value })} rows={2} className="w-full mt-1 border border-gray-200 rounded px-3 py-2 text-sm" />
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
                  <textarea value={finding.response || ''} onChange={(e: any) => updateFinding(finding.id, { response: e.target.value })} rows={3} placeholder="Type your response to this finding here..." className="w-full mt-1 border border-gray-200 rounded px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="text-xs text-gray-500">Supporting Document</label>
                  <div className="mt-1 flex items-center gap-2">
                    {finding.document_url ? (
                      <div className="flex items-center gap-2">
                        <a href={finding.document_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">📎 View Document</a>
                        <button onClick={() => updateFinding(finding.id, { document_url: null })} className="text-xs text-red-400 hover:text-red-600">Remove</button>
                      </div>
                    ) : (
                      <label className="cursor-pointer text-xs text-blue-600 hover:underline">
                        📎 Upload Supporting Document
                        <input type="file" className="hidden" onChange={async (e: any) => {
                          const file = e.target.files[0]
                          if (!file) return
                          const filePath = `${propertyId}/findings/${finding.id}/${file.name}`
                          const { error } = await supabase.storage.from('mor-documents').upload(filePath, file, { upsert: true })
                          if (!error) {
                            const { data: urlData } = supabase.storage.from('mor-documents').getPublicUrl(filePath)
                            await updateFinding(finding.id, { document_url: urlData.publicUrl })
                          }
                        }} />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
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
    </div>
  )
}
export default function PropertyPage() {
  const { id } = useParams()
  const [property, setProperty] = useState<any>(null)
  const [activeTab, setActiveTab] = useState('overview')
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>({})
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
    const { companies, created_at, ...updateData } = form
    await supabase.from('properties').update(updateData).eq('id', id)
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
        <button onClick={async () => { await supabase.auth.signOut(); window.location.href = '/' }} className="text-sm text-gray-500 hover:text-gray-700">
          Sign Out
        </button>
      </nav>

      <div className="bg-white border-b px-6">
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
                { label: 'MOR Date', field: 'mor_date', type: 'date' },
                { label: 'Report Received Date', field: 'report_received_date', type: 'date' },
                { label: 'Last MOR Date', field: 'last_mor_date', type: 'date' },
                { label: 'Last MOR Score', field: 'last_mor_score', type: 'text' },
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
            </div>

            <div className="mt-4">
              <label className="block text-xs text-gray-500 mb-1">HUD Communication Notes</label>
              {editing ? (
                <textarea value={form.hud_notes || ''} onChange={(e: any) => setForm({...form, hud_notes: e.target.value})} rows={3} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
              ) : (
                <p className="text-sm text-gray-800">{property.hud_notes || '—'}</p>
              )}
            </div>

            <div className="mt-4">
              <label className="block text-xs text-gray-500 mb-1">Last NSPIRE Notes</label>
              {editing ? (
                <textarea value={form.last_nspire_notes || ''} onChange={(e: any) => setForm({...form, last_nspire_notes: e.target.value})} rows={3} className="w-full border border-gray-300 rounded px-3 py-2 text-sm" />
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
          <TasksTab propertyId={id} />
        )}

        {activeTab === 'meetings' && (
          <MeetingsTab propertyId={id} />
        )}

        {activeTab === 'findings' && (
          <FindingsTab propertyId={id} reportDate={property.report_received_date} property={property} />
        )}
      </main>
    </div>
  )
}