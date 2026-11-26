import { supabase } from './supabase'

// file_url on a binder `documents` row is a JSON array of URLs (or a legacy
// plain string). Keep this in sync with the helpers in the property page.
export const parseBinderUrls = (val: any): string[] => {
  if (!val) return []
  if (Array.isArray(val)) return val
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : [String(val)] } catch { return [String(val)] }
}
const serialize = (urls: string[]): string | null => (urls.length ? JSON.stringify(urls) : null)

export interface AddToBinderResult { matched: boolean; cardName: string }

// Upload a generated file (blob) to storage and attach it to the MOR binder:
// to the first checklist item whose name matches `match`, or a new custom item.
export async function addGeneratedToBinder(opts: {
  propertyId: string
  morId: string
  match: RegExp
  cardName: string          // name for a new card if none matches
  filename: string
  blob: Blob
}): Promise<AddToBinderResult> {
  const { propertyId, morId, match, cardName, filename, blob } = opts
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, '_')
  const path = `${propertyId}/binder/${morId}/${Date.now()}-${safe}`
  const up = await supabase.storage.from('mor-documents').upload(path, blob, { upsert: true })
  if (up.error) throw up.error
  const url = supabase.storage.from('mor-documents').getPublicUrl(path).data.publicUrl

  const { data: docs } = await supabase.from('documents').select('id,name,file_url').eq('mor_id', morId)
  const doc = (docs || []).find((d: any) => match.test(d.name || ''))
  if (doc) {
    const urls = parseBinderUrls(doc.file_url); urls.push(url)
    const { error } = await supabase.from('documents').update({ file_url: serialize(urls) }).eq('id', doc.id)
    if (error) throw error
    return { matched: true, cardName: doc.name }
  }
  // No matching card — create a custom one at the end of the list.
  const { data: last } = await supabase.from('documents').select('sort_order').eq('mor_id', morId).order('sort_order', { ascending: false }).limit(1).maybeSingle()
  const sort_order = ((last?.sort_order ?? 0) as number) + 1
  const { error } = await supabase.from('documents').insert([{
    property_id: propertyId, mor_id: morId, name: cardName, status: 'Not Started',
    is_required: true, is_custom: true, sort_order, file_url: serialize([url]),
  }])
  if (error) throw error
  return { matched: false, cardName }
}
