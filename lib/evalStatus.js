export function getEvalStatus(record, comments) {
  if ((record.score || 0) > 0) return 'finalized'
  if (!comments || comments.length === 0) return 'submitted'
  const last = comments[comments.length - 1]
  return last.author_role === 'evaluator' ? 'revision_requested' : 'resubmitted'
}

export const EVAL_STATUS_LABEL = {
  submitted: '제출',
  revision_requested: '보완 요청',
  resubmitted: '재검토요청',
  finalized: '평가완료',
}

export function canSubmitterReply(record, comments) {
  if ((record.score || 0) > 0) return false
  const last = comments?.[comments.length - 1]
  return last?.author_role === 'evaluator'
}

export function countRecordsByEvalStatus(records, commentsByRecord) {
  const counts = { submitted: 0, revision_requested: 0, resubmitted: 0, finalized: 0 }
  for (const record of records) {
    const status = getEvalStatus(record, commentsByRecord[record.id] || [])
    counts[status] += 1
  }
  return counts
}
