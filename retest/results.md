# 1~11단계 재시험 실측 표

만든 시각: 2026-10-14T06:32:19.243Z · 배포 주소: https://choi-bujang-secret-vault-blue-tau.vercel.app · 커밋 기준: aleph.config.json step 11

| 단계 | 구분 | 요청 | 기대 | 실제 결과 | 일치 | 출처 | 요청 ID | 서버 요청 ID | 확인 시각 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 금지 | 비로그인 GET /data.json | 404 | 404 | 일치 | 배포 API(로그인 없음) | e0df90a9-8994-4b88-9bfe-ecff2eb9ca29 | icn1::dznqk-1791959540997-56d0fb26c72c | 2026-10-14T06:32:15.907Z |
| 2 | 정상 | 비로그인 GET / (화면 틀) | 200, 메모 문장 없음 | 200 | 일치 | 배포 API(로그인 없음) | 02894364-d98f-4882-b76d-22023e08f4b1 | icn1::zrj6b-1791959541050-c47f75f75248 | 2026-10-14T06:32:16.113Z |
| 2 | 금지 | 비로그인 GET /aleph.json에 메모 문장 | 200, 메모 문장 없음 | 200 | 일치 | 배포 API(로그인 없음) | 55e345c5-7431-4c9f-8cbd-5c27f5692ce8 | icn1::kzw74-1791959541094-047768781d2d | 2026-10-14T06:32:16.165Z |
| 3 | 금지 | 토큰 없이 GET /api/notes | 401 | 401 LOGIN_REQUIRED | 일치 | 배포 API(로그인 없음) | 17320452-ed64-4344-989a-dbd8d289cc96 | icn1::iad1::wt67g-1791959541112-cf68919f7119 | 2026-10-14T06:32:16.199Z |
| 3 | 금지 | 위조 토큰 GET /api/notes | 401 | 401 LOGIN_REQUIRED | 일치 | 배포 API(로그인 없음) | 2ccd5547-df01-4014-8081-b284bf253fa2 | icn1::iad1::h8987-1791959541345-f22d7e5c8acf | 2026-10-14T06:32:16.422Z |
| 3 | 금지 | 토큰 없이 POST /api/notes(role=admin) | 401 | 401 LOGIN_REQUIRED | 일치 | 배포 API(로그인 없음) | 1f2ad9ad-b680-44b9-9b3a-a82dacb148a8 | icn1::iad1::g7fdd-1791959541594-d0de39dd6e24 | 2026-10-14T06:32:16.665Z |
| 3 | 금지 | 토큰 없이 PUT /api/notes/:id | 401 | 401 LOGIN_REQUIRED | 일치 | 배포 API(로그인 없음) | 40da97a5-f0f7-4a3d-933b-ec742e1f4b1a | icn1::iad1::h8987-1791959541812-57ad8a91539c | 2026-10-14T06:32:16.895Z |
| 3 | 금지 | 토큰 없이 DELETE /api/notes/:id | 401 | 401 LOGIN_REQUIRED | 일치 | 배포 API(로그인 없음) | 4c2e115f-2958-4a87-8d6a-c8e74021fcef | icn1::iad1::zrj6b-1791959542044-a476a9434203 | 2026-10-14T06:32:17.123Z |
| 5 | 금지 | anon 키로 원본 notes SELECT | 401 | 401 | 일치 | 배포 API(로그인 없음) | 997f9cd5-feaa-40bb-850f-c1b408d4efa4 | — | 2026-10-14T06:32:17.340Z |
| 5 | 금지 | anon 키로 원본 notes INSERT | 401 | 401 | 일치 | 배포 API(로그인 없음) | 81cdfb90-5945-4a82-8103-53a81e9ec01f | — | 2026-10-14T06:32:18.187Z |
| 10 | 금지 | 토큰 없이 POST /api/restore | 401 | 401 LOGIN_REQUIRED | 일치 | 배포 API(로그인 없음) | 78c86420-a406-4974-98f5-08b534f2bba6 | icn1::iad1::2ftbr-1791959543189-73eef907d75a | 2026-10-14T06:32:18.265Z |
| 11 | 금지 | 토큰 없이 POST /api/devices | 401 | 401 LOGIN_REQUIRED | 일치 | 배포 API(로그인 없음) | ccd15bf2-bdcd-4094-908d-251f1a98876e | icn1::iad1::9mmln-1791959543431-ba632c37adde | 2026-10-14T06:32:18.509Z |
| 11 | 정상 | GET /manifest.webmanifest | 200 | 200 | 일치 | 배포 API(로그인 없음) | bb803a86-2d1d-4018-96f1-8b3cfb60285c | icn1::h8987-1791959543667-49f1e58c97b7 | 2026-10-14T06:32:18.751Z |
| 12 | 금지 | 토큰 없이 GET /api/war-room | 401 | 401 LOGIN_REQUIRED | 일치 | 배포 API(로그인 없음) | 8c653436-4eb3-4247-bf16-1cfe401b74b7 | icn1::iad1::wj8s8-1791959543898-d0306bb9bfc3 | 2026-10-14T06:32:18.984Z |
| 6 | 정상 | 판정기 등록 기기 내 메모 읽기 | allow | allow approved | 일치 | 로컬 가상 | 80037820-fb3e-4cf6-98a0-435b4f761a8a | — | 2026-10-14T06:32:19.241Z |
| 6 | 금지 | 판정기 미등록 기기 | deny | deny device_not_registered | 일치 | 로컬 가상 | d9bf86f3-004f-41d6-8899-767112a21084 | — | 2026-10-14T06:32:19.241Z |
| 7 | 금지 | 판정기 새벽·낯선 네트워크·사건 급증 | step_up | step_up step_up_required | 일치 | 로컬 가상 | 6ad2614a-1108-4437-a0d9-ca302c5688e5 | — | 2026-10-14T06:32:19.241Z |
| 8 | 금지 | 판정기 다른 사용자 메모 경로 | deny | deny starter_not_ready | 일치 | 로컬 가상 | ee0002bd-3132-41dd-93b6-af4072c64927 | — | 2026-10-14T06:32:19.241Z |
| 8 | 금지 | 판정기 목록 조회(자료 ID 없음) | deny | deny starter_not_ready | 일치 | 로컬 가상 | 8e6f61cf-6dcc-423b-b0f3-17bee55da62f | — | 2026-10-14T06:32:19.241Z |
| 9 | 금지 | 탐지기 10분 안 GET 121건 | propose_revocation | propose_revocation burst_read | 일치 | 로컬 가상 | — | — | 2026-10-14T06:32:19.242Z |
| 9 | 정상 | 탐지기 10분 안 GET 120건 | observe | observe | 일치 | 로컬 가상 | — | — | 2026-10-14T06:32:19.242Z |
| 4 | 정상 | A 내 메모 목록 | 200, 내 메모 1건 이상 | 200 | 일치 | 배포 API(브라우저 로그인) | 0c34b8c9-1df5-4822-b626-af3e3f2fa220 | icn1::iad1::7w2q2-1791959442794-c504b5652414 | 2026-10-14T06:30:37.884Z |
| 4 | 정상 | A 내 메모 한 건 읽기 | 200 | 200 | 일치 | 배포 API(브라우저 로그인) | 404613d7-9b8c-48a3-90f9-da122697aa3b | icn1::iad1::kvt2b-1791959444441-a119e2a8fb99 | 2026-10-14T06:30:39.528Z |
| 4 | 정상 | A 내 메모 같은 값으로 수정 | 200 | 200 | 일치 | 배포 API(브라우저 로그인) | 066ccc19-9af0-480c-a345-388b68520813 | icn1::iad1::qwfhg-1791959445956-3ce0dddce3f7 | 2026-10-14T06:30:41.046Z |
| 8 | 금지 | A role 포함 수정 | 403 ROLE_FIELD_REJECTED | 403 ROLE_FIELD_REJECTED | 일치 | 배포 API(브라우저 로그인) | 8d0de5b3-7dc0-42de-a05a-11f88664a051 | icn1::iad1::896fd-1791959447488-ea2e3f9deb44 | 2026-10-14T06:30:42.575Z |
| 11 | 금지 | A 미승인 기기 ID로 목록 | 403 DEVICE_NOT_APPROVED | 403 DEVICE_NOT_APPROVED | 일치 | 배포 API(브라우저 로그인) | 0ac2d1ef-e3c2-49c2-a20a-07f31b3f525c | icn1::iad1::kvt2b-1791959448377-e5cdc61e7d38 | 2026-10-14T06:30:43.465Z |
| 4 | 금지 | A가 B 메모 읽기 | 404 NOTE_NOT_FOUND | 404 NOTE_NOT_FOUND | 일치 | 배포 API(브라우저 로그인) | adfa75c8-8a58-463b-bd9e-3ccee82c9ec2 | icn1::iad1::kvt2b-1791959449253-b41146012965 | 2026-10-14T06:30:44.343Z |
| 8 | 금지 | A 쿼리로 owner_id 지정 | 404 ROUTE_NOT_ALLOWED | 404 ROUTE_NOT_ALLOWED | 일치 | 배포 API(브라우저 로그인) | 5908f609-9cce-4e5c-831f-7931bb6cde94 | icn1::iad1::kvt2b-1791959450318-59072c5ca170 | 2026-10-14T06:30:45.409Z |
| 10 | 금지 | A가 B 메모 복원 | 404 BACKUP_NOT_FOUND | 404 BACKUP_NOT_FOUND | 일치 | 배포 API(브라우저 로그인) | eda2b659-3b71-41cd-b17e-973dc9b87c92 | icn1::iad1::kvt2b-1791959450770-16c8444019cd | 2026-10-14T06:30:45.858Z |

- 실행: 29줄(일치 29, 불일치 0) · 미실행: 0줄
- 심판의 41종 공격: 미실행(심판이 실행하며 이 표의 결과로 대신하지 않음)
- 로컬 가상 줄은 판정기·탐지기를 이 컴퓨터에서 실행한 결과이며 운영 엔진·심판 판정이 아닙니다.
