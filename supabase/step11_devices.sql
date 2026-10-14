-- 11단계: 기기 승인 기록(device_registrations)을 만듭니다.
-- Supabase 대시보드 > SQL Editor에 전체를 붙여 넣고 Run 한 번으로 실행합니다. 여러 번 실행해도 됩니다.
-- 메모(notes)·사본·감사 기록·기존 정책은 바꾸지 않습니다.
--
-- 브라우저는 공개키만 보내 승인을 "요청"할 수 있고(status = pending), 승인 자체는 할 수 없습니다.
-- 승인은 학생이 이 SQL Editor에서 아래 "승인하기" 문장으로 기기 ID를 확인한 뒤 직접 합니다.

create table if not exists public.device_registrations (
  device_id text primary key check (device_id ~ '^[0-9a-f]{16}$'),
  owner_id uuid not null,
  public_key jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'revoked')),
  requested_at timestamptz not null default now(),
  approved_at timestamptz
);

-- 비공개: RLS를 켜고 PUBLIC·anon·authenticated의 직접 권한을 모두 거둡니다. 서버 전용 키만 씁니다.
alter table public.device_registrations enable row level security;
revoke all on public.device_registrations from public, anon, authenticated;

-- 확인(공개키는 출력하지 않음)
select device_id, status, requested_at, approved_at,
       has_table_privilege('anon', 'public.device_registrations', 'select') as anon_can_read,
       has_table_privilege('authenticated', 'public.device_registrations', 'update') as auth_can_update
  from public.device_registrations order by requested_at desc;

-- 승인하기(필요할 때만, 따로 실행): 화면에 보인 16자리 기기 ID와 내 테스트 계정 이메일을 넣습니다.
-- update public.device_registrations
--    set status = 'approved', approved_at = now()
--  where device_id = '<화면의 16자리 기기 ID>' and status = 'pending'
--    and owner_id = (select id from auth.users where email = 'test@example.com')
-- returning device_id, status, approved_at;
