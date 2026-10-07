-- 5단계: 학습용 메모 테이블(public.notes)의 PUBLIC·anon·authenticated 직접 권한을 모두 거둡니다.
-- 다른 테이블은 건드리지 않습니다. 메모 자료는 Vercel 서버 함수(서버 전용 키)로만 읽고 고칩니다.
-- Supabase 대시보드 > SQL Editor 새 탭에 전체를 붙여 넣고 검토한 뒤 Run 한 번으로 실행합니다. 여러 번 실행해도 됩니다.
-- 4단계 RLS와 정책 네 개는 그대로 둡니다. 권한이 없으면 정책에 닿기 전에 거부됩니다.

-- 1) 적용 전 권한을 기록합니다(이 실행 동안만 쓰는 임시 테이블).
drop table if exists pg_temp.notes_privileges_before;
create temporary table notes_privileges_before as
select r.role_name, p.privilege,
       case when r.role_name = 'PUBLIC'
            then exists (select 1 from information_schema.role_table_grants g
                          where g.table_schema = 'public' and g.table_name = 'notes'
                            and g.grantee = 'PUBLIC' and g.privilege_type = p.privilege)
            else has_table_privilege(r.role_name, 'public.notes', p.privilege) end as has_privilege,
       exists (select 1 from information_schema.role_table_grants g
                where g.table_schema = 'public' and g.table_name = 'notes'
                  and g.grantee = r.role_name and g.privilege_type = p.privilege) as listed_grant
  from (values ('PUBLIC'), ('anon'), ('authenticated')) r(role_name)
 cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                    ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(privilege);

-- 2) 직접 권한을 모두 거둡니다. RLS는 켠 채로 둡니다.
revoke all on table public.notes from public, anon, authenticated;
alter table public.notes enable row level security;

-- 3) 적용 전후 대조. ok 열이 모두 true여야 합니다(세 역할 모두 after_has = false, after_listed = false).
--    마지막 줄은 RLS가 켜져 있고 서버 전용 역할(service_role)이 여전히 네 가지 권한을 갖는지 봅니다.
with after as (
  select r.role_name, p.privilege,
         case when r.role_name = 'PUBLIC'
              then exists (select 1 from information_schema.role_table_grants g
                            where g.table_schema = 'public' and g.table_name = 'notes'
                              and g.grantee = 'PUBLIC' and g.privilege_type = p.privilege)
              else has_table_privilege(r.role_name, 'public.notes', p.privilege) end as has_privilege,
         exists (select 1 from information_schema.role_table_grants g
                  where g.table_schema = 'public' and g.table_name = 'notes'
                    and g.grantee = r.role_name and g.privilege_type = p.privilege) as listed_grant
    from (values ('PUBLIC'), ('anon'), ('authenticated')) r(role_name)
   cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'),
                      ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) p(privilege)
)
select a.role_name, a.privilege,
       b.has_privilege as before_has, b.listed_grant as before_listed,
       a.has_privilege as after_has, a.listed_grant as after_listed,
       (not a.has_privilege and not a.listed_grant) as ok
  from after a
  join notes_privileges_before b using (role_name, privilege)
union all
select '서버·RLS',
       'rls=' || (select relrowsecurity from pg_class where oid = 'public.notes'::regclass)::text
         || ', service_role 읽기·쓰기=' || (
           has_table_privilege('service_role', 'public.notes', 'SELECT')
           and has_table_privilege('service_role', 'public.notes', 'INSERT')
           and has_table_privilege('service_role', 'public.notes', 'UPDATE')
           and has_table_privilege('service_role', 'public.notes', 'DELETE'))::text,
       null, null, null, null,
       (select relrowsecurity from pg_class where oid = 'public.notes'::regclass)
         and has_table_privilege('service_role', 'public.notes', 'SELECT')
         and has_table_privilege('service_role', 'public.notes', 'INSERT')
         and has_table_privilege('service_role', 'public.notes', 'UPDATE')
         and has_table_privilege('service_role', 'public.notes', 'DELETE')
order by 1, 2;
