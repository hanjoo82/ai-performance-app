-- ============================================================
-- 운영 Supabase SQL Editor에 붙여넣고 Run (1회만)
-- Vercel(직원 앱)과 연결된 프로젝트에서 실행하세요
-- ============================================================

-- 1) 삭제함(soft delete) 컬럼 추가
alter table records add column if not exists deleted_at timestamptz;
alter table records add column if not exists deleted_by text;

-- 2) API 스키마 캐시 갱신 (컬럼 추가 직후 필수 — 안 하면 앱에서 deleted_at 없다고 나옴)
notify pgrst, 'reload schema';

-- 3) (선택) 삭제함에 들어간 실적이 있으면 전부 복구
update records
set deleted_at = null, deleted_by = null
where deleted_at is not null;
