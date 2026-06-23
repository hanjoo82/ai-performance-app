import { formatFileSize, isAllowedAttachment, MAX_ATTACHMENTS_PER_RECORD, MAX_ATTACHMENT_SIZE } from './attachmentConfig'

export async function listAttachments(recordId, email) {
  const res = await fetch('/api/attachments/list', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recordId, email }),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '첨부파일 목록 조회 실패')
  return data.attachments || []
}

export async function uploadAttachment(recordId, email, file) {
  const validation = isAllowedAttachment(file.name, file.type, file.size)
  if (!validation.ok) throw new Error(validation.reason)

  const formData = new FormData()
  formData.append('recordId', recordId)
  formData.append('email', email)
  formData.append('file', file)

  const res = await fetch('/api/attachments/upload', {
    method: 'POST',
    body: formData,
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '업로드 실패')
  return data.attachment
}

export async function deleteAttachment(attachmentId, email) {
  const res = await fetch(`/api/attachments/delete?id=${encodeURIComponent(attachmentId)}&email=${encodeURIComponent(email)}`, {
    method: 'DELETE',
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error || '삭제 실패')
}

export function attachmentDownloadUrl(attachmentId, email) {
  return `/api/attachments/download?id=${encodeURIComponent(attachmentId)}&email=${encodeURIComponent(email)}`
}

export async function uploadPendingFiles(recordId, email, files) {
  const uploaded = []
  for (const file of files) {
    const item = await uploadAttachment(recordId, email, file)
    uploaded.push(item)
  }
  return uploaded
}

export function validatePendingFiles(files, existingCount = 0) {
  if (files.length + existingCount > MAX_ATTACHMENTS_PER_RECORD) {
    return `첨부파일은 최대 ${MAX_ATTACHMENTS_PER_RECORD}개까지 등록할 수 있습니다.`
  }
  for (const file of files) {
    const result = isAllowedAttachment(file.name, file.type, file.size)
    if (!result.ok) return `${file.name}: ${result.reason}`
    if (file.size > MAX_ATTACHMENT_SIZE) {
      return `${file.name}: 파일 크기는 ${formatFileSize(MAX_ATTACHMENT_SIZE)} 이하여야 합니다.`
    }
  }
  return ''
}

export function isAttachmentApiUnavailable(message) {
  const msg = message || ''
  return msg.includes('SUPABASE_SERVICE_ROLE_KEY') || msg.includes('설정되지 않았습니다')
}

/** 실패해도 실적 삭제는 막지 않음 */
export async function cleanupAttachmentsForRecord(recordId, email) {
  try {
    const res = await fetch('/api/attachments/cleanup-record', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordId, email }),
    })
    const data = await res.json()
    if (!res.ok) {
      if (isAttachmentApiUnavailable(data.error)) return
      throw new Error(data.error || '첨부파일 정리 실패')
    }
  } catch (err) {
    if (isAttachmentApiUnavailable(err?.message)) return
    throw err
  }
}

export { formatFileSize, MAX_ATTACHMENTS_PER_RECORD, MAX_ATTACHMENT_SIZE }
