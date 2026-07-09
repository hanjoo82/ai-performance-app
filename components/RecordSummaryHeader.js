export default function RecordSummaryHeader({
  userName,
  userDept,
  userTeam,
  task,
  statusCls,
  statusLabel,
  tool,
  score,
  showScore = false,
  workCategory,
  isOpen,
}) {
  const displayScore = showScore && score > 0
  const metaParts = [userName, userDept, userTeam].filter(Boolean)

  return (
    <div className="record-summary">
      <div className="record-summary-layout">
        <div className="record-summary-content">
          <div className="record-summary-top">
            <span className="record-summary-meta">{metaParts.join(' · ')}</span>
          </div>
          <div className="record-summary-task">{task}</div>
          <div className="record-summary-footer">
            <span className={`badge ${statusCls}`}>{statusLabel}</span>
            {workCategory && <span className="category-tag">{workCategory}</span>}
            {displayScore && (
              <span className="record-summary-score">{'★'.repeat(score)}</span>
            )}
          </div>
        </div>
        <span className="record-summary-actions">
          {tool && <span className="tool-tag record-summary-tool">{tool}</span>}
          <i className={`ti ${isOpen ? 'ti-chevron-up' : 'ti-chevron-down'} record-summary-chevron`} />
        </span>
      </div>
    </div>
  )
}
