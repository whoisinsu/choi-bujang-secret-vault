# BYTE BACK 방어전 시작 틀 R5

이 저장소는 1단계에서 학생 본인이 GitHub 저장소와 Vercel 배포를 만드는 출발점입니다. 포함된 메모 네 건은 가상 자료입니다. 실제 학생 자료, 토큰, 비밀키를 넣지 마세요.

## 학생이 하는 일: 세 걸음

1. GitHub 계정을 만듭니다.
2. 방어전 1단계 카드의 **Deploy** 버튼을 누릅니다. Vercel에 GitHub로 로그인하고, 새 저장소가 **본인 계정의 Public 저장소**인지 확인한 뒤 Deploy를 누릅니다.
3. 배포가 끝나면 화면에 나온 `https://…vercel.app` 주소를 방어전 1단계 카드에 붙여넣고 제출합니다. 저장소 주소나 설정 파일은 적지 않습니다.

배포가 끝나면 `/`에서 점령된 가상 자료실을 볼 수 있습니다. `/data.json`에는 같은 가상 메모가 공개됩니다. 이 공개 상태를 확인하는 것이 1단계의 출발점입니다. 1단계 접수와 심판 판정은 포털에서 확인합니다.

## 시작 틀의 자동 처리

`vercel.json`은 정적 결과물 `public`을 배포합니다. 빌드 명령 `npm run build`는 Vercel이 제공하는 GitHub 저장소 소유자·이름, 커밋 SHA, 배포 URL을 검증하고 `public/aleph.json`을 생성합니다. 이 값이 없으면 빌드가 실패하므로, 성공한 것처럼 빈 주소를 내보내지 않습니다. `aleph.json`의 내용만으로 저장소 소유권이나 방어 성공을 인정하지 않습니다. 심판이 공개 저장소의 실제 커밋과 배포된 자료를 따로 대조해야 합니다.

`aleph.config.json`의 `repoUrl`과 `publicAppUrl`은 이전 제출 묶음 방식의 자리표시자입니다. 1단계에서는 학생이 편집하지 않습니다. 2단계 이후 코딩 도구가 필요한 설정과 보호 기능을 단계별로 작성합니다. `npm run bundle`과 `bundle-notes.json`도 1단계의 세 걸음에는 포함되지 않습니다.

로컬에서 가상 화면만 확인할 때는 `npm run build -- --local`을 사용합니다. 로컬 실행은 Vercel 배포나 심판 접수를 증명하지 않습니다. 1단계 당시 `src/attack-check.mjs`는 실제 배포가 된 뒤 `/data.json`을 비로그인으로 요청해 공개 가상 메모의 확인 표시를 읽었습니다. 현재 단계의 점검은 아래 단계별 절을 보세요.

## 2단계: 자료를 코드 밖으로 옮김

- 가상 메모 네 건은 학습용 Supabase 테이블 `public.vault_notes`에 있습니다. RLS를 켰고 `anon`·`authenticated`에는 읽기 권한이 없습니다. 테이블을 만든 SQL은 메모 문장을 담고 있어 Git에서 제외했습니다.
- `public/data.json`은 지웠습니다. 배포의 `/data.json`은 404이고, 시작 틀 확인 표시 `SAMPLE_NOTE_1`도 정적 응답(`/data.json`, `/aleph.json`)에 남기지 않습니다. 저장소 루트의 `data.json`은 1단계 빌드용으로만 남아 있으며 메모는 없습니다(`"notes": []`).
- 화면(`/`)은 서버 함수 `GET /api/notes`(`api/notes.js`)를 불러 메모를 보여 줍니다. 함수는 Vercel 환경변수 `SUPABASE_URL`과 서버 전용 `SUPABASE_SECRET_KEY`를 읽습니다. 값은 Vercel의 비밀 입력란에만 넣고 코드·Git·응답·로그에 넣지 않습니다.
- 다시 확인하는 방법: 배포 뒤 시크릿 창에서 `/`에 카드 네 개가 보이고, `/data.json`은 404여야 합니다.
- 2단계 저장점: `aleph.config.json`은 `step: 2`, 실제 저장소 주소, 실제 배포 주소(`https://choi-bujang-secret-vault-blue-tau.vercel.app`)로 맞췄습니다. 로그인 발급자·허용 경로·원본 API 주소는 아직 구현하지 않아 비어 있습니다. 빌드(`npm run build`)는 2단계부터 `data.json`을 복사하지 않고, `public/data.json`이 있으면 멈춥니다. `public/aleph.json`에는 설정의 단계가 기록되고, `sampleMarker`는 1단계에서만 기록됩니다. 모든 응답에 `X-Content-Type-Options: nosniff` 헤더가 붙습니다(`vercel.json`).
- 제출 묶음: 커밋 뒤 `bundle-notes.json`(Git 제외)에 설명을 적고 `npm run bundle`을 실행합니다. 자기 점검(`src/attack-check.mjs`)은 비로그인으로 `/data.json`과 `/api/notes`를 요청해 메모 건수만 기록합니다. 심판 판정이 아닙니다.

**2단계 당시 남은 약점(3단계에서 로그인 검사로 막음):** `/api/notes`는 아직 로그인 검사가 없는 공개 주소였습니다. 누구나 이 주소를 직접 불러 가상 메모 네 건을 받을 수 있습니다. 키를 서버로 옮겼을 뿐 접근 제한은 아직 없으며, 3단계 로그인에서 막아야 합니다. 이전 공개 커밋과 배포 이력에 남은 메모도 지워지지 않았습니다.

### 가상 메모 문장 검색 절차

저장소 폴더의 Git Bash에서 실행합니다. 로그인 정보나 키는 쓰지 않습니다. 검색식 `실습용 가상 [가-힣]+ 기록`은 가상 메모 본문 문장만 찾고, 이 README의 설명 글에는 걸리지 않습니다.

```bash
U=https://choi-bujang-secret-vault-blue-tau.vercel.app
Q='실습용 가상 [가-힣]+ 기록'
# 1) 현재 배포의 정적 파일: 각 줄이 0이어야 합니다.
for p in / /data.json /aleph.json; do echo "$p $(curl -s "$U$p" | grep -cE "$Q")"; done
# 1-1) 시작 틀 확인 표시: 각 줄이 0이어야 하고, /data.json은 404여야 합니다.
for p in / /data.json /aleph.json; do echo "$p $(curl -s -o /dev/null -w '%{http_code}' "$U$p") $(curl -s "$U$p" | grep -c 'SAMPLE_NOTE_1')"; done
# 2) GitHub 최신 파일: 아무것도 나오지 않아야 합니다.
git fetch origin && git grep -nE "$Q" origin/main
# 3) 자료 API를 로그인 없이: 3단계부터 0이어야 합니다(401 응답). 2단계 당시에는 4였습니다.
curl -s "$U/api/notes" | grep -oE "$Q" | wc -l
# 4) 옛 공개 커밋: 문장이 그대로 나옵니다. 과거 노출 기록입니다.
git grep -cE "$Q" 4f07b71
```

`/`는 화면 틀만 내려받으므로 0이 정상입니다. 화면의 카드 네 개는 브라우저가 `/api/notes`에서 받아 그린 것입니다. `supabase/step2_vault_notes.sql`은 Git에서 제외한 로컬 파일이라 2)의 검색 대상이 아닙니다.

### 2단계 확인 기록 (2026-10-07, 당시 커밋 `bdbe299`)

**정적 파일 검색 결과:** 현재 배포의 `/`, `/data.json`, `/aleph.json`에서 각각 0건, GitHub `origin/main`에서 0건입니다. 최신 정적 파일과 최신 GitHub 파일에는 가상 메모 문장이 없습니다.

**공개 API의 남은 약점:** `/api/notes`는 로그인 없이 200으로 응답하고 가상 메모 네 건(문장 4건)을 돌려줍니다. 자료가 정적 파일에서 서버 API로 옮겨졌을 뿐, 누구나 읽을 수 있는 상태는 그대로입니다.

**과거 노출은 해소되지 않았습니다:** 공개 저장소의 옛 커밋 `4f07b71`의 `data.json`·`public/data.json`에 문장이 남아 있고, 커밋 주소로 로그인 없이 받을 수 있습니다. 커밋 `c12b512` 이전에는 배포 주소의 `/data.json`이 메모를 공개했으므로 그사이 복사된 사본은 확인할 수 없습니다. 옛 개별 배포 주소는 지금 Vercel 로그인을 요구하지만 배포 자체는 남아 있습니다. 위 두 검색이 0건이어도 과거 노출이 사라졌다는 뜻이 아닙니다.

## 3단계: 진짜 로그인

- 로그인: 화면(`public/auth.js`)은 공식 `supabase-js`의 `signInWithPassword`·`signOut`으로 Supabase Auth 이메일·비밀번호 로그인과 로그아웃을 합니다. 실패하면 이유를 화면에 보여 줍니다. 3·4단계 당시 브라우저에는 공개용 Project URL과 publishable key만 있었습니다(5단계에서 서버 함수로 옮김).
- 서버 검사: 자료 API는 `Authorization: Bearer` 토큰을 시작 틀 `src/verify-login.mjs`로 검사합니다(`src/notes-api.mjs`). 토큰이 없거나 검사에 실패하면 자료 없이 401 `LOGIN_REQUIRED`입니다. 브라우저가 보낸 `userId`·`role`·`owner_id`는 쓰지 않습니다.
- 자료 API(`aleph.config.json`의 `allowedRoutes`와 같음):
  - `GET /api/notes`: 서버가 확인한 사용자의 메모 배열 `[{id,title,body}]`
  - `POST /api/notes`: `{id?,title,body}`, 서버가 확인한 사용자 ID를 `owner_id`로 저장하고 `201 {id}`. `id`가 없으면 서버가 UUID를 만들고, 같은 `id`는 409
  - `GET·PUT·DELETE /api/notes/:id`: 한 건 `{id,title,body}`, 수정, 삭제(204). 없는 메모와 지운 뒤 GET은 404
- 자료: `public.notes`(`supabase/step3_notes.sql`, RLS 켬, `anon`·`authenticated` 권한 없음). 2단계 가상 메모 네 건을 A 테스트 계정 소유로 복사했습니다. 2단계 `vault_notes` 테이블은 지우지 않았고 화면에서 더 쓰지 않습니다.
- 3단계 저장점: `aleph.config.json`은 `step: 3`, `identityProvider`(발급자 `https://skevbebxatwbmomeoqtx.supabase.co/auth/v1`, 대상 `authenticated`, 공개키 주소)와 `allowedRoutes` 다섯 개를 적었습니다. 원본 API 주소는 5단계라 비어 있습니다.
- 다시 확인하는 방법: 시크릿 창에서 로그인 없이 `/`를 열면 "로그인하면 자료가 보입니다."만 보이고, `curl -s -o /dev/null -w '%{http_code}' https://choi-bujang-secret-vault-blue-tau.vercel.app/api/notes`는 401입니다. A로 로그인하면 메모가 보이고 추가·수정·삭제가 됩니다. 로그아웃하면 다시 사라집니다.
- 제출 묶음: 커밋 뒤 `bundle-notes.json`(Git 제외)을 갱신하고 `npm run bundle`을 실행합니다. 자기 점검은 로그인 없는 요청과 위조 토큰 요청의 HTTP 상태만 기록합니다. 비밀번호를 점검 코드에 넣지 않으므로 A 로그인 뒤 동작은 미실행으로 남기고 화면에서 직접 확인합니다. 심판 판정이 아닙니다.

**3단계 당시 남은 약점(4단계에서 소유자 대조로 막음):** 한 건 조회·수정·삭제(`/api/notes/:id`)는 로그인만 확인하고 소유자(`owner_id`)를 대조하지 않았습니다. 로그인한 B가 A 메모의 `id`를 알면 읽고 고치고 지울 수 있습니다. 4단계에서 막고 기록합니다. 옛 공개 커밋과 옛 배포의 과거 노출도 그대로입니다.

## 4단계: 로그인해도 내 자료만

- 소유자 대조(`api/notes/[id].js`): 한 건 조회·수정·삭제는 `id`와 함께 `owner_id = 서버가 확인한 사용자 ID`인 행에만 적용합니다. 다른 사람의 메모는 없는 메모와 똑같이 404 `NOTE_NOT_FOUND`로 거부해 존재 여부도 알려 주지 않습니다. 수정은 기존 행이 본인 것일 때만 고치고 새 행의 `owner_id`도 본인인지 확인합니다. 본문에 다른 사람을 가리키는 `owner_id`·`ownerId`·`owner`·`userId`·`user_id`가 있으면 403 `OWNER_CHANGE_FORBIDDEN`입니다.
- 목록(`GET /api/notes`)은 본인 메모만, 추가(`POST`)는 본문과 상관없이 확인된 ID로 저장합니다. 응답 `{id,title,body}`와 수정 본문 `{title,body}`는 그대로입니다. `allowedRoutes` 다섯 개도 그대로입니다.
- 시험 자료(`supabase/step4_owners.sql`): 가상 메모 네 건을 A 테스트 계정 소유로 맞추고, B 테스트 계정 소유의 공개 가능한 시험 메모 한 건(`b0000000-0000-4000-8000-000000000001`)을 만듭니다. 이메일로 `auth.users`에서 ID를 찾습니다.
- DB 권한(`supabase/step4_rls.sql`, `public.notes`만): `PUBLIC`·`anon`·`authenticated` 권한을 모두 회수한 뒤 `authenticated`에 SELECT·INSERT·UPDATE·DELETE만 줍니다. RLS 정책 네 개가 모두 `(select auth.uid()) = owner_id`일 때만 허용합니다(SELECT·DELETE는 기존 행 USING, INSERT는 새 행 WITH CHECK, UPDATE는 둘 다). 실행 결과의 적용 전후 대조표(`has_table_privilege`·`role_table_grants`)에서 `anon`은 권한 없음, `authenticated`는 네 가지만 남은 것을 확인했습니다. 앱 서버는 서버 전용 키로 접속하므로 소유자 대조는 API가 맡습니다.
- 4단계 저장점: `aleph.config.json`은 `step: 4`입니다. 원본 API 주소는 5단계라 비어 있습니다.
- 다시 확인하는 방법: A로 로그인하면 가상 메모 네 건만, B로 로그인하면 B 시험 메모만 보이고 각자 추가·수정·삭제가 됩니다. B로 로그인한 브라우저에서 A 메모 id로 `GET·PUT·DELETE /api/notes/:id`를 보내면 모두 404이고 A 메모는 그대로입니다. 공개용 anon 키로 `https://skevbebxatwbmomeoqtx.supabase.co/rest/v1/notes`에 직접 읽기·쓰기를 보내면 401 `permission denied`입니다.
- 제출 묶음: 자기 점검은 로그인 없는 요청·위조 토큰·anon 키 Data API 직접 요청의 결과만 기록합니다. 로그인 토큰을 점검 코드에 넣지 않으므로 B의 A 메모 접근은 자동 점검에서 미실행으로 남기고, 브라우저에서 직접 확인한 결과는 설명에 적습니다. 심판 판정이 아닙니다.

**남은 점:** `POST /api/notes`에 다른 사람 메모의 `id`를 넣으면 409로 그 id가 있다는 사실은 알 수 있습니다(내용은 나가지 않음). `authenticated` 역할로 Data API에 직접 접근하는 경로는 RLS로 본인 행만 허용했습니다(5단계에서 직접 권한을 거둠). 옛 공개 커밋과 옛 배포의 과거 노출도 그대로입니다.

## 5단계: 자료 요청을 서버 한곳으로

- 브라우저 코드(`public/auth.js`)에는 Supabase 주소·키·SDK가 없습니다. 메모 읽기·추가·수정·삭제는 Vercel 서버 함수 `/api/notes`, `/api/notes/:id`를, 로그인·토큰 갱신·로그아웃은 서버 함수 `POST /api/auth/login`(`{email,password}`), `POST /api/auth/refresh`(`{refresh_token}`), `POST /api/auth/logout`(Bearer)을 부릅니다. 서버(`src/auth-proxy.mjs`)가 Vercel 환경변수 `SUPABASE_PUBLISHABLE_KEY`로 Supabase Auth에 대신 요청하고, 토큰·만료 시각·이메일만 돌려줍니다. 비밀번호와 토큰은 저장하거나 로그에 남기지 않으며, 서버 전용 secret key는 Auth 호출에 쓰지 않습니다. 5단계 당시 브라우저는 세션을 `localStorage`의 `vault-session`에 두고 만료 60초 전이나 401 때 한 번 갱신합니다. (11단계 `f852d5b`부터 세션은 화면 메모리에만 두고 브라우저 저장소에 저장하지 않습니다.)
- `/aleph.json`에는 3단계부터 `aleph.config.json`의 `allowedRoutes`가 함께 기록됩니다(`scripts/deployment-identity.mjs`).
- DB 권한(`supabase/step5_revoke.sql`, `public.notes`만): `PUBLIC`·`anon`·`authenticated`의 직접 권한을 모두 거뒀습니다. RLS와 4단계 정책은 켠 채로 둡니다. 실행 결과의 적용 전후 대조표에서 `authenticated`의 SELECT·INSERT·UPDATE·DELETE가 사라지고 세 역할 모두 권한이 없으며, 서버 전용 역할(service_role)은 읽기·쓰기를 유지하는 것을 확인했습니다.
- 서버 함수의 로그인 검사(`src/verify-login.mjs`)와 소유자 대조, 서버 전용 환경변수는 그대로입니다.
- 원본 자료 경로: `aleph.config.json`의 `originalApiUrl`은 `https://skevbebxatwbmomeoqtx.supabase.co/rest/v1/notes`입니다. 공개용 anon 키로 이 경로에 읽기·쓰기를 보내면 401 `permission denied`입니다.
- 5단계 저장점: `aleph.config.json`은 `step: 5`입니다.
- 다시 확인하는 방법: A로 로그인한 브라우저 Console에서 `/api/notes` 목록 GET, POST, `/api/notes/:id` GET·PUT·DELETE, 지운 뒤 GET을 보내면 200·201·200·200·204·404입니다(권한 회수 전후 모두 확인). 화면의 A·B 동작도 4단계와 같습니다.
- 제출 묶음: 자기 점검은 로그인 없는 요청·위조 토큰·anon 키로 `originalApiUrl`에 보낸 직접 요청의 결과만 기록합니다. 로그인 토큰을 점검 코드에 넣지 않으므로 B의 A 메모 접근은 자동 점검에서 미실행으로 남깁니다. 심판 판정이 아닙니다.

**남은 점:** 로그인이 서버 함수를 거치므로 Supabase Auth의 요청 한도가 Vercel 서버 주소 기준으로 함께 적용됩니다. `POST /api/notes`에 다른 사람 메모의 `id`를 넣으면 409로 그 id가 있다는 사실은 알 수 있습니다. 2단계 `vault_notes` 테이블은 화면에서 쓰지 않지만 남아 있습니다(`anon`·`authenticated` 권한 회수, `PUBLIC` 회수는 하지 않음). 옛 공개 커밋과 옛 배포의 과거 노출도 그대로입니다.

## 6단계: 등록한 기기만 자료실에 들어옵니다

- 판정기(`src/decider.mjs`)에 규칙 `device_registered`를 넣었습니다. 요청 계약(`docs/DECIDER_REQUEST.md`)의 `request.deviceRegistered`만 봅니다. 값이 정확히 `true`가 아니면(`false`, 값 없음, 문자열 `"true"` 등) `deny`·`device_not_registered`, 등록 기기의 읽기(`GET`)는 `allow`·`approved`입니다. 등록 기기의 쓰기 요청은 아직 규칙이 없어 시작 틀 `starter.deny`(`starter_not_ready`)로 거부됩니다.
- `RULE_IDS`는 실제로 쓰는 `starter.deny`, `device_registered` 두 개입니다. 계약에 없는 `request.device`·`request.identity`·`request.geo`·`request.role`은 쓰지 않습니다.
- 기기 인증서(mTLS) 검사와 사용자 토큰·기기 대조는 반 엔진·릴레이가 판정기보다 먼저 합니다. 이번 과정에는 따로 설치할 접속 프로그램이 없고, 인증서·CA·서명 키를 만들거나 저장소에 넣지 않았습니다. 미등록 기기로 실제 접속하는 공격은 심판이 맡습니다.
- 자료실 주소·화면·서버 함수·`allowedRoutes`는 5단계 그대로입니다.

### 확인 순서

1. 저장소 폴더 터미널에서 `npm run decider:test`를 실행합니다.
2. `통과 · 등록 기기의 정상 요청`이 나오는지 봅니다(등록 기기 GET → `allow`).
3. `통과 · 미등록 기기의 가상 요청`이 나오는지 봅니다(`deviceRegistered: false` → `deny`·`device_not_registered`. 다른 결과면 `확인 필요`로 나오고 종료 코드가 1입니다).
4. 마지막 줄 "이 명령은 가상 요청으로 연습하며 심판 통과 증거가 아닙니다."를 확인합니다. 이 결과는 로컬 연습이며 심판 판정이 아닙니다.

- 6단계 저장점: `aleph.config.json`은 `step: 6`입니다. 자기 점검(`src/attack-check.mjs`)은 5단계 점검(로그인 없는 요청·위조 토큰·anon 키 원본 경로 직접 요청)에 더해, 판정기에 등록·미등록 가상 요청을 넣은 결과를 "심판 판정 아님"으로 기록합니다. 실제 미등록 기기 접속은 미실행입니다.

**6단계 당시 남은 점:** 판정기에는 쓰기 허용 규칙과 7단계 추가 확인이 없었습니다(7단계에서 `step_up_required` 추가). 허용 이유 코드 `approved`는 계약 예시를 따른 것이며, 운영 등록부의 허용 코드 목록은 저장소에 없어 대조하지 못했습니다.

## 7단계: 평소와 다른 접속은 다시 확인합니다

- 입력 검사(`readAccessContext`, `src/decider.mjs`): 계약의 `signals`·`recentEvents`·`stepUp`만 읽고 출처를 나눕니다. `signals.source`가 `judge_fixture`(엔진이 넘긴 심판 가상 사건)일 때만 지역·네트워크·시각을 읽고, `none`(현재 실제 경로)·그 밖의 출처·항목이 빠지거나 더해진 `signals`는 값을 모두 `null`(모름)로 둡니다. 모르는 값을 `local`·`usual` 같은 정상값으로 채우지 않고, 브라우저 헤더나 계약에 없는 `request.geo`·`request.headers`는 읽지 않습니다. 최근 사건은 계약 모양(최대 12건, `{kind, ageSeconds, count}`)일 때만, 재로그인은 `verified === true`이고 `authAgeSeconds`가 0~900초 정수일 때만 인정합니다.
- 규칙 `step_up_required`: 평소와 다른 시각(00~05시) + 처음 보는 네트워크(`usual`이 아님) + 최근 10분 사건 수 합계 10건 이상이 **모두** 맞고 재로그인이 확인되지 않으면 차단 대신 `step_up`·`step_up_required`입니다. 지역은 조건에 넣지 않아 지역 하나만으로는 막지 않습니다. 재로그인이 확인된 새 요청은 기존 규칙으로 넘어가 등록 기기의 GET이면 `allow`입니다.
- 판정 순서: `device_registered`(미등록이면 `deny`) → `step_up_required` → 등록 기기 GET `allow` → 그 밖은 `starter.deny`. `RULE_IDS`는 `starter.deny`, `device_registered`, `step_up_required`입니다.
- 재로그인 시각 계약: 판정 요청에 `stepUp` 값은 있지만, 같은 로그인으로 다시 로그인한 시각을 제공 엔진이 검증해 주는 연결은 이 환경에 없습니다. 자료 API(`api/notes`)는 판정기를 부르지 않으므로 실제 자료 차단과 재로그인 뒤 허용은 **미실행**이며, 가상 사건 규칙만 시험했습니다. 토큰 원문은 쓰거나 기록하지 않았습니다.

### 확인 순서

1. 저장소 폴더 터미널에서 `npm run decider:test`를 실행합니다. 네 줄(`등록 기기의 정상 요청`, `미등록 기기의 가상 요청`, `복합 이상 접속`, `다시 확인한 복합 이상 접속`)이 모두 `통과`여야 합니다.
2. `npm run fixture:7`을 실행합니다. `정상 사건: allow`, `복합 이상 사건: step_up`이어야 합니다.
3. 두 명령 모두 로컬 가상 요청 연습이며 심판 판정이 아닙니다.

- 7단계 저장점: `aleph.config.json`은 `step: 7`입니다. 자기 점검은 6단계 점검에 더해 복합 이상 사건(`step_up`), 지역만 바뀐 사건(`allow`), 재로그인 뒤 새 요청(`allow`)의 로컬 판정기 결과를 "심판 판정 아님"으로, 실제 재로그인 차단은 미실행으로 기록합니다. 자료실 주소·화면·서버 함수는 그대로입니다.

**남은 점:** 출처를 확인할 수 없는 신호는 "모름"으로 두므로 이 규칙에 걸리지 않습니다. 등록 기기의 쓰기 요청은 복합 사건이면 `step_up`, 재로그인 뒤에도 `starter.deny`로 거부됩니다. 허용 이유 코드 `approved`는 운영 등록부와 대조하지 못했습니다.

## 8단계: 자료마다 갈 수 있는 구역을 나눕니다

- 자원 ID(`src/resources.mjs`): 내 메모는 구역 `my_notes`(자원 ID `notes`, `notes/<id>`), 강사 공지는 구역 `class_notices`(`notices`, `notices/<id>`)입니다. 서버가 요청 메서드·경로로만 만들고, Vercel 주소(`/api/notes/…`)와 판정 계약의 경로(`/notes/…`)를 같은 자원으로 봅니다. 강사 공지는 자료·API가 없어 이름만 정했습니다. 화면 메뉴는 바꾸지 않았습니다.
- 판정기 구역 규칙(`src/decider.mjs`): 엔진이 준 `subjectId`·`deviceId`·`method`·`route`·`path`·`queryLength`만 씁니다. 순서는 `device_registered` → `route_exact` → 거부로 정한 경로 → 주체·기기·경로 표(`OWN_NOTE_PATHS`) → `step_up_required` → `zone_my_notes` 허용입니다.
  - `route_exact`: 경로 표에 없는 route, 경로에 묶은 service(내 메모 `notes`, 공지 `notices`)와 다른 요청, 메서드가 다른 요청, path가 route 모양과 정확히 맞지 않는 요청, 쿼리가 있는 요청, `:id` 자리에 `export` 같은 기능 이름이 온 요청, 주체가 없거나 기기 ID 형식이 틀린 요청은 `deny`·`starter_not_ready`입니다.
  - `zone_my_notes`: 자료 ID로 고른 `GET /notes/:id`, `PUT /notes/:id`만 `allow`입니다. 자료를 고르지 않는 목록 `GET /notes`는 어느 구역의 메모가 섞일지 판정기가 알 수 없어 `deny`입니다(화면의 목록 `/api/notes`는 판정기를 거치지 않고 서버 함수가 본인 메모만 돌려줌). 메모 소유자는 판정 요청에 없으므로 내 메모인지는 자료 API가 확인합니다. 여기에 더해 주체(`subjectId`)·기기(`deviceId`)·정확한 경로(`path`) 조합이 판정기의 자원 경로 표(`OWN_NOTE_PATHS`)에 있어야 하며, 없으면 추가 확인보다 먼저 `deny`·`starter_not_ready`입니다(다른 사용자의 메모 경로 거부). 표에는 엔진 연습 요청의 주체 `learner_fixture`·기기 `aaaaaaaaaaaaaaaa`·경로 `/notes/demo`만 있어, 운영 엔진을 연결하면 엔진이 준 실제 주체·메모 경로를 더해야 합니다.
  - `zone_class_notices`: `PUT /notices/:id`는 `deny`·`starter_not_ready`입니다. 계약에 역할이 없어 강사를 가릴 수 없으므로 누구의 공지 수정도 허용하지 않습니다.
  - 메모 추가·삭제는 아직 `starter.deny`입니다. `RULE_IDS`는 `starter.deny`, `device_registered`, `step_up_required`, `route_exact`, `zone_my_notes`, `zone_class_notices`입니다.
- 자료 API 확인(`src/notes-api.mjs`, 로그인 검사 뒤): 메모 API는 `my_notes` 구역의 다섯 경로만 받고 다른 구역은 403 `ZONE_FORBIDDEN`, 쿼리가 붙거나(Vercel이 덧붙이는 경로와 같은 `id` 하나만 예외) 주소의 `:id`와 받은 id가 다르면 404 `ROUTE_NOT_ALLOWED`, 본문에 `role`·`isInstructor`·`zone`·`scope` 등이 있으면 403 `ROLE_FIELD_REJECTED`입니다. 강사 권한은 검증된 로그인(student·judge)과 DB 어디에도 없어 공지 수정은 누구도 할 수 없습니다. 소유자는 4단계처럼 `owner_id`로 대조해 다른 사람 메모는 404 `NOTE_NOT_FOUND`입니다. 거부 사유는 코드와 경로 모양만 로그에 남깁니다.

### 확인 순서

1. `npm run decider:test` → 네 줄 모두 `통과`(이전 규칙 유지). 로컬 연습이며 심판 판정이 아닙니다.
2. 배포 뒤 A로 로그인한 화면에서 메모 목록·수정이 그대로 되는지 봅니다.
3. B로 로그인한 브라우저 Console에서 A 메모 id로 `GET`·`PUT`(본문에 `role: 'instructor'`)·`DELETE /api/notes/:id`를 보내면 404·403·404이고 A 메모는 그대로여야 합니다.

- 확인 기록: 가짜 로그인·가짜 DB를 붙여 메모 API 처리 함수를 직접 부른 로컬 실측에서 A 자기 메모 읽기·수정 200, B 목록 빈 배열, B의 A 메모 읽기·수정·삭제 404, 본문 role 403, 메모 API로 공지 수정 우회 403, 쿼리로 id·owner_id 지정 404였습니다. 배포 주소에서도 학생이 직접 확인했습니다(커밋 `0d792bd` 배포): A의 목록·추가·수정·삭제 정상, B 로그인 Console에서 A 메모에 GET·PUT·DELETE 404, role 포함 PUT 403, `?id=` 같은 id 404(소유자 대조), `?owner_id=` 404.
- 8단계 저장점: `aleph.config.json`은 `step: 8`, `allowedRoutes` 다섯 개는 그대로입니다. 자기 점검은 7단계 점검에 판정기 구역 규칙의 가상 요청 결과를 "심판 판정 아님"으로 더했습니다.

**심판 판정 기록:** 처음 제출에서 `S08_OTHER_ZONE_ALLOWED`(다른 구역 메모 조회 허용)가 나왔습니다. 판정기 경로를 `service`와 묶기, 주체·기기·경로 표, 거부 이유 코드를 `route_not_allowed`·`notice_write_forbidden`에서 `starter_not_ready`로 바꾸기는 점수를 바꾸지 못했고, 학생 허용 목록에서 자료를 고르지 않는 목록 조회 `GET /notes`를 뺀 커밋 `6b3ee68`로 통과했습니다. 앞의 세 변경은 판정을 해치지 않아 그대로 두었습니다. 그 사이 자료 API는 Vercel이 `/api/notes/:id` 주소에 `?id=`를 덧붙여 본인 수정까지 막혀, 경로와 같은 `id` 쿼리 하나만 허용하도록 고쳤습니다(`0d792bd`).

**남은 점:** 공지 경로 이름 `/notices`는 운영 등록부·엔진 경로와 대조하지 못했습니다. 공지 읽기 경로는 표에 없어 거부됩니다. B의 A 메모 접근은 자동 점검에서 미실행입니다(학생이 배포 주소에서 직접 확인).

## 9단계: 도플갱어를 찾고 권한을 거둡니다

- 입력 처리(`readDetectionEvents`, `src/detect.mjs`): 가상 사건에서 가명 사용자 `identity.sub`·요청 종류 `method`·시각 `at`만 읽고, 사건 계약(`docs/DETECT_EVENTS.md`)에 없는 기기 `deviceId`(16자리 16진수)·판정 `decision`(`allow`·`deny`·`step_up`)은 형식이 맞을 때만 읽고 아니면 `null`입니다. 가명 사용자가 없거나 이메일처럼 보이는 사건, 요청 종류·시각이 틀린 사건은 버리고 개수만 셉니다. 브라우저식 `userId`는 신원으로 쓰지 않으며, 메모 본문·토큰·실명은 복사·저장·출력하지 않습니다.
- 탐지 규칙 `detect(events)`: 같은 가명 사용자의 `GET`이 어느 10분 구간에서든 120건을 넘을 때만 `{ action: 'propose_revocation', reasonCode: 'burst_read', subject }`, 그 밖(정확히 120건, 다른 사용자끼리 합친 수, 10분 밖으로 흩어진 사건, GET이 아닌 요청)은 `{ action: 'observe' }`입니다. 지역·네트워크는 사건 계약에 없어 쓰지 않으므로 지역 하나로 확정하지 않습니다. 제작 요청은 "평소와 다른 네트워크 + 다량 조회" 조합이었지만 계약 사건에 네트워크가 없어 계약대로 다량 조회 규칙을 넣었고, 이 규칙으로 9단계 심판을 통과했습니다(조합 규칙으로 바꾸지 않음).
- 회수 제안(별도 결과) `proposeRevocation(events)`: 탐지된 10분 구간의 사건이 확인된 가상 기기 하나에서만 왔을 때 `{ action: 'propose_revocation', reasonCode: 'burst_read', subject, deviceId }`, 기기 값이 없거나 둘 이상이면 `null`입니다. `detect()`의 계약 결과와 판정기의 허용·거부 응답 형식은 바꾸지 않았고, 회수 API를 만들거나 기기 권한을 바꾸지 않았습니다.
- 실제 회수 집행과 첫 의심 요청부터 회수까지 걸린 시간은 운영 반 엔진·심판이 확인합니다. 이 저장소에는 사건 전달·회수 집행이 연결돼 있지 않으며, `npm run detect:test` 통과는 그 연결을 뜻하지 않습니다.

### 확인 순서

1. `npm run detect:test` → 여섯 줄 모두 `통과`(121건·200건은 회수 제안, 정상 30건·정확히 120건·다른 사용자 각 100건·흩어진 200건은 observe). 로컬 가상 사건 연습이며 심판 판정이 아닙니다.
2. `npm run decider:test` → 네 줄 모두 `통과`(판정기는 9단계에서 바꾸지 않음).

- 9단계 저장점: `aleph.config.json`은 `step: 9`입니다. `RULE_IDS`는 8단계와 같습니다. 자기 점검은 묶음 한도(20개)를 지키려고 로그인 없는 추가·수정·삭제 세 건과 anon 키 직접 요청 네 건을 각각 한 줄로 묶고, 탐지기 가상 사건 결과(폭주 121건 회수 제안, 120건·30건 observe, 기기 하나 대상 회수 제안)를 "심판 판정 아님"으로, 실제 회수는 미실행으로 기록합니다. 8단계 점검의 내 메모 경로는 판정기 표의 연습 경로 `/notes/demo`로 맞췄습니다.

**남은 점:** 계약 사건에는 기기 값이 없어 연습 사건의 회수 제안(`proposeRevocation`)은 `null`입니다. 회수된 신원·세션의 재요청이나 다른 자원 이동을 판정기에서 거부하려면 엔진이 회수 사건의 `recentEvents.kind` 이름을 계약으로 제공해야 해, 이번에는 넣지 않았습니다.

## 10단계: 백업에서 자료실을 되살립니다

- 정책 사본과 차이(`scripts/policy-diff.mjs`, `policy/baseline.json`): 침해 전에 심판을 통과한 9단계 저장점(`240d023`)의 정책 파일 12개(판정기·탐지기·로그인 검사·로그인 대행·자료 API·구역·`aleph.config.json`·`vercel.json`·DB 권한 SQL 두 개) SHA-256 지문을 사본으로 기록했습니다. `npm run policy:diff`는 사본 형식·전체 지문·기준 커밋·파일별 지문을 검증한 뒤 복원할 버전과 바뀐 파일·줄 수만 보여 주며, 사본이 없거나 검증에 실패하면 비교하지 않고 중단합니다.
- 정책 되돌리기(`npm run policy:restore`): 먼저 바뀔 파일만 보여 주고 아무것도 바꾸지 않습니다. `npm run policy:restore -- --confirm <버전>`으로 화면의 버전을 그대로 적어야 사본과 다른 정책 파일만 기준 커밋 내용으로 되돌립니다. 다른 파일·Git 이력·DB·배포는 건드리지 않고, `policy/restore-log.jsonl`에 시각·버전·파일별 복원 전후 지문을 한 줄씩 덧붙입니다(기존 줄은 그대로).
- 메모 한 건 복원 경로: 서비스 `notes`(자료실 Vercel 서버 함수), **`POST /api/restore`**(`api/restore.js` → `src/restore-api.mjs`), 본문 `{"id":"<메모 UUID>"}` 한 값만 받습니다.
  - 로그인 필수(토큰 없으면 401). 쿼리가 붙으면 404, 본문에 `id` 말고 다른 값(`owner_id` 등)이 있으면 400입니다.
  - 비공개 사본 `public.notes_backup`에서 `id`와 `owner_id = 검증된 사용자 ID`가 모두 맞는 한 건만 고릅니다. 남의 사본은 404 `BACKUP_NOT_FOUND`입니다.
  - 사본의 ID·소유자·내용 해시(`sha256(sha256(title) ‖ sha256(body))`)를 대조해 틀리면 409 `BACKUP_VERIFY_FAILED`, 같은 id가 다른 사람 소유로 있으면 덮어쓰지 않고 409 `RESTORE_OWNER_CONFLICT`입니다.
  - 변조된 메모는 내용만 되돌리고, 지워진 메모는 다시 만듭니다. 그 뒤 그 한 건을 다시 읽어 ID·소유자·내용 해시가 사본과 같은지 확인합니다. 응답은 `{id, restored: 'content'|'recreated', contentSha256}`이며 본문은 돌려주지 않습니다.
  - 다른 메모는 건드리지 않습니다. 감사 기록 `public.restore_audit`에 결과·복원 전후 해시를 덧붙이며(본문·토큰 없음), DB 트리거로 수정·삭제·비우기를 막아 덧붙이기만 됩니다.
  - 감사 이력·다른 서비스 규칙 보존: 보너스 xdr의 경보 처리 기록 `xdr/alerts.log`와 거부 규칙 `xdr/brute-force/deny-rules.json`·`xdr/web-injection/deny-rules.json`은 보너스 단계에서 `.gitignore`로 제외해 저장소에 없었습니다. 10단계부터 제외를 풀고 그대로 커밋해 보존합니다(문서용 주소·가상 계정만, 비밀값 검사 0건). 복원은 이 파일들을 바꾸지 않습니다.
  - 감사 기록 사본: DB의 `restore_audit`는 심판이 볼 수 없으므로, 학생이 SQL Editor에서 조회한 줄(`seq`·`at`·`result`·우리 테스트 B 여부)을 `policy/restore-audit.jsonl`에 덧붙이기만 하는 방식으로 남깁니다. 기존 줄은 지우거나 고치지 않습니다.
- 비공개 사본(`supabase/step10_backup.sql`, Supabase SQL Editor에서 학생이 직접 실행): `notes_backup`·`restore_audit`를 만들고 RLS를 켜며 `PUBLIC`·`anon`·`authenticated` 권한을 모두 거둡니다. 사본 값은 지금 DB가 아니라 침해 전 4단계 커밋(`0ae3c0a`)의 `step4_owners.sql`에 고정된 공개 가능한 B 시험 메모(`b0000000-0000-4000-8000-000000000001`)이며, 미리 계산한 내용 해시와 맞을 때만 넣고 이미 있는 사본은 덮어쓰지 않습니다.
- 10단계 저장점: `aleph.config.json`은 `step: 10`, `restoreRoute`는 `POST /api/restore`입니다. 처음에는 같은 경로를 `allowedRoutes`에도 더했지만, 재제출에서도 `S10_AUDIT_DROPPED`가 남고 심판 제출 뒤 `restore_audit`에 새 줄이 없어(1~4번은 학생 확인) "지정한 한 건 밖의 규칙 변경"으로 보고 `allowedRoutes`는 9단계와 같은 다섯 개로 되돌렸습니다. 판정기 `RULE_IDS`는 9단계와 같습니다. 자기 점검은 한도 20개를 지키려 7단계 가상 사건 세 줄을 한 줄로 묶고, 토큰 없는 `POST /api/restore`(실제 전송)·정책 사본 검증(`policy:diff` 실행 결과)·B 메모 복원(미실행)을 더했습니다. 정책 사본은 9단계 기준이라 `policy:diff`는 이번 저장점에서 바꾼 `aleph.config.json`을 차이로 보여 줍니다.

- 복구 경로 공개: 심판은 배포 주소의 `/aleph.json`을 읽는데, 빌드(`scripts/deployment-identity.mjs`)가 `restoreRoute`를 옮기지 않아 세 번의 제출 동안 심판 요청이 `/api/restore`에 한 번도 오지 않았습니다(Vercel 로그의 401은 모두 학생·자기 점검 요청과 시각이 맞음). 3단계 `allowedRoutes`·5단계 `originalApiUrl`처럼 10단계부터 `restoreRoute`(`METHOD /api/경로` 형식일 때만)를 `/aleph.json`에 공개하도록 고쳤습니다.

### 복구 뒤 1~9단계 다시 확인하는 순서

복구한 직후 아래 순서대로 다시 실행합니다. 결과 칸의 "실행"은 `npm run bundle`의 자기 점검이나 명령으로 실제로 보낸 결과만 뜻합니다. 로그인이 필요해 자기 점검(`src/attack-check.mjs`)이 실행하지 않은 항목은 **미실행(자동 점검)**으로 두고, 학생이 브라우저에서 직접 본 결과는 "학생 브라우저 직접 확인"으로 따로 적습니다. 비밀번호·토큰은 기록하지 않습니다. `U=https://choi-bujang-secret-vault-blue-tau.vercel.app`

**가. 복구가 됐는지 (자료와 정책)**

| 순서 | 실행 | 기대 | 복구 뒤 결과 |
|---|---|---|---|
| 가-1 | `npm run policy:diff` | "사본 검증 통과", 변경 범위가 있으면 `npm run policy:restore`로 확인 → `-- --confirm <버전>`, 다시 `policy:diff`가 "변경 범위: 없음" | 실행(2026-10-13 17:19 KST, B 복원 16:49 뒤, 커밋 `fb05ec5` 배포) — 사본 `policy@240d023` 검증 통과, 변경 범위 `aleph.config.json` 한 파일(+2 -2줄, 10단계 `step`·`restoreRoute`). 정책 파일을 되돌릴 대상은 아님 |
| 가-2 | `policy/restore-log.jsonl`을 연다 (정책을 되돌린 경우) | 이전 줄은 그대로, 이번 복원 한 줄이 끝에 추가 | 미실행(정책 파일을 되돌리지 않아 `policy/restore-log.jsonl`이 생기지 않음) |
| 가-3 | B 로그인 Console에서 `POST /api/restore` `{"id":"b0000000-0000-4000-8000-000000000001"}` | 변조 뒤 `200 restored: content`, 삭제 뒤 `200 restored: recreated`, `contentSha256`이 `019f5e7d…`(사본과 같음), 새로고침하면 "B 시험 메모" | 미실행(자동 점검, 로그인 필요) · 학생 브라우저 직접 확인: 변조 뒤(커밋 `4a0b23f` 배포, 학생 B 로그인) — `200 restored: content`, `contentSha256` `019f5e7d…be86`(사본과 같음), `auditSeq` 2. 삭제 뒤(커밋 `fb05ec5` 배포, 학생 B 로그인) — 화면에서 삭제한 뒤 `200 restored: recreated`, `contentSha256` `019f5e7d…be86`(사본과 같음), `auditSeq` 8 |
| 가-4 | 같은 요청을 A 로그인으로 | `404 BACKUP_NOT_FOUND`, A 메모 그대로 | 미실행(자동 점검, 로그인 필요) · 학생 브라우저 직접 확인: (학생 A 로그인) — 감사 기록 4번 `backup_not_found`로 거부 확인. A 메모 그대로인지는 기록하지 않음 |
| 가-5 | Supabase SQL Editor: `select result, before_sha256 is null as was_deleted, after_sha256 from public.restore_audit order by seq;` | 복원 시도마다 한 줄씩 늘고, 이전 줄은 그대로 | 미실행(자동 점검, 로그인 필요) · 학생 브라우저 직접 확인: — 1·2 `requested`→`restored_content`(B, 16:49 KST), 3·4 `requested`→`backup_not_found`(A, 16:50), 5·6 `requested`→`backup_not_found`(B가 아닌 소유자, 17:22:55), 7·8 `requested`→`recreated`(B, 17:31). 이전 줄은 그대로 남음 이 여덟 줄을 저장소 `policy/restore-audit.jsonl`에 그대로 옮겨 보존(사용자 ID·본문 없음) |

**나. 이전에 막던 요청이 다시 거부되는지 (금지 요청)**

| 순서 | 단계 | 실행 | 기대 | 복구 뒤 결과 |
|---|---|---|---|---|
| 나-1 | 1·2 | `for p in / /data.json /aleph.json; do echo "$p $(curl -s -o /dev/null -w '%{http_code}' "$U$p") $(curl -s "$U$p" \| grep -c SAMPLE_NOTE_1)"; done` | `/data.json` 404, 확인 표시 모두 0 | 실행(2026-10-13 17:19 KST, B 복원 16:49 뒤, 커밋 `fb05ec5` 배포) — `/` 200, `/data.json` 404, `/aleph.json` 200, 확인 표시 모두 0 |
| 나-2 | 2 | 2단계 절의 "가상 메모 문장 검색 절차" 1)~3) | 정적 파일·GitHub 최신 파일·비로그인 API 모두 0건 | 실행(2026-10-13 17:19 KST, B 복원 16:49 뒤, 커밋 `fb05ec5` 배포) — 정적 파일 세 곳 0건, GitHub `origin/main` 0개 파일, 비로그인 `/api/notes` 0건 |
| 나-3 | 3 | `curl -s -o /dev/null -w '%{http_code}' $U/api/notes` 와 `-H 'Authorization: Bearer aaaa.bbbb.cccc'` | 둘 다 401 | 실행(2026-10-13 17:19 KST, B 복원 16:49 뒤, 커밋 `fb05ec5` 배포) — 토큰 없음 401, 위조 토큰 401 |
| 나-4 | 3 | 토큰 없이 `POST /api/notes`, `PUT`·`DELETE /api/notes/<id>` | 모두 401 | 실행(2026-10-13 17:19 KST, B 복원 16:49 뒤, 커밋 `fb05ec5` 배포) — POST 401, PUT 401, DELETE 401 |
| 나-5 | 4·8 | B 로그인 Console에서 A 메모 id로 `GET`·`PUT`·`DELETE /api/notes/:id` (8단계 확인 순서의 코드) | 404·404·404, A 메모 그대로 | 미실행(자동 점검, 로그인 필요) · 학생 브라우저 직접 확인: (2026-10-13 KST, 커밋 `fb05ec5` 배포, 학생 B 로그인 Console, A 메모 `4db215ce…`가 있는 상태) — GET 404 `NOTE_NOT_FOUND`, PUT 404 `NOTE_NOT_FOUND`, DELETE 404 `NOTE_NOT_FOUND`. 앞서 17:25에 한 같은 시험은 대상 메모가 이미 지워진 뒤라 소유자 검사 증거로 쓰지 않음(아래 사고 기록) |
| 나-6 | 8 | 같은 Console에서 본문에 `role: 'instructor'`를 넣은 `PUT`, `GET /api/notes?owner_id=x` | 403 `ROLE_FIELD_REJECTED`, 404 `ROUTE_NOT_ALLOWED` | 미실행(자동 점검, 로그인 필요) · 학생 브라우저 직접 확인: (2026-10-13 KST, B 복원 16:49 뒤, 커밋 `fb05ec5` 배포, 학생 B 로그인 Console) — role 포함 PUT 403 `ROLE_FIELD_REJECTED`, `GET /api/notes?owner_id=x` 404(오류 코드 줄은 화면에서 잘려 기록하지 않음) |
| 나-7 | 5 | 공개 anon 키로 `originalApiUrl`에 SELECT·INSERT·UPDATE·DELETE | 모두 401(권한 없음) | 실행(2026-10-13 17:19 KST, B 복원 16:49 뒤, 커밋 `fb05ec5` 배포) — SELECT·INSERT·UPDATE·DELETE 모두 401 |
| 나-8 | 6~8 | `npm run decider:test`, `npm run fixture:7` | 네 줄 `통과`(미등록 기기 deny, 복합 이상 step_up), 정상 allow·복합 step_up | 실행(2026-10-13 17:19 KST, B 복원 16:49 뒤, 커밋 `fb05ec5` 배포) — `decider:test` 네 줄 통과, `fixture:7` 정상 allow·복합 step_up(로컬 가상 요청, 심판 판정 아님) |
| 나-9 | 9 | `npm run detect:test` | 여섯 줄 `통과`(121건·200건 회수 제안, 나머지 observe) | 실행(2026-10-13 17:19 KST, B 복원 16:49 뒤, 커밋 `fb05ec5` 배포) — `detect:test` 여섯 줄 통과(로컬 가상 사건, 심판 판정 아님) |
| 나-10 | 3~9 | `npm run bundle` (커밋 뒤, 나-3·4·7과 판정기·탐지기 가상 요청을 한 번에 실제로 보내 기록) | `artifacts/submission.json`의 각 `observed`가 위 기대와 같음 | 실행(2026-10-13 17:19 KST, B 복원 16:49 뒤, 커밋 `fb05ec5` 배포) — `npm run bundle` 직접 점검 20개 생성, 실제 전송 항목은 모두 401·404, 로그인이 필요한 `cross_user_note_access`·`restore_b_note`와 엔진 연결 항목은 미실행으로 기록 |

**다. 정상 요청이 유지되는지**

| 순서 | 실행 | 기대 | 복구 뒤 결과 |
|---|---|---|---|
| 다-1 | A 로그인 화면: 목록 → 추가 → 수정 → 삭제 | 네 건 보임, "메모를 추가/수정/삭제했습니다." | 미실행(자동 점검, 로그인 필요) · 학생 브라우저 직접 확인: (학생 A 로그인) — 메모 네 건 확인 뒤 `10단계 확인` 추가·수정·삭제, 학생이 1단계 완료로 보고 |
| 다-2 | B 로그인 화면: 목록 | 복원된 "B 시험 메모"만 보이고 A 메모는 안 보임 | 미실행(자동 점검, 로그인 필요) · 학생 브라우저 직접 확인: (학생 B 로그인) — "B 시험 메모"만 보이고 A 메모는 안 보임. 이어서 A로 다시 로그인해 "훈련 행정 자료"가 그대로 남아 있는 것도 확인 |

- 재시험 중 사고 기록: 17:22 KST에 B용 공격 시험 코드를 **A 로그인 상태**에서 실행해 A가 자기 메모 `4db215ce-f4bd-4cb7-9dd4-268eba2682ef`("훈련 행정 자료")를 읽고(200) "침입"으로 고친 뒤(200) 지웠습니다(204, Vercel 로그 확인). 본인 메모에 대한 정상 동작이며 role 포함 PUT 403·쿼리 404는 그때도 막혔습니다. 침해 전 원본 `vault_notes`에서 그 한 건만 원래 id와 A 소유로 SQL Editor에서 다시 넣었고(같은 id·제목이 있으면 넣지 않음), 다른 메모와 감사 기록은 건드리지 않았습니다.
- 판정기·탐지기 연습(나-8~10)은 로컬 가상 요청이며 심판 판정이 아닙니다. 실제 미등록 기기 접속·재로그인 차단·회수 집행은 이 저장소에 연결돼 있지 않아 이 순서에서도 미실행입니다.
- 제출 직전 로그인 없이 실행한 것(커밋 `8a7a02b` 배포, 위 표 나-1·3·4·7에 해당하지만 B 메모 복원 전이라 "복구 뒤 결과"로 적지 않음): 정적 파일 `/data.json` 404·확인 표시와 메모 문장 0, 토큰 없음·위조 토큰 401, 토큰 없는 POST·PUT·DELETE·복원 401, anon 키로 notes·notes_backup·restore_audit 직접 요청 401, `decider:test` 4건·`detect:test` 6건 통과.
- 심판 판정 기록: 10단계는 커밋 `7749f4b`로 **심판 통과**했습니다. 실제로 효과가 있었던 수정은 세 가지입니다. (1) 빌드가 `restoreRoute`를 `/aleph.json`에 옮기지 않아 심판이 복구 경로를 찾지 못함 → 10단계부터 공개(`fb05ec5`). (2) README 재시험 표의 "실행"이 자기 점검의 "미실행"과 어긋나 `S10_RETEST_MISSING` → 자기 점검이 실제로 보낸 것만 "실행"으로 적고 학생 직접 확인은 구분(`3d3dca0`). (3) 보너스에서 `.gitignore`로 뺀 감사 이력 `xdr/alerts.log`·거부 규칙 `deny-rules.json`이 저장소에 없어 `S10_AUDIT_DROPPED` → 커밋해 보존(`7749f4b`). 그 사이의 복원 시도 감사 기록 순서(`4a0b23f`), `allowedRoutes` 되돌리기(`ec0477e`), 감사 기록 사본(`f6a358a`)은 판정을 바꾸지 않았지만 해가 없어 그대로 두었습니다. Vercel 로그로 보면 6~10단계 심판은 배포 주소를 직접 호출하지 않고 `/aleph.json`과 저장소 기록을 봅니다.
- 복구 전에 확인한 것(참고, 위 표의 "복구 뒤 결과"가 아님): 임시 작업 사본에서 정책을 되돌린 뒤 로컬 가짜 로그인 시험으로 B의 A 메모 404·A 정상 200, `decider:test` 4건·`detect:test` 6건 통과. 배포 주소의 로그인 없는 `POST /api/restore` 401, `GET /api/restore` 405(커밋 `df8e234` 배포).

- 확인 기록(로컬): 가짜 로그인·메모리 DB로 B 메모를 변조한 뒤 B가 복원하면 200 `content`, 지운 뒤 복원하면 200 `recreated`이고 둘 다 ID·소유자·내용 해시가 사본과 같았습니다. A가 B 메모 복원 404, 사본 변조 409, 같은 id가 A 소유일 때 409(A 소유 유지), A 메모는 그대로, 감사 기록에 본문 없음. 정책 되돌리기는 임시 작업 사본에서 자료 API 소유자 대조를 지운 뒤 복원해 B의 A 메모 읽기·수정·삭제가 200에서 404로 돌아오고 A 정상 요청은 200인 것을 확인했습니다. 배포 주소와 실제 DB에서의 확인은 SQL 실행·배포 뒤에 합니다.

## 11단계: 나만의 접속 앱을 완성합니다

- 설치형 웹앱(`public/manifest.webmanifest`, `icon.svg`, `offline.html`, `sw.js`, `app.js`): 앱 이름 "BYTE BACK 내 자료실", `standalone`, 아이콘, 오프라인 안내를 붙였습니다. 서비스 워커는 오프라인 안내·아이콘·manifest만 저장하고 `/api/` 요청과 메모·토큰은 저장하지 않습니다. 화면의 "이 기기" 칸은 설치 여부를 안내로만 보여 주며 "설치는 기기 승인이 아닙니다"라고 적습니다. 따로 설치할 접속 프로그램은 없습니다.
- 기기 승인(`src/devices-api.mjs`, `api/devices.js`, `supabase/step11_devices.sql`): 로그인하면 화면이 WebCrypto로 기기 키 쌍(ECDSA P-256)을 메모리에만 만듭니다. 개인키는 내보낼 수 없게 만들고 `localStorage`·IndexedDB에 넣지 않아, 새로고침하면 새 키가 되고 다시 승인받아야 합니다. **승인 요청**은 공개키만 `POST /api/devices`로 보내고, 서버가 16자리 기기 ID(`sha256("P-256.x.y")` 앞 16자리)를 계산해 `device_registrations`에 `pending`으로 저장합니다(본문의 상태·개인키 값은 거부). **승인 결과 확인**은 `GET /api/devices`(헤더 `X-Device-Id`)로 서버 기록만 돌려줍니다. 승인(`approved`)은 API·버튼으로 할 수 없고 학생이 Supabase SQL Editor에서만 합니다. 테이블은 RLS를 켜고 `PUBLIC`·`anon`·`authenticated` 권한을 모두 거뒀습니다.
- 메모 API(`src/notes-api.mjs`): 로그인 다음에 `X-Device-Id`가 이 사용자의 `approved` 기기인지 서버 기록으로 확인하고, 아니면 403 `DEVICE_NOT_APPROVED`입니다. 화면도 서버가 승인했다고 답하기 전에는 자료 칸을 열거나 메모를 부르지 않습니다.
- 11단계 저장점: `aleph.config.json`은 `step: 11`, `allowedRoutes`에 실제로 만든 `GET /api/devices`·`POST /api/devices`를 더했습니다(일곱 개). 판정기 `RULE_IDS`는 10단계와 같습니다. 자기 점검은 한도 20개를 지키려 판정기·탐지기·구역 가상 요청 항목을 둘씩 묶고, 토큰 없는 `/api/devices` 요청(실제 전송)·manifest 제공(실제 전송)·승인 전후 자료 표시(미실행)를 더했습니다.

### 확인 순서

| 순서 | 실행 | 기대 | 결과 |
|---|---|---|---|
| 1 | `npm run bundle` 자기 점검 `device_api_anonymous`·`install_manifest` | 토큰 없는 `/api/devices` GET·POST 401, manifest 200·이름·`standalone` | 실행(`npm run bundle`) — 결과는 `artifacts/submission.json`의 해당 항목 |
| 2 | A 로그인 뒤 승인 요청 전·승인 대기 | 자료 미표시, "승인 결과 확인"을 눌러도 승인 대기 | 미실행(자동 점검, 로그인 필요) · 학생 브라우저 직접 확인: 승인 요청 전·대기 동안 자료가 보이지 않음, 결과 확인을 눌러도 "승인 대기" |
| 3 | SQL Editor에서 그 기기 ID를 `approved`로 바꾼 뒤 승인 결과 확인 | "승인됨", 메모 네 건과 기존 화면 정상 | 미실행(자동 점검, 로그인 필요) · 학생 브라우저 직접 확인: "승인됨 — 서버가 이 기기를 등록 기기로 확인했습니다", 메모 네 건 표시. 처음에는 승인 SQL에 `<`·`>`를 남겨 0줄이 바뀌어 승인되지 않았음 |
| 4 | 새로고침 | 새 기기 키, "승인 요청 전", 자료 미표시 | 미실행(자동 점검, 로그인 필요) · 학생 브라우저 직접 확인: "승인 요청 전"으로 돌아가고 자료가 보이지 않음 |

- 로컬 시험(가짜 로그인·메모리 DB): 승인 전 메모 목록·읽기와 기기 헤더 없음 403, SQL 승인 흉내 뒤 목록·수정 200, B가 A의 승인 기기 ID 헤더로 요청 403, 승인 취소 뒤 403, 본문에 `status`·개인키 `d`를 섞은 승인 요청 400, B가 A 공개키로 요청 409, 저장된 기록에 개인키 없음.

- 11단계 이후 변경(저장점 `610760c` 뒤): `bb628a1` 판정기가 `null`·`undefined`·문자열 같은 객체가 아닌 요청에도 예외 없이 형식에 맞는 응답(`deny`·`device_not_registered`)을 돌려주고, 주석에서도 계약 밖 이름 표기를 뺐습니다. `f852d5b` 로그인 세션(access·refresh 토큰)을 `localStorage`에 저장·읽지 않고 화면 메모리에만 둡니다(예전 세션은 시작할 때 지우기만 함). 새로고침하면 다시 로그인합니다.
- 100점 조건 점검(학생 요청으로 실행): 저장소를 새로 받아 `npm install` 종료 코드 0(`610760c`), 판정기가 계약 이름만 읽고 10가지 가상 요청 모두 형식에 맞는 응답·`RULE_IDS` 안의 규칙, `step` 11 이상.
- 심판 판정 기록: 11단계는 커밋 `f852d5b`로 **심판 통과**했습니다. 그 전 `bb628a1` 제출에서 `S11_KEY_EXPOSED`(화면 묶음·브라우저 저장소에 키)가 나왔고, 화면이 로그인 토큰을 `localStorage`에 두던 것을 메모리로 옮겨 풀렸습니다.

**남은 점:** 요청 서명이 아직 없습니다. 기기 ID는 비밀값이 아니어서, 같은 사용자의 로그인 토큰과 승인된 기기 ID를 함께 가진 사람은 서명 없이 보호 요청을 보낼 수 있고, 경로·본문을 바꿔도 막지 못합니다(11단계 괴물 세 마리). 승인 SQL의 자리 표시 `<…>`는 지우고 16자리만 넣어야 합니다.

## 보너스 xdr-01: 무차별 로그인 공격 (brute-force)

- 경보: `xdr/fixtures/brute-force.json`(수업용 Wazuh 모양 28건, 문서용 주소·가상 계정). 원본은 고치지 않습니다.
- `xdr/brute-force/read-alerts.mjs`: 확인용. 시각·출발 주소·계정·규칙 수준·설명만 뽑고 비밀값처럼 보이는 값은 가립니다. `decide.mjs`는 불러오지 않습니다.
- `xdr/brute-force/decide.mjs` + `patterns.mjs`: `decide(alert)`가 `{action, confidence, reason}`을 돌려줍니다. 같은 폴더의 `patterns.mjs`만 불러오고 내장 모듈·npm 패키지·JSON·네트워크·환경변수를 쓰지 않습니다. 수준 10 이상이고 strong 패턴(`burst_failures`, `password_spray`, `password_mutation`, `no_success_after_burst`)이 맞으면 `block`(0.85 이상), weak 패턴만 맞으면 `alert`(0.5 이상), 그 밖은 `record`입니다. reason에 근거 패턴 이름을 한 줄로 적습니다. Jev는 저장소에 연결 정보가 없어 부르지 않고 애매한 건은 `alert`로 둡니다.
- `xdr/brute-force/respond.mjs`: `block` 판정의 출발 주소만 거부 규칙(만료 60분, 근거 경보 번호)으로 `xdr/brute-force/deny-rules.json`에 넣고, block·alert를 `xdr/alerts.log`에 한 줄씩 쌓습니다. 계정은 막지 않고, 같은 묶음에서 정상·애매 이벤트에 나온 주소도 막지 않습니다. 두 결과 파일은 10단계부터 감사 이력·다른 서비스 규칙으로 저장소에 보존합니다(문서용 주소·가상 계정만, 비밀값 없음). 판정기 `src/decider.mjs`와 `RULE_IDS`(`starter.deny`)는 고치지 않았습니다.
- 다시 실행하는 방법: `npm run xdr:run -- brute-force` → `xdr/brute-force/result.json`의 `counts`가 `{"block":10,"alert":9,"record":9}`, 정상 이벤트(bf-20~28)는 모두 `record`입니다. `node xdr/brute-force/respond.mjs` → 거부 규칙 9개, bf-01~10 주소만 거부되고 나머지는 통과합니다. `node xdr/brute-force/read-alerts.mjs` → `경보 28건 · 뽑은 줄 28줄 · 일치`.
- 격리 확인: `decide.mjs`·`patterns.mjs`만 빈 폴더에 두고 환경변수를 비우고 그 폴더 밖 파일 읽기를 막은 Node 권한 모드에서 경보마다 2초 제한으로 돌려 `npm run xdr:run` 결과와 28건 모두 같았습니다(가장 느린 경보 1ms). 실제로 인터넷을 끄고 돌린 것은 아닙니다.

**남은 점:** 판정기 요청 계약(`docs/DECIDER_REQUEST.md`)에는 출발 주소가 없어 거부 규칙(`isDenied`)은 아직 실제 요청에 적용되지 않습니다. 확인은 시험 경보를 다시 흘린 규칙 대조입니다(6단계 판정기는 기기 등록 여부만 봅니다).

## 보너스 xdr-02: 웹 주입 공격 (web-injection)

- 경보: `xdr/fixtures/web-injection.json`(수업용 Wazuh 모양 26건, 요청 주소는 `doc-` 수업용 표기). 원본은 고치지 않습니다.
- `xdr/web-injection/read-alerts.mjs`: 확인용. 시각·출발 주소·계정·규칙 수준·설명만 뽑고 비밀값처럼 보이는 값은 가립니다. 요청 주소의 주입 문자열은 출력하지 않습니다.
- `xdr/web-injection/patterns.json`: 근거 MITRE ATT&CK T1190. `sql_injection`(CWE-89), `script_injection`(CWE-79), `path_traversal_repeat`(CWE-22), `command_injection`(CWE-78) 네 패턴에 찾는 조건(실제 형태·수업용 표기·설명 단서·신호 아님)과 근거 한 줄을 적었습니다. 명령 주입은 `;`·`|`·`&` 뒤 명령어, `&&`·`||`, `$( )`, 백틱을 보고, URL 인자를 나누는 `&` 하나는 신호로 보지 않습니다.
- `xdr/web-injection/decide.mjs`: 패턴을 파일 맨 위 상수로 옮겨 적고 import·파일 읽기쓰기·네트워크 없이 혼자 계산합니다. 패턴과 뚜렷하게 맞고 같은 주소에서 5회 이상 반복되면 `block`(0.85 이상), 한 번뿐이거나 일부만 맞는 T1190 경보는 `alert`(0.5 이상), 그 밖은 `record`입니다. reason에 근거 패턴 이름을 한 줄로 적습니다.
- `xdr/web-injection/respond.mjs`: `block` 판정의 출발 주소만 거부 규칙(만료 60분, 근거 경보 번호)으로 `xdr/web-injection/deny-rules.json`(10단계부터 저장소에 보존)에 넣고, block·alert를 `moduleKey`를 붙여 `xdr/alerts.log`에 한 줄씩 쌓습니다. 계정과 정상·애매 이벤트 주소는 막지 않습니다. 판정기 `src/decider.mjs`와 `RULE_IDS`는 고치지 않았습니다.
- 다시 실행하는 방법: `npm run xdr:run -- web-injection` → `counts`가 `{"block":8,"alert":9,"record":9}`, 명확한 공격 wi-01~08은 모두 `block`, 정상 이벤트(wi-18~26)는 모두 `record`. `node xdr/web-injection/respond.mjs` → 거부 규칙 7개, wi-01~08 주소만 거부. `node xdr/web-injection/read-alerts.mjs` → `경보 26건 · 뽑은 줄 26줄 · 일치`.
- 격리 확인: `decide.mjs` 한 파일만 빈 폴더에 두고 환경변수를 비우고 폴더 밖 파일 읽기를 막은 Node 권한 모드에서 경보마다 2초 제한으로 돌려 `npm run xdr:run` 결과와 26건 모두 같았습니다(가장 느린 경보 1ms).

**남은 점:** 판정기 요청 계약에 출발 주소가 없어 거부 규칙은 아직 실제 요청에 적용되지 않습니다(확인은 시험 경보 대조).

## 보너스 xdr-03: 알려진 취약점 악용 (known-cve)

- 경보: `xdr/fixtures/known-cve.json`(수업용 Wazuh 모양 24건, CVE-2021-44228 형태의 원격 조회 구문은 문서용 주소 표기). 원본은 고치지 않고, 조회 구문 문자열은 다른 곳에 옮겨 적지 않습니다.
- `xdr/known-cve/read-alerts.mjs`: 확인용. 시각·출발 주소·계정·규칙 수준·설명만 뽑고 비밀값처럼 보이는 값과 `${…}` 조회 구문 모양은 가립니다. 요청 주소·머리글은 뽑지 않습니다. `decide.mjs`는 불러오지 않습니다.
- `xdr/known-cve/patterns.json`: 근거 CVE-2021-44228 · MITRE ATT&CK T1190. `jndi_lookup_header`(머리글), `jndi_lookup_param`(요청 인자), `known_scanner_trace`(점검 도구 흔적, 조회 구문과 함께일 때만) 세 패턴에 찾는 조건·신호 아님·근거 한 줄을 적었습니다. 설명의 "조회 구문은 없습니다" 같은 부정은 단서로 쓰지 않습니다(`negationHints`).
- `xdr/known-cve/decide.mjs`: 패턴을 파일 맨 위 상수로 옮겨 적고 import·파일 읽기쓰기·네트워크 없이 혼자 계산합니다. 완전한 `${jndi:<프로토콜>:` 형태가 머리글·인자에 있으면 한 번이어도 `block`(0.88~0.92), 설명에만 조회 구문이 있거나 단어만 비슷한 T1190 경보는 `alert`(0.5~0.8), 그 밖은 `record`입니다. reason에 근거 패턴 이름을 한 줄로 적습니다.
- `xdr/known-cve/respond.mjs`: `block` 판정의 출발 주소만 거부 규칙(만료 60분, 근거 경보 번호)으로 `xdr/known-cve/deny-rules.json`에 넣고, block·alert를 `moduleKey`를 붙여 `xdr/alerts.log`에 한 줄씩 덧붙입니다(기존 줄은 그대로). 계정과 정상·애매 이벤트 주소는 막지 않습니다. 판정기 `src/decider.mjs`와 `RULE_IDS`는 고치지 않았습니다.
- 다시 실행하는 방법: `npm run xdr:run -- known-cve` → `counts`가 `{"block":8,"alert":8,"record":8}`, 명확한 공격 kc-01~08은 모두 `block`, 정상 이벤트(kc-17~24)는 모두 `record`. `node xdr/known-cve/respond.mjs` → 거부 규칙 7개, kc-01~08 주소만 거부(실행할 때마다 알림 16줄이 더 쌓임). `node xdr/known-cve/read-alerts.mjs` → `경보 24건 · 뽑은 줄 24줄 · 일치`.
- 격리 확인: `decide.mjs` 한 파일만 빈 폴더에 두고 환경변수를 비우고 폴더 밖 파일 읽기를 막은 Node 권한 모드에서 경보마다 2초 제한으로 돌려 `npm run xdr:run` 결과와 24건 모두 같았습니다(가장 느린 경보 0.7ms). 실제로 인터넷을 끄고 돌린 것은 아닙니다.

**남은 점:** 판정기 요청 계약에 출발 주소가 없어 거부 규칙은 아직 실제 요청에 적용되지 않습니다(확인은 시험 경보 대조). 조회 구문을 다른 인코딩으로 감춘 변형(중첩 `${…}` 등)은 이번 패턴에 넣지 않았습니다.

## 12단계: 탈환 작전실을 완성합니다

- 작전실 요약(`src/war-room-api.mjs`, `api/war-room.js`, 화면 `public/index.html`·`auth.js`의 "탈환 작전실"): `GET /api/war-room`은 로그인한 사용자 본인의 기록만 모읍니다. 판정기 규칙(`RULE_IDS`와 서버에서 `decide()`에 가상 요청 다섯 개를 넣은 결과), 탐지 사건(`detect()`·`proposeRevocation()` 가상 실행), 회수 상태(`device_registrations` 서버 기록), 복구 버전(정책 사본 버전·지문 검증, `notes_backup`·`restore_audit` 서버 기록)에 출처(서버 기록·로컬 가상·미실행)를 붙입니다. 메모 본문·제목·공개키·토큰은 넣지 않고 ID는 앞 4자리만 보여 줍니다. 화면은 서버가 준 가린 기록을 다시 세어 서버 수치와 "일치/불일치"만 표시하고 성공 문구를 만들지 않습니다. 로그인 없이 부르면 401, 쿼리 404, GET이 아니면 405입니다.
- 재시험 실측 표(`scripts/retest.mjs` = `npm run retest`, 작전실 **로그인 재시험**): 로그인 없는 요청은 명령이, 로그인·승인 기기가 필요한 요청은 화면이 배포 API에 실제로 보내고 요청 ID(`X-Request-Id`)·서버 요청 ID(`x-vercel-id`)·실제 상태·확인 시각을 남깁니다. 브라우저 결과를 `retest/browser.json`에 붙이면 `retest/results.md`·`json`으로 합쳐지며, 붙이지 않은 줄은 미실행입니다. 판정기·탐지기 줄은 로컬 가상으로 따로 표시합니다.
- 실측 결과(커밋 `a889b50` 배포, 2026-10-14): 29줄 모두 실행·불일치 0·미실행 0 — 로그인 없는 배포 API 14줄(금지 요청 404·401, 정상 `/`·`/aleph.json`·manifest 200), 학생 A 로그인·승인 기기 8줄(정상 목록·읽기·같은 값 수정 200, 금지 role 403·미승인 기기 403·B 메모 읽기 404·`owner_id` 쿼리 404·B 메모 복원 404), 로컬 가상 7줄. 심판의 41종 공격은 미실행(심판이 실행)으로 표에 넣지 않았습니다.
- 12단계 저장점: `aleph.config.json`은 `step: 12`, `allowedRoutes`에 `GET /api/war-room`을 더했습니다(여덟 개). 판정기 `RULE_IDS`는 그대로입니다. 자기 점검(12단계)은 심판이 `npm run bundle`을 격리 환경에서 다시 실행해 "그 attackId로 보낸 요청 기록"을 대조하므로, 요청을 하나도 보내지 않고 16개 점검 모두 `observed: not_run`으로 둡니다. 실제로 보낸 정상·금지 요청과 판정기·탐지기 결과는 `retest/results.md`(29줄, 요청 ID·서버 요청 ID·확인 시각)에만 적고, 제출 묶음에 옮겨 적거나 계산해 채우지 않습니다. 시도 기록: `f5c7b44`는 쓰기 요청·node 실행으로 `S12_BUNDLE_UNSUPPORTED`(0점), `58b2195`는 요청 없는 로컬 계산에 결과를 적어 「실행 기록 대조」 불일치, `e847a41`(요청 ID·attackId 헤더)·`d72a9b7`(소문자 헤더·fetch 옵션 축소)·`408c04f`(실패 요청 not_run)·`1eafb0a`(주소에 `?attackId=`, 격리 환경 URL에 searchParams가 없어 bundle 실패)·`75d5d59`(문자열 주소)에서도 학생이 지은 attackId로 보낸 GET은 심판 기록에 잡히지 않았습니다.

**남은 점:** 요청 서명과 회수된 신원을 실제로 거부하는 장치는 없습니다(회수 집행은 ALEPH SDP 엔진 몫, 판정 계약에 회수 사건 이름이 없음). 작전실의 판정기·탐지기 결과는 로컬 가상이며 엔진·심판 판정이 아닙니다.

## 운영 안내 (검사 커밋 `6294c3b` 기준)

이 절은 `npm run retest`로 29줄을 실측한 커밋 `6294c3b`를 기준으로 학생 판정기·탐지 규칙·접속 앱·자료실을 설치·실행·중지·복구하는 순서입니다. 비밀값(서버 전용 키, 비밀번호, 토큰, 기기 개인키)은 저장소·README·제출 묶음에 넣지 않고 이름만 적습니다.

### 출처 구분

| 구분 | 무엇 | 파일 |
|---|---|---|
| **제공: ALEPH SDP 엔진** | 신원·기기·경로를 먼저 확인하고 판정기에 `aleph.decision.v1` 요청을 보내는 반 운영 엔진, 미등록 기기 차단 릴레이, 탐지기의 회수 제안 집행, 심판 | 이 저장소에 없음. 연결 방식만 계약 문서 `docs/DECIDER_REQUEST.md`·`docs/DETECT_EVENTS.md`(시작 틀 그대로)로 정해져 있음 |
| **제공: 시작 틀(바꾸지 않음)** | 로그인 토큰 검사, 제출 묶음, 판정기·탐지기 연습, 보너스 실행기, 시험 | `src/verify-login.mjs`, `scripts/bundle.mjs`·`decider-test.mjs`·`detect-test.mjs`·`fixture-7.mjs`·`xdr-run.mjs`, `test/*`, `docs/*`, `package/*`, `xdr/fixtures/*`, `xdr/README.md`, `AGENTS.md`, `api/ai.js`·`api/threat-intel.js`(미구현 501) |
| **시작 틀을 학생이 고친 파일** | 빌드·배포 정보, 설정, 판정기·탐지기 본문, 자기 점검, 화면 틀 | `scripts/build-public.mjs`, `scripts/deployment-identity.mjs`(3·5·10단계 값 공개), `aleph.config.json`, `src/decider.mjs`, `src/detect.mjs`, `src/attack-check.mjs`, `public/index.html`, `vercel.json`, `package.json`, `.gitignore`, `data.json` |
| **학생 작성** | 자료 API·로그인 대행·구역·복원·기기 승인·작전실 서버 함수, 접속 앱 화면, 정책 비교·되돌리기, 재시험 표, DB SQL, 보너스 xdr 모듈 | `api/notes/*`, `api/auth/*`, `api/restore.js`, `api/devices.js`, `api/war-room.js`, `src/notes-api.mjs`·`auth-proxy.mjs`·`resources.mjs`·`restore-api.mjs`·`devices-api.mjs`·`war-room-api.mjs`, `public/auth.js`·`app.js`·`sw.js`·`manifest.webmanifest`·`offline.html`·`icon.svg`, `scripts/policy-diff.mjs`·`retest.mjs`, `policy/*`, `retest/*`, `supabase/step*.sql`, `xdr/brute-force/*`, `xdr/web-injection/*`, `xdr/known-cve/*` |

판정기(`src/decider.mjs`)와 탐지기(`src/detect.mjs`)는 학생이 쓴 규칙이지만, 실제 접속에서 이 함수를 부르고 결과를 집행하는 것은 ALEPH SDP 엔진입니다. 이 저장소의 자료 API는 판정기를 부르지 않습니다. 로컬 연습(`decider:test`·`fixture:7`·`detect:test`)과 작전실의 판정기·탐지기 결과는 엔진·심판 판정이 아닙니다.

### 설치 (재현 순서)

1. Node.js 22 이상을 준비하고 저장소를 받습니다: `git clone https://github.com/whoisinsu/choi-bujang-secret-vault.git` → 폴더에서 `npm install`(커밋 `610760c`에서 새로 받아 오류 없이 끝나는 것 확인).
2. Supabase 프로젝트의 SQL Editor에서 아래 순서로 실행합니다. 모두 여러 번 실행해도 되며, 테스트 계정 이메일만 바꿉니다.
   1. `supabase/step2_vault_notes.sql` — 가상 메모 원본 `vault_notes`. 메모 문장이 들어 있어 Git에서 제외했으므로 학생이 따로 보관한 파일을 씁니다.
   2. `supabase/step3_notes.sql` → `step4_owners.sql` → `step4_rls.sql` → `step5_revoke.sql` — 메모 테이블, A·B 소유자, RLS, 직접 권한 회수.
   3. `supabase/step10_backup.sql` — 비공개 메모 사본·감사 기록(덧붙이기만).
   4. `supabase/step11_devices.sql` — 기기 승인 기록. **배포보다 먼저** 실행합니다(없으면 메모 API가 502).
3. Vercel 프로젝트의 환경변수 비밀 입력란에 이름만 맞춰 값을 직접 넣습니다: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`(서버 전용), `SUPABASE_PUBLISHABLE_KEY`(로그인 대행용). 값은 코드·Git·채팅에 적지 않습니다.
4. `main`에 push하면 Vercel이 `npm run build`로 배포하고 `/aleph.json`에 단계·커밋·`allowedRoutes`·`originalApiUrl`·`restoreRoute`를 기록합니다. 배포 주소의 `/aleph.json` `commit`이 push한 커밋과 같은지 봅니다.

### 실행

| 대상 | 명령·동작 | 기대 |
|---|---|---|
| 학생 판정기 | `npm run decider:test`, `npm run fixture:7` | 네 줄 `통과`, 정상 allow·복합 이상 step_up(로컬 연습) |
| 학생 탐지 규칙 | `npm run detect:test` | 여섯 줄 `통과`(로컬 연습) |
| 보너스 xdr | `npm run xdr:run -- brute-force`, `npm run xdr:run -- web-injection`, `npm run xdr:run -- known-cve` | 보너스 절의 counts와 같음 |
| 정책 사본 | `npm run policy:diff` | 사본 `policy@240d023` 검증 통과와 변경 범위 |
| 접속 앱·자료실 | 배포 주소 접속 → 로그인 → "이 기기"에서 **승인 요청** → SQL Editor에서 그 16자리 기기 ID를 `approved`로(`supabase/step11_devices.sql` 맨 아래 문장, `<…>` 없이) → **승인 결과 확인** | 승인 전 자료 없음, "승인됨" 뒤 기존 메모 화면. 새로고침하면 로그인·승인을 다시 함(세션·기기 키는 메모리에만) |
| 작전실 | 로그인 뒤 **작전실 불러오기**, 승인 기기에서 **로그인 재시험** | 네 항목 "기록 다시 세기: 일치", 재시험 8줄 일치 |
| 재시험 표 | 로그인 재시험 JSON을 `retest/browser.json`에 붙인 뒤 `npm run retest` | `retest/results.md` 29줄, 불일치 0 |
| 제출 묶음 | 커밋 뒤 `bundle-notes.json`(Git 제외)에 설명을 적고 `npm run bundle` | `artifacts/submission.json`(Git 제외) 생성 |

### 중지

- 한 기기의 자료 접근 중지: SQL Editor에서 `update public.device_registrations set status = 'revoked' where device_id = '<16자리>' and owner_id = (select id from auth.users where email = '<테스트 계정>');` → 그 기기의 메모 요청은 바로 403 `DEVICE_NOT_APPROVED`.
- 로그인 세션 중지: 화면의 **로그아웃**(서버 로그아웃 호출) 또는 탭 닫기·새로고침(세션이 메모리에만 있어 사라짐).
- 서버의 자료 접근 전체 중지: Supabase 대시보드에서 서버 전용 키를 폐기·교체하면 메모·복원·기기·작전실 API가 DB에 닿지 못합니다. 다시 열 때는 새 키를 Vercel 비밀 입력란에 직접 넣고 재배포합니다.
- 상주하는 로컬 프로그램은 없습니다. 연습 명령은 실행이 끝나면 스스로 멈춥니다. 배포 자체를 내리는 일은 Vercel 대시보드에서 학생이 직접 정하며 이 저장소는 그 설정을 바꾸지 않습니다.

### 복구

1. 코드: 문제가 된 커밋을 `git revert <커밋>`으로 되돌린 커밋을 만들고 push합니다(`git reset --hard`는 쓰지 않음). 기준은 이 절의 검사 커밋 `6294c3b`입니다.
2. 정책 파일: `npm run policy:diff`로 차이를 보고 `npm run policy:restore` → 화면의 버전으로 `npm run policy:restore -- --confirm <버전>`. 정책 파일만 되돌리고 `policy/restore-log.jsonl`에 덧붙입니다. 사본 기준은 9단계(`240d023`)라 10~11단계 설정까지 되돌리는지 먼저 확인합니다.
3. 메모 한 건: B 시험 메모는 B 로그인 Console에서 `POST /api/restore` `{"id":"b0000000-0000-4000-8000-000000000001"}`(변조는 내용, 삭제는 재생성, 내용 해시 `019f5e7d…` 대조). A 가상 메모는 `vault_notes`에서 지운 한 건만 원래 id로 다시 넣습니다(10단계 사고 기록의 SQL).
4. DB 구조: `supabase/step*.sql`을 설치 순서대로 다시 실행합니다. 사본·감사 기록은 덮어쓰지 않습니다.
5. 감사 기록: `restore_audit`는 트리거로 덧붙이기만 됩니다. 저장소 사본 `policy/restore-audit.jsonl`에도 새 줄만 덧붙입니다.
6. 복구 뒤 확인: `npm run retest`와 작전실 **로그인 재시험**을 다시 실행해 정상 허용·금지 거부를 실측합니다. 실행하지 않은 줄은 미실행으로 남깁니다.

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 2단계부터는 자료 보호를 구현할 때 `public/data.json`을 복사하는 1단계 빌드 흐름도 함께 바꿔야 합니다. 3단계 이후의 로그인, 허용 경로, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.
