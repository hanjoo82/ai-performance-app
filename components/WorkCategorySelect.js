import { WORK_CATEGORIES } from '../lib/workCategories'

export default function WorkCategorySelect({
  value,
  onChange,
  required = false,
  disabled = false,
  id,
  style,
}) {
  return (
    <select
      id={id}
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      required={required}
      style={style}
    >
      <option value="">{required ? '업무 구분 선택 *' : '업무 구분 (선택)'}</option>
      {WORK_CATEGORIES.map(c => (
        <option key={c} value={c}>{c}</option>
      ))}
    </select>
  )
}
