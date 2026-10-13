// 10단계: POST /api/restore {"id":"<메모 UUID>"} — 비공개 사본에서 로그인한 사용자의 메모 한 건만 복원합니다.
// 처리와 대조는 src/restore-api.mjs에 있습니다.
import { restoreHandler } from '../src/restore-api.mjs';

export default restoreHandler;
