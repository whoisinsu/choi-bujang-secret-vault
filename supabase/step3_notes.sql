-- 3단계: 로그인 사용자별 가상 메모 테이블입니다.
-- Supabase 대시보드 > SQL Editor에 전체를 붙여 넣고 Run 한 번으로 실행합니다. 여러 번 실행해도 됩니다.
-- 실제 학생 자료, 비밀번호, 토큰, 키는 넣지 않습니다. 메모 문장은 2단계 vault_notes에서 그대로 복사합니다.

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null,  -- 서버가 확인한 로그인 사용자 ID. auth.users 외래키는 아직 걸지 않습니다.
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists notes_owner_id_idx on public.notes (owner_id);

-- RLS를 켜고 정책은 만들지 않습니다. anon·authenticated는 직접 읽거나 쓸 수 없고 서버 API만 씁니다.
alter table public.notes enable row level security;
revoke all on table public.notes from anon, authenticated;

-- 2단계 가상 메모 네 건을 A 계정(test@example.com) 소유로 복사합니다. 이미 있으면 건너뜁니다.
insert into public.notes (owner_id, title, body)
select a.id, v.title, v.content
from public.vault_notes v
cross join (select id from auth.users where email = 'test@example.com') a
where not exists (
  select 1 from public.notes n where n.owner_id = a.id and n.title = v.title
)
order by v.id;

-- 확인용: 결과 한 줄이 아래처럼 나와야 합니다.
-- id_type = uuid, owner_id_nullable = NO, rls_enabled = true,
-- anon_can_select = false, authenticated_can_select = false, a_note_count = 4
select
  (select data_type from information_schema.columns
    where table_schema = 'public' and table_name = 'notes' and column_name = 'id') as id_type,
  (select is_nullable from information_schema.columns
    where table_schema = 'public' and table_name = 'notes' and column_name = 'owner_id') as owner_id_nullable,
  (select relrowsecurity from pg_class where oid = 'public.notes'::regclass) as rls_enabled,
  has_table_privilege('anon', 'public.notes', 'select') as anon_can_select,
  has_table_privilege('authenticated', 'public.notes', 'select') as authenticated_can_select,
  (select count(*) from public.notes n join auth.users u on u.id = n.owner_id
    where u.email = 'test@example.com') as a_note_count;
