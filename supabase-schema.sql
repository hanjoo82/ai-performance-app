-- ============================================
-- AI 활용 성과 관리 앱 - Supabase 테이블 설정
-- Supabase > SQL Editor 에 붙여넣고 실행하세요
-- ============================================

-- 1. 유저 테이블
create table if not exists users (
  email       text primary key,
  name        text not null,
  dept        text not null,
  team        text not null,
  role        text not null,
  is_ceo      boolean default false,
  created_at  timestamptz default now()
);

-- 2. 실적 테이블
create table if not exists records (
  id          uuid primary key default gen_random_uuid(),
  email       text not null references users(email),
  user_name   text,
  user_dept   text,
  user_team   text,
  task        text not null,
  content     text not null,
  effect      text not null,
  tool        text not null,
  helper      text,
  helper_dept text,
  helper_team text,
  helper_role text,
  helper_name text,
  date        text,
  score       int default 0,
  feedback    text default '',
  work_area   text,
  automation_area text default '기타',
  likes       int default 0,
  liked_by    text[] default '{}',
  created_at  timestamptz default now()
);

-- 2-1. 실적별 피드백 대화 테이블
create table if not exists record_comments (
  id           uuid primary key default gen_random_uuid(),
  record_id    uuid not null references records(id) on delete cascade,
  author_email text not null,
  author_name  text,
  author_role  text not null check (author_role in ('submitter', 'evaluator')),
  message      text not null,
  created_at   timestamptz default now()
);

-- 3. RLS (Row Level Security) - 누구나 읽기 가능, 본인만 쓰기
alter table users enable row level security;
alter table records enable row level security;
alter table record_comments enable row level security;

-- 유저 테이블: 누구나 읽기 / 본인만 등록
create policy "users_select" on users for select using (true);
create policy "users_insert" on users for insert with check (true);

-- 실적 테이블: 누구나 읽기 / 누구나 등록 / 대표는 score/feedback 업데이트 / 삭제
create policy "records_select" on records for select using (true);
create policy "records_insert" on records for insert with check (true);
create policy "records_update" on records for update using (true);
create policy "records_delete" on records for delete using (true);

-- 기존 DB에 평가 분류 컬럼 추가 및 기본값 채우기
alter table records add column if not exists work_area text;
alter table records add column if not exists automation_area text default '기타';
alter table records alter column automation_area set default '기타';
update records set automation_area = '기타'
where automation_area is null or automation_area = '' or automation_area = '미분류';

-- 기존 work_category 값을 업무분야로 이관
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_name = 'records' and column_name = 'work_category'
  ) then
    execute $sql$
      update records
      set work_area = case work_category
        when '수입통관' then '수입'
        when '수출통관' then '수출'
        when '경영관리' then '경영지원'
        else work_category
      end
      where (work_area is null or work_area = '')
        and work_category is not null
        and work_category <> ''
    $sql$;
  end if;
end $$;

-- 피드백 대화: 읽기/등록 가능
create policy "record_comments_select" on record_comments for select using (true);
create policy "record_comments_insert" on record_comments for insert with check (true);

-- 4. 실적 첨부파일 메타데이터 (접근은 API + service role)
create table if not exists record_attachments (
  id           uuid primary key default gen_random_uuid(),
  record_id    uuid not null references records(id) on delete cascade,
  owner_email  text not null,
  file_name    text not null,
  storage_path text not null unique,
  mime_type    text,
  size_bytes   int,
  created_at   timestamptz default now()
);

alter table record_attachments enable row level security;

-- Storage: 비공개 버킷 record-attachments (scripts/setup-record-attachments.sql 참고)
