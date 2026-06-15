import { useEffect, useState } from 'react'
import styles from './ConfirmDeleteModal.module.css'

const CONFIRM_WORD = '삭제'

export default function ConfirmDeleteModal({ open, title, description, confirming, onCancel, onConfirm }) {
  const [input, setInput] = useState('')

  useEffect(() => {
    if (open) setInput('')
  }, [open])

  if (!open) return null

  const canConfirm = input.trim() === CONFIRM_WORD && !confirming

  return (
    <div className={styles.overlay} onClick={onCancel} role="presentation">
      <div
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-delete-title"
        onClick={e => e.stopPropagation()}
      >
        <h2 id="confirm-delete-title" className={styles.title}>실적 삭제</h2>
        <p className={styles.warning}>삭제하면 복구할 수 없습니다.</p>
        {title && <p className={styles.task}>「{title}」</p>}
        {description && <p className={styles.desc}>{description}</p>}
        <label className={styles.label} htmlFor="confirm-delete-input">
          계속하려면 아래에 <strong>{CONFIRM_WORD}</strong>를 입력하세요
        </label>
        <input
          id="confirm-delete-input"
          className={styles.input}
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={CONFIRM_WORD}
          autoComplete="off"
          autoFocus
        />
        <div className={styles.actions}>
          <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={confirming}>
            취소
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={!canConfirm}
            style={{ opacity: canConfirm ? 1 : 0.45 }}
          >
            {confirming ? '삭제 중...' : '삭제하기'}
          </button>
        </div>
      </div>
    </div>
  )
}
