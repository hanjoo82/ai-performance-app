export const WORK_CATEGORIES = [
  '수입통관',
  '수출통관',
  'FTA',
  '환급',
  '요건',
  '경영관리',
  '기타',
]

export const WORK_CATEGORY_FILTER_ALL = 'all'
export const WORK_CATEGORY_FILTER_UNSET = 'unset'

export function isWorkCategory(value) {
  return WORK_CATEGORIES.includes(value)
}

export function workCategoryLabel(value) {
  if (!value) return '기타'
  return value
}

export function countByWorkCategory(records) {
  const counts = { [WORK_CATEGORY_FILTER_ALL]: records.length, [WORK_CATEGORY_FILTER_UNSET]: 0 }
  WORK_CATEGORIES.forEach(c => { counts[c] = 0 })
  for (const r of records) {
    if (!r.work_category) counts[WORK_CATEGORY_FILTER_UNSET] += 1
    else if (counts[r.work_category] != null) counts[r.work_category] += 1
  }
  return counts
}

export function filterByWorkCategory(records, filterKey) {
  if (!filterKey || filterKey === WORK_CATEGORY_FILTER_ALL) return records
  if (filterKey === WORK_CATEGORY_FILTER_UNSET) return records.filter(r => !r.work_category)
  return records.filter(r => r.work_category === filterKey)
}
