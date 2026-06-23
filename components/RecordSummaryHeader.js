export default function RecordSummaryHeader({
  userName,
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

  return (
    <div className="record-summary">
      <div className="record-summary-top">
        <span className="record-summary-meta">{userName} · {userTeam}</span>
        <i className={`ti ${isOpen ? 'ti-chevron-up' : 'ti-chevron-down'} record-summary-chevron`} />
      </div>
      <div className="record-summary-main">
        <div className="record-summary-task">{task}</div>
        {tool && <span className="tool-tag record-summary-tool">{tool}</span>}
      </div>
      <div className="record-summary-footer">
        <span className={`badge ${statusCls}`}>{statusLabel}</span>
        {workCategory && <span className="category-tag">{workCategory}</span>}
        {displayScore && (
          <span className="record-summary-score">{'★'.repeat(score)}</span>
        )}
      </div>
    </div>
  )
}
