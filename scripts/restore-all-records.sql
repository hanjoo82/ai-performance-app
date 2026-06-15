-- Supabase SQL Editor에서 실행 — 삭제함에 들어간 실적 전체 복구
UPDATE records
SET deleted_at = NULL, deleted_by = NULL
WHERE deleted_at IS NOT NULL;

-- 복구 후 건수 확인
SELECT
  count(*) FILTER (WHERE deleted_at IS NULL) AS active_count,
  count(*) FILTER (WHERE deleted_at IS NOT NULL) AS deleted_count
FROM records;
