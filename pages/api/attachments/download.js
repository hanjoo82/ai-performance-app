import { assertRecordAttachmentAccess } from '../../../lib/attachmentAccess'
import { ATTACHMENT_BUCKET } from '../../../lib/attachmentConfig'
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin'

function isInlinePreviewable(fileName, mimeType) {
  const mime = (mimeType || '').toLowerCase()
  if (mime.startsWith('image/') || mime === 'application/pdf') return true
  return /\.(png|jpe?g|gif|webp|pdf)$/i.test(fileName || '')
}

function guessMimeType(fileName, mimeType) {
  if (mimeType) return mimeType
  const name = (fileName || '').toLowerCase()
  if (name.endsWith('.pdf')) return 'application/pdf'
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  if (name.endsWith('.gif')) return 'image/gif'
  if (name.endsWith('.webp')) return 'image/webp'
  return 'application/octet-stream'
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { id, email } = req.query
    if (!id || !email) {
      return res.status(400).json({ error: 'id, email이 필요합니다.' })
    }

    const admin = getSupabaseAdmin()
    const { data: attachment, error } = await admin
      .from('record_attachments')
      .select('id, record_id, file_name, mime_type, storage_path')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    if (!attachment) {
      return res.status(404).json({ error: '첨부파일을 찾을 수 없습니다.' })
    }

    await assertRecordAttachmentAccess(email, attachment.record_id)

    const mime = guessMimeType(attachment.file_name, attachment.mime_type)
    const inline = isInlinePreviewable(attachment.file_name, mime)

    // 이미지/PDF는 앱 내 미리보기용으로 인라인 스트리밍 (닫기 후 원래 화면 유지)
    if (inline) {
      const { data: fileData, error: downloadError } = await admin.storage
        .from(ATTACHMENT_BUCKET)
        .download(attachment.storage_path)

      if (downloadError) throw downloadError

      const buffer = Buffer.from(await fileData.arrayBuffer())
      const asciiName = (attachment.file_name || 'file').replace(/[^\x20-\x7E]/g, '_')
      res.setHeader('Content-Type', mime)
      res.setHeader('Content-Length', buffer.length)
      res.setHeader(
        'Content-Disposition',
        `inline; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(attachment.file_name || 'file')}`
      )
      res.setHeader('Cache-Control', 'private, max-age=60')
      return res.status(200).send(buffer)
    }

    const { data: signed, error: signError } = await admin.storage
      .from(ATTACHMENT_BUCKET)
      .createSignedUrl(attachment.storage_path, 120)

    if (signError) throw signError

    return res.redirect(302, signed.signedUrl)
  } catch (err) {
    console.error('attachment download error:', err)
    const status = err.status || 500
    return res.status(status).json({ error: err.message || '다운로드 실패' })
  }
}
