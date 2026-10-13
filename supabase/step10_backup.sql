-- 10단계: 비공개 가상 메모 사본(notes_backup)과 복원 감사 기록(restore_audit)을 만듭니다.
-- Supabase 대시보드 > SQL Editor에 전체를 붙여 넣고 Run 한 번으로 실행합니다. 여러 번 실행해도 됩니다.
-- 바꿀 곳은 아래 DO 블록의 B 이메일뿐입니다. 실제 개인 메일이 아닌 테스트 계정이어야 합니다.
-- notes 테이블·기존 정책·다른 메모는 바꾸지 않습니다.
--
-- 사본 값은 침해 전에 검증한 4단계 커밋(0ae3c0a)의 supabase/step4_owners.sql에 고정된
-- "공개 가능한 B 시험 메모"입니다. 지금 DB의 notes 값은 침해로 바뀌었을 수 있어 사본으로 쓰지 않습니다.
-- 내용 해시 = sha256( sha256(title) 16진수 || sha256(body) 16진수 ) 16진수 (src/restore-api.mjs와 같음)

create table if not exists public.notes_backup (
  id uuid primary key,
  owner_id uuid not null,
  title text not null check (char_length(title) between 1 and 200),
  body text not null check (char_length(body) <= 5000),
  content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
  source text not null,
  backed_up_at timestamptz not null default now()
);

create table if not exists public.restore_audit (
  seq bigint generated always as identity primary key,
  at timestamptz not null default now(),
  note_id uuid not null,
  owner_id uuid not null,
  result text not null,
  before_sha256 text,
  after_sha256 text
);

-- 비공개: RLS를 켜고 PUBLIC·anon·authenticated의 직접 권한을 모두 거둡니다. 서버 전용 키(service_role)만 씁니다.
alter table public.notes_backup enable row level security;
alter table public.restore_audit enable row level security;
revoke all on public.notes_backup from public, anon, authenticated;
revoke all on public.restore_audit from public, anon, authenticated;

-- 감사 기록 보존: 덧붙이기만 허용하고 수정·삭제·비우기는 누구도(서버 키 포함) 못 하게 막습니다.
create or replace function public.restore_audit_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'restore_audit는 덧붙이기만 허용합니다.';
end $$;
drop trigger if exists restore_audit_no_change on public.restore_audit;
create trigger restore_audit_no_change before update or delete on public.restore_audit
  for each row execute function public.restore_audit_append_only();
drop trigger if exists restore_audit_no_truncate on public.restore_audit;
create trigger restore_audit_no_truncate before truncate on public.restore_audit
  for each statement execute function public.restore_audit_append_only();

do $$
declare
  b_mail constant text := 'testb@example.com';     -- B 테스트 계정 이메일
  b_id uuid;
  b_title constant text := 'B 시험 메모';
  b_body constant text := '4단계 소유자 검사용으로 만든 공개 가능한 시험 메모입니다.';
  expected constant text := '019f5e7db1af7fdb409fdb465910b6e71733fb8b72bd9a5b497241ef4efdbe86';
  computed text;
begin
  select id into b_id from auth.users where email = lower(b_mail);
  if b_id is null then raise exception 'B 계정을 auth.users에서 찾지 못했습니다: %', b_mail; end if;
  computed := encode(sha256(convert_to(
    encode(sha256(convert_to(b_title, 'UTF8')), 'hex') || encode(sha256(convert_to(b_body, 'UTF8')), 'hex'),
    'UTF8')), 'hex');
  if computed <> expected then raise exception '사본 내용 해시가 검증값과 다릅니다.'; end if;
  -- 이미 있는 검증 사본은 덮어쓰지 않습니다.
  insert into public.notes_backup (id, owner_id, title, body, content_sha256, source)
  values ('b0000000-0000-4000-8000-000000000001', b_id, b_title, b_body, computed,
          'step4_owners.sql@0ae3c0a')
  on conflict (id) do nothing;
end $$;

-- 확인(본문은 출력하지 않음): 사본 한 건, 해시 일치, 직접 권한 없음, 감사 트리거 두 개
select b.id, b.source, b.content_sha256 = encode(sha256(convert_to(
         encode(sha256(convert_to(b.title, 'UTF8')), 'hex') || encode(sha256(convert_to(b.body, 'UTF8')), 'hex'),
         'UTF8')), 'hex') as hash_ok,
       has_table_privilege('anon', 'public.notes_backup', 'select') as anon_can_read_backup,
       has_table_privilege('authenticated', 'public.notes_backup', 'select') as auth_can_read_backup,
       has_table_privilege('authenticated', 'public.restore_audit', 'insert') as auth_can_write_audit,
       (select count(*) from pg_trigger where tgrelid = 'public.restore_audit'::regclass and not tgisinternal) as audit_triggers
  from public.notes_backup b;
