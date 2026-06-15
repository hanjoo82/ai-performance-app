import { supabase } from './supabase'
import {
  filterActiveRecords,
  filterDeletedRecords,
  isMissingDeletedAtColumn,
} from './recordFilters'

const RECORD_SELECT = '*, users(name, dept, team, role)'

async function fetchAllRecords(select = RECORD_SELECT) {
  const { data, error } = await supabase
    .from('records')
    .select(select)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

async function fetchActiveRecords(select = RECORD_SELECT) {
  const { data, error } = await supabase
    .from('records')
    .select(select)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (!error) return data || []

  if (isMissingDeletedAtColumn(error)) {
    return filterActiveRecords(await fetchAllRecords(select))
  }
  throw error
}

async function fetchDeletedRecords(select = RECORD_SELECT) {
  const { data, error } = await supabase
    .from('records')
    .select(select)
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  if (!error) return data || []

  if (isMissingDeletedAtColumn(error)) {
    return []
  }
  throw error
}

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
  return fetchActiveRecords()
}

export async function getDeletedRecords() {
  return fetchDeletedRecords()
}

export async function getMyRecords(email) {
  const { data, error } = await supabase
    .from('records')
    .select('*')
    .eq('email', email)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  if (!error) return data || []

  if (isMissingDeletedAtColumn(error)) {
    const { data: all, error: allError } = await supabase
      .from('records')
      .select('*')
      .eq('email', email)
      .order('created_at', { ascending: false })
    if (allError) throw allError
    return filterActiveRecords(all)
  }
  throw error
}

export async function getRecordById(id) {
  const { data, error } = await supabase
    .from('records')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle()

  if (!error && data) return data

  if (error && !isMissingDeletedAtColumn(error)) throw error

  const { data: fallback, error: fallbackError } = await supabase
    .from('records')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (fallbackError) throw fallbackError
  if (fallback && fallback.deleted_at != null) {
    const err = new Error('삭제된 실적입니다.')
    throw err
  }
  return fallback
}

export async function updateRecord(id, updates) {
  const { error } = await supabase.from('records').update(updates).eq('id', id)
  if (error) throw error
}

export async function softDeleteRecord(id, deletedBy) {
  const payload = {
    deleted_at: new Date().toISOString(),
    deleted_by: deletedBy || null,
  }
  const { error } = await supabase.from('records').update(payload).eq('id', id)
  if (error) throw error
}

export async function restoreRecord(id) {
  const { error } = await supabase
    .from('records')
    .update({ deleted_at: null, deleted_by: null })
    .eq('id', id)
  if (error) throw error
}

export async function restoreAllDeletedRecords() {
  const deleted = await fetchDeletedRecords('id, task, deleted_at')
  if (deleted.length === 0) return { restored: 0 }

  const { error } = await supabase
    .from('records')
    .update({ deleted_at: null, deleted_by: null })
    .not('deleted_at', 'is', null)

  if (error) throw error
  return { restored: deleted.length }
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
