-- records 테이블에 업무 구분 컬럼 추가
-- Supabase SQL Editor에서 실행하세요

alter table records add column if not exists work_category text;
