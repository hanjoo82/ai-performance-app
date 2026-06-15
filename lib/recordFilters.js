const MISSING_COLUMN = /deleted_at|column.*does not exist/i

export function isMissingDeletedAtColumn(error) {
  if (!error) return false
  const msg = [error.message, error.details, error.hint, error.code].filter(Boolean).join(' ')
  return MISSING_COLUMN.test(msg)
}

export function isActiveRecord(record) {
  return record?.deleted_at == null
}

export function filterActiveRecords(records) {
  return (records || []).filter(isActiveRecord)
}

export function filterDeletedRecords(records) {
  return (records || []).filter(r => r?.deleted_at != null)
}
