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

- 브라우저 코드(`public/auth.js`)에는 Supabase 주소·키·SDK가 없습니다. 메모 읽기·추가·수정·삭제는 Vercel 서버 함수 `/api/notes`, `/api/notes/:id`를, 로그인·토큰 갱신·로그아웃은 서버 함수 `POST /api/auth/login`(`{email,password}`), `POST /api/auth/refresh`(`{refresh_token}`), `POST /api/auth/logout`(Bearer)을 부릅니다. 서버(`src/auth-proxy.mjs`)가 Vercel 환경변수 `SUPABASE_PUBLISHABLE_KEY`로 Supabase Auth에 대신 요청하고, 토큰·만료 시각·이메일만 돌려줍니다. 비밀번호와 토큰은 저장하거나 로그에 남기지 않으며, 서버 전용 secret key는 Auth 호출에 쓰지 않습니다. 브라우저는 세션을 `localStorage`의 `vault-session`에 두고 만료 60초 전이나 401 때 한 번 갱신합니다.
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
- 판정기 구역 규칙(`src/decider.mjs`): 엔진이 준 `subjectId`·`deviceId`·`method`·`route`·`path`·`queryLength`만 씁니다. 순서는 `device_registered` → `route_exact` → 거부로 정한 경로 → `step_up_required` → `zone_my_notes` 허용입니다.
  - `route_exact`: 경로 표에 없는 route, 메서드가 다른 요청, path가 route 모양과 정확히 맞지 않는 요청, 쿼리가 있는 요청, `:id` 자리에 `export` 같은 기능 이름이 온 요청, 주체가 없거나 기기 ID 형식이 틀린 요청은 `deny`·`route_not_allowed`입니다.
  - `zone_my_notes`: `GET /notes`, `GET /notes/:id`, `PUT /notes/:id`만 `allow`입니다. 메모 소유자는 판정 요청에 없으므로 내 메모인지는 자료 API가 확인합니다.
  - `zone_class_notices`: `PUT /notices/:id`는 `deny`·`notice_write_forbidden`입니다. 계약에 역할이 없어 강사를 가릴 수 없으므로 누구의 공지 수정도 허용하지 않습니다.
  - 메모 추가·삭제는 아직 `starter.deny`입니다. `RULE_IDS`는 `starter.deny`, `device_registered`, `step_up_required`, `route_exact`, `zone_my_notes`, `zone_class_notices`입니다.
- 자료 API 확인(`src/notes-api.mjs`, 로그인 검사 뒤): 메모 API는 `my_notes` 구역의 다섯 경로만 받고 다른 구역은 403 `ZONE_FORBIDDEN`, 쿼리가 붙거나 주소의 `:id`와 받은 id가 다르면 404 `ROUTE_NOT_ALLOWED`, 본문에 `role`·`isInstructor`·`zone`·`scope` 등이 있으면 403 `ROLE_FIELD_REJECTED`입니다. 강사 권한은 검증된 로그인(student·judge)과 DB 어디에도 없어 공지 수정은 누구도 할 수 없습니다. 소유자는 4단계처럼 `owner_id`로 대조해 다른 사람 메모는 404 `NOTE_NOT_FOUND`입니다. 거부 사유는 코드와 경로 모양만 로그에 남깁니다.

### 확인 순서

1. `npm run decider:test` → 네 줄 모두 `통과`(이전 규칙 유지). 로컬 연습이며 심판 판정이 아닙니다.
2. 배포 뒤 A로 로그인한 화면에서 메모 목록·수정이 그대로 되는지 봅니다.
3. B로 로그인한 브라우저 Console에서 A 메모 id로 `GET`·`PUT`(본문에 `role: 'instructor'`)·`DELETE /api/notes/:id`를 보내면 404·403·404이고 A 메모는 그대로여야 합니다.

- 확인 기록: 가짜 로그인·가짜 DB를 붙여 메모 API 처리 함수를 직접 부른 로컬 실측에서 A 자기 메모 읽기·수정 200, B 목록 빈 배열, B의 A 메모 읽기·수정·삭제 404, 본문 role 403, 메모 API로 공지 수정 우회 403, 쿼리로 id·owner_id 지정 404였습니다. 배포 주소에서 로그인 토큰으로 한 실측은 아닙니다.
- 8단계 저장점: `aleph.config.json`은 `step: 8`, `allowedRoutes` 다섯 개는 그대로입니다. 자기 점검은 7단계 점검에 판정기 구역 규칙의 가상 요청 결과를 "심판 판정 아님"으로 더했습니다.

**남은 점:** 이유 코드 `route_not_allowed`·`notice_write_forbidden`과 공지 경로 이름 `/notices`는 운영 등록부·엔진 경로와 대조하지 못했습니다. 공지 읽기 경로는 표에 없어 거부됩니다. B의 A 메모 접근은 자동 점검에서 미실행입니다.

## 보너스 xdr-01: 무차별 로그인 공격 (brute-force)

- 경보: `xdr/fixtures/brute-force.json`(수업용 Wazuh 모양 28건, 문서용 주소·가상 계정). 원본은 고치지 않습니다.
- `xdr/brute-force/read-alerts.mjs`: 확인용. 시각·출발 주소·계정·규칙 수준·설명만 뽑고 비밀값처럼 보이는 값은 가립니다. `decide.mjs`는 불러오지 않습니다.
- `xdr/brute-force/decide.mjs` + `patterns.mjs`: `decide(alert)`가 `{action, confidence, reason}`을 돌려줍니다. 같은 폴더의 `patterns.mjs`만 불러오고 내장 모듈·npm 패키지·JSON·네트워크·환경변수를 쓰지 않습니다. 수준 10 이상이고 strong 패턴(`burst_failures`, `password_spray`, `password_mutation`, `no_success_after_burst`)이 맞으면 `block`(0.85 이상), weak 패턴만 맞으면 `alert`(0.5 이상), 그 밖은 `record`입니다. reason에 근거 패턴 이름을 한 줄로 적습니다. Jev는 저장소에 연결 정보가 없어 부르지 않고 애매한 건은 `alert`로 둡니다.
- `xdr/brute-force/respond.mjs`: `block` 판정의 출발 주소만 거부 규칙(만료 60분, 근거 경보 번호)으로 `xdr/brute-force/deny-rules.json`에 넣고, block·alert를 `xdr/alerts.log`에 한 줄씩 쌓습니다. 계정은 막지 않고, 같은 묶음에서 정상·애매 이벤트에 나온 주소도 막지 않습니다. 두 결과 파일은 Git에서 제외합니다. 판정기 `src/decider.mjs`와 `RULE_IDS`(`starter.deny`)는 고치지 않았습니다.
- 다시 실행하는 방법: `npm run xdr:run -- brute-force` → `xdr/brute-force/result.json`의 `counts`가 `{"block":10,"alert":9,"record":9}`, 정상 이벤트(bf-20~28)는 모두 `record`입니다. `node xdr/brute-force/respond.mjs` → 거부 규칙 9개, bf-01~10 주소만 거부되고 나머지는 통과합니다. `node xdr/brute-force/read-alerts.mjs` → `경보 28건 · 뽑은 줄 28줄 · 일치`.
- 격리 확인: `decide.mjs`·`patterns.mjs`만 빈 폴더에 두고 환경변수를 비우고 그 폴더 밖 파일 읽기를 막은 Node 권한 모드에서 경보마다 2초 제한으로 돌려 `npm run xdr:run` 결과와 28건 모두 같았습니다(가장 느린 경보 1ms). 실제로 인터넷을 끄고 돌린 것은 아닙니다.

**남은 점:** 판정기 요청 계약(`docs/DECIDER_REQUEST.md`)에는 출발 주소가 없어 거부 규칙(`isDenied`)은 아직 실제 요청에 적용되지 않습니다. 확인은 시험 경보를 다시 흘린 규칙 대조입니다(6단계 판정기는 기기 등록 여부만 봅니다).

## 보너스 xdr-02: 웹 주입 공격 (web-injection)

- 경보: `xdr/fixtures/web-injection.json`(수업용 Wazuh 모양 26건, 요청 주소는 `doc-` 수업용 표기). 원본은 고치지 않습니다.
- `xdr/web-injection/read-alerts.mjs`: 확인용. 시각·출발 주소·계정·규칙 수준·설명만 뽑고 비밀값처럼 보이는 값은 가립니다. 요청 주소의 주입 문자열은 출력하지 않습니다.
- `xdr/web-injection/patterns.json`: 근거 MITRE ATT&CK T1190. `sql_injection`(CWE-89), `script_injection`(CWE-79), `path_traversal_repeat`(CWE-22), `command_injection`(CWE-78) 네 패턴에 찾는 조건(실제 형태·수업용 표기·설명 단서·신호 아님)과 근거 한 줄을 적었습니다. 명령 주입은 `;`·`|`·`&` 뒤 명령어, `&&`·`||`, `$( )`, 백틱을 보고, URL 인자를 나누는 `&` 하나는 신호로 보지 않습니다.
- `xdr/web-injection/decide.mjs`: 패턴을 파일 맨 위 상수로 옮겨 적고 import·파일 읽기쓰기·네트워크 없이 혼자 계산합니다. 패턴과 뚜렷하게 맞고 같은 주소에서 5회 이상 반복되면 `block`(0.85 이상), 한 번뿐이거나 일부만 맞는 T1190 경보는 `alert`(0.5 이상), 그 밖은 `record`입니다. reason에 근거 패턴 이름을 한 줄로 적습니다.
- `xdr/web-injection/respond.mjs`: `block` 판정의 출발 주소만 거부 규칙(만료 60분, 근거 경보 번호)으로 `xdr/web-injection/deny-rules.json`(Git 제외)에 넣고, block·alert를 `moduleKey`를 붙여 `xdr/alerts.log`에 한 줄씩 쌓습니다. 계정과 정상·애매 이벤트 주소는 막지 않습니다. 판정기 `src/decider.mjs`와 `RULE_IDS`는 고치지 않았습니다.
- 다시 실행하는 방법: `npm run xdr:run -- web-injection` → `counts`가 `{"block":8,"alert":9,"record":9}`, 명확한 공격 wi-01~08은 모두 `block`, 정상 이벤트(wi-18~26)는 모두 `record`. `node xdr/web-injection/respond.mjs` → 거부 규칙 7개, wi-01~08 주소만 거부. `node xdr/web-injection/read-alerts.mjs` → `경보 26건 · 뽑은 줄 26줄 · 일치`.
- 격리 확인: `decide.mjs` 한 파일만 빈 폴더에 두고 환경변수를 비우고 폴더 밖 파일 읽기를 막은 Node 권한 모드에서 경보마다 2초 제한으로 돌려 `npm run xdr:run` 결과와 26건 모두 같았습니다(가장 느린 경보 1ms).

**남은 점:** 판정기 요청 계약에 출발 주소가 없어 거부 규칙은 아직 실제 요청에 적용되지 않습니다(확인은 시험 경보 대조).

## 다음 단계의 코딩 도구에 전달할 규칙

[AGENTS.md](AGENTS.md)를 먼저 읽히고 한 번에 한 제작 단위만 요청하세요. 2단계부터는 자료 보호를 구현할 때 `public/data.json`을 복사하는 1단계 빌드 흐름도 함께 바꿔야 합니다. 3단계 이후의 로그인, 허용 경로, 5단계의 원본 API 주소, 6단계 이후 정책 규칙은 해당 단계 원고와 계약에 맞춰 추가합니다. 비밀번호·토큰·서버 전용 키·실제 학생 기록을 코드, Git, 제출 묶음에 넣지 않습니다.

`src/decider.mjs`와 `src/detect.mjs`의 로컬 시험은 반 엔진이나 운영 심판의 결과가 아닙니다. 1단계 이후 제출 묶음 계약 `aleph.defense.submission.v2`는 `scripts/bundle.mjs`에 남아 있으며, 코딩 도구가 해당 단계의 최신 배포 주소와 Git 원격을 맞춘 뒤 사용합니다.
