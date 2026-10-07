-- 4단계 준비: 기존 가상 메모의 소유자를 A로 맞추고, B 소유의 공개 가능한 시험 메모 한 건을 준비합니다.
-- Supabase 대시보드 > SQL Editor에 전체를 붙여 넣고 Run 한 번으로 실행합니다. 여러 번 실행해도 됩니다.
-- 바꿀 곳은 아래 DO 블록의 두 이메일뿐입니다. 실제 개인 메일이 아닌 테스트 계정이어야 합니다.
-- API·GRANT·RLS 정책은 바꾸지 않습니다.

do $$
declare
  a_mail constant text := 'test@example.com';      -- A 테스트 계정 이메일
  b_mail constant text := 'testb@example.com';     -- B 테스트 계정 이메일
  a_id uuid;
  b_id uuid;
begin
  select id into a_id from auth.users where email = lower(a_mail);
  select id into b_id from auth.users where email = lower(b_mail);
  if a_id is null then raise exception 'A 계정을 auth.users에서 찾지 못했습니다: %', a_mail; end if;
  if b_id is null then raise exception 'B 계정을 auth.users에서 찾지 못했습니다: %', b_mail; end if;
  if a_id = b_id then raise exception 'A와 B가 같은 계정입니다.'; end if;

  -- 2단계 가상 메모(vault_notes의 제목)와 같은 notes 행은 모두 A 소유로 맞춥니다.
  update public.notes n
     set owner_id = a_id, updated_at = now()
   where n.title in (select v.title from public.vault_notes v)
     and n.owner_id is distinct from a_id;

  -- B 소유의 공개 가능한 시험 메모 한 건. id를 고정해 4단계 시험에서 다시 씁니다.
  insert into public.notes (id, owner_id, title, body)
  values ('b0000000-0000-4000-8000-000000000001', b_id,
          'B 시험 메모', '4단계 소유자 검사용으로 만든 공개 가능한 시험 메모입니다.')
  on conflict (id) do update
     set owner_id = excluded.owner_id, title = excluded.title, body = excluded.body, updated_at = now();
end $$;

-- 확인용: 가상 메모 행의 owner_email은 A, 'B 시험 메모'는 B여야 합니다.
-- 마지막 열 check는 가상 메모가 모두 한 계정(A) 소유이고 B 메모와 소유자가 다르면 ok입니다.
select n.title,
       u.email as owner_email,
       n.owner_id,
       n.id,
       case
         when n.id = 'b0000000-0000-4000-8000-000000000001' then 'B 시험 메모'
         when n.title in (select title from public.vault_notes) then '가상 메모'
         else '그 밖의 메모'
       end as kind,
       case
         when (select count(distinct owner_id) from public.notes
                where title in (select title from public.vault_notes)) = 1
          and (select owner_id from public.notes
                where title in (select title from public.vault_notes) limit 1)
              <> (select owner_id from public.notes where id = 'b0000000-0000-4000-8000-000000000001')
         then 'ok' else '확인 필요'
       end as "check"
  from public.notes n
  left join auth.users u on u.id = n.owner_id
 order by kind, n.created_at;
