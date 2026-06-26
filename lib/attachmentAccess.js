import { normalizeEmail } from './email'
import { isAdminUser } from './admin'
import { getSupabaseAdmin } from './supabaseAdmin'

export async function getUserByEmail(email) {
  const em = normalizeEmail(email)
  if (!em) return null

  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('users')
    .select('*')
    .ilike('email', em)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function getRecordById(recordId) {
  const admin = getSupabaseAdmin()
  const { data, error } = await admin
    .from('records')
    .select('id, email, score')
    .eq('id', recordId)
    .maybeSingle()

  if (error) throw error
  return data
}

/** 실적 삭제 권한 (본인·미평가 또는 관리자) */
export async function assertRecordDeleteAccess(email, recordId) {
  const user = await getUserByEmail(email)
  if (!user) {
    const err = new Error('등록되지 않은 사용자입니다.')
    err.status = 403
    throw err
  }

  const record = await getRecordById(recordId)
  if (!record) {
    const err = new Error('실적을 찾을 수 없습니다.')
    err.status = 404
    throw err
  }

  const isOwner = normalizeEmail(record.email) === normalizeEmail(email)
  const isAdmin = isAdminUser(user, email)

  if (isOwner && (record.score || 0) === 0) return { user, record }
  if (isAdmin) return { user, record }

  const err = new Error('삭제 권한이 없습니다.')
  err.status = 403
  throw err
}

/** 본인 실적 또는 평가자(관리자)만 접근 가능 */
export async function assertRecordAttachmentAccess(email, recordId) {
  const user = await getUserByEmail(email)
  if (!user) {
    const err = new Error('등록되지 않은 사용자입니다.')
    err.status = 403
    throw err
  }

  const record = await getRecordById(recordId)
  if (!record) {
    const err = new Error('실적을 찾을 수 없습니다.')
    err.status = 404
    throw err
  }

  const isOwner = normalizeEmail(record.email) === normalizeEmail(email)
  const isAdmin = isAdminUser(user, email)

  if (!isOwner && !isAdmin) {
    const err = new Error('첨부파일을 볼 권한이 없습니다.')
    err.status = 403
    throw err
  }

  return { user, record, isOwner, isAdmin }
}

/** 업로드/삭제는 본인만 (평가 완료 여부와 무관) */
export async function assertRecordAttachmentManage(email, recordId) {
  const access = await assertRecordAttachmentAccess(email, recordId)
  if (!access.isOwner) {
    const err = new Error('본인 실적에만 파일을 등록할 수 있습니다.')
    err.status = 403
    throw err
  }
  return access
}
