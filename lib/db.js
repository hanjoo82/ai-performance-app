import { supabase } from './supabase'

/* ---- 유저 ---- */
export async function getUsers() {
  const { data } = await supabase.from('users').select('*').order('name')
  return data || []
}

/* ---- 실적 ---- */
export async function addRecord(record) {
  const { data, error } = await supabase
    .from('records')
    .insert([{ ...record, score: 0, feedback: '', likes: 0, liked_by: [] }])
    .select()
    .single()
  if (error) throw error
  return data
}

export async function getRecords() {
  const { data, error } = await supabase
    .from('records')
    .select('*, users(name, dept, team, role)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getDeletedRecords() {
  const { data, error } = await supabase
    .from('records')
    .select('*, users(name, dept, team, role)')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getMyRecords(email) {
  const { data, error } = await supabase
    .from('records')
    .select('*')
    .eq('email', email)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function getRecordById(id) {
  const { data, error } = await supabase
    .from('records')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()
  if (error) throw error
  return data
}

export async function updateRecord(id, updates) {
  const { error } = await supabase.from('records').update(updates).eq('id', id)
  if (error) throw error
}

export async function softDeleteRecord(id, deletedBy) {
  const { error } = await supabase
    .from('records')
    .update({
      deleted_at: new Date().toISOString(),
      deleted_by: deletedBy || null,
    })
    .eq('id', id)
  if (error) throw error
}

export async function restoreRecord(id) {
  const { error } = await supabase
    .from('records')
    .update({ deleted_at: null, deleted_by: null })
    .eq('id', id)
  if (error) throw error
}

/** @deprecated softDeleteRecord 사용 */
export async function deleteRecord(id, deletedBy) {
  return softDeleteRecord(id, deletedBy)
}

/* ---- 피드백 대화 ---- */
export async function getCommentsByRecordIds(recordIds) {
  if (!recordIds || recordIds.length === 0) return []
  const { data, error } = await supabase
    .from('record_comments')
    .select('*')
    .in('record_id', recordIds)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data || []
}

export async function addRecordComment(comment) {
  const payload = {
    record_id: comment.record_id,
    author_email: comment.author_email,
    author_name: comment.author_name || null,
    author_role: comment.author_role,
    message: comment.message,
  }

  const { data, error } = await supabase
    .from('record_comments')
    .insert([payload])
    .select()
    .single()
  if (error) throw error
  return data
}
