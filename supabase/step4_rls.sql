-- 4단계: 학습 DB의 메모 테이블(public.notes)에 RLS와 최소 권한을 적용합니다. 다른 테이블은 건드리지 않습니다.
-- Supabase 대시보드 > SQL Editor에 전체를 붙여 넣고 검토한 뒤 Run 한 번으로 실행합니다. 여러 번 실행해도 됩니다.
-- 앱 API는 서버 전용 키(service_role)로 접속하고 그 안에서 owner_id를 대조하므로 이 SQL과 별개로 동작합니다.
-- 이 SQL은 Data API에 직접 접속하는 anon·authenticated 역할의 권한을 정합니다.

-- 1) 적용 전 권한을 기록합니다(이 실행 동안만 쓰는 임시 테이블).
drop table if exists pg_temp.notes_privileges_before;
create temporary table notes_privileges_before as
select r.role_name, p.privilege,
       has_table_privilege(r.role_name, 'public.notes', p.privilege) as has_privilege,
       exists (select 1 from information_schema.role_table_grants g
                where g.table_schema = 'public' and g.table_name = 'notes'
                  and g.grantee = r.role_name and g.privilege_type = p.privilege) as listed_grant
  from (values ('anon'), ('authenticated')) r(role_name)
 cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                    ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(privilege);

-- 2) 기존 권한을 모두 회수하고 authenticated에만 네 가지를 줍니다.
revoke all on table public.notes from public, anon, authenticated;
grant select, insert, update, delete on table public.notes to authenticated;

-- 3) RLS를 켜고, 네 동작 모두 auth.uid() = owner_id인 본인 행만 허용합니다.
alter table public.notes enable row level security;

drop policy if exists notes_select_own on public.notes;
drop policy if exists notes_insert_own on public.notes;
drop policy if exists notes_update_own on public.notes;
drop policy if exists notes_delete_own on public.notes;

create policy notes_select_own on public.notes
  for select to authenticated
  using ((select auth.uid()) = owner_id);                 -- 기존 행

create policy notes_insert_own on public.notes
  for insert to authenticated
  with check ((select auth.uid()) = owner_id);            -- 새 행

create policy notes_update_own on public.notes
  for update to authenticated
  using ((select auth.uid()) = owner_id)                  -- 기존 행
  with check ((select auth.uid()) = owner_id);            -- 새 행(소유자를 바꾸면 거부)

create policy notes_delete_own on public.notes
  for delete to authenticated
  using ((select auth.uid()) = owner_id);                 -- 기존 행

-- 4) 적용 전후 대조. ok 열이 모두 true여야 합니다.
--    기대: anon은 모든 권한 false, authenticated는 SELECT·INSERT·UPDATE·DELETE만 true.
--    마지막 줄(정책·RLS)은 rls_enabled = true, 정책 4개가 select·insert·update·delete 하나씩이면 ok입니다.
with after as (
  select r.role_name, p.privilege,
         has_table_privilege(r.role_name, 'public.notes', p.privilege) as has_privilege,
         exists (select 1 from information_schema.role_table_grants g
                  where g.table_schema = 'public' and g.table_name = 'notes'
                    and g.grantee = r.role_name and g.privilege_type = p.privilege) as listed_grant
    from (values ('anon'), ('authenticated')) r(role_name)
   cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                      ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(privilege)
), compared as (
  select a.role_name, a.privilege,
         b.has_privilege as before_has, b.listed_grant as before_listed,
         a.has_privilege as after_has, a.listed_grant as after_listed,
         (a.role_name = 'authenticated' and a.privilege in ('SELECT', 'INSERT', 'UPDATE', 'DELETE')) as expected
    from after a
    join notes_privileges_before b using (role_name, privilege)
)
select role_name, privilege, before_has, before_listed, after_has, after_listed, expected,
       (after_has = expected and after_listed = expected) as ok
  from compared
union all
select '정책·RLS',
       string_agg(policyname || ':' || lower(cmd), ', ' order by cmd),
       null, null,
       (select relrowsecurity from pg_class where oid = 'public.notes'::regclass), null, true,
       (select relrowsecurity from pg_class where oid = 'public.notes'::regclass)
         and count(*) = 4
         and bool_and(roles = '{authenticated}')
         and array_agg(lower(cmd) order by cmd) = array['delete', 'insert', 'select', 'update']
  from pg_policies
 where schemaname = 'public' and tablename = 'notes'
order by 1, 2;
