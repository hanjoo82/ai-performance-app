-- Supabase SQL Editor에서 실행 (기존 운영 DB)
-- 삭제 보관함(soft delete)용 컬럼 추가

alter table records add column if not exists deleted_at timestamptz;
alter table records add column if not exists deleted_by text;
