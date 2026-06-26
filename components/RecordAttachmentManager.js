import { useState } from 'react'
import RecordAttachments from './RecordAttachments'
import AttachmentUpload from './AttachmentUpload'
import { uploadPendingFiles, validatePendingFiles } from '../lib/attachments'

export default function RecordAttachmentManager({
  recordId,
  email,
  canView,
  canManage = false,
}) {
  const [existingCount, setExistingCount] = useState(0)
  const [pendingFiles, setPendingFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  async function handleUpload(e) {
    e?.stopPropagation?.()
    if (pendingFiles.length === 0) return
    const err = validatePendingFiles(pendingFiles, existingCount)
    if (err) { alert(err); return }
    setUploading(true)
    try {
      await uploadPendingFiles(recordId, email, pendingFiles)
      setPendingFiles([])
      setRefreshKey(k => k + 1)
    } catch (uploadErr) {
      alert(uploadErr?.message || '업로드 실패')
    } finally {
      setUploading(false)
    }
  }

  if (!canView) return null

  return (
    <div onClick={e => e.stopPropagation()}>
      <RecordAttachments
        key={refreshKey}
        recordId={recordId}
        email={email}
        canView
        canManage={canManage}
        onCountChange={setExistingCount}
      />
      {canManage && (
        <div style={{ marginTop: 8 }}>
          <AttachmentUpload
            files={pendingFiles}
            onChange={setPendingFiles}
            existingCount={existingCount}
            disabled={uploading}
          />
          {pendingFiles.length > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              style={{ marginTop: 8, padding: '8px 12px', fontSize: 13, width: '100%' }}
              onClick={handleUpload}
              disabled={uploading}
            >
              {uploading ? '업로드 중...' : <><i className="ti ti-upload" /> 첨부파일 업로드</>}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
