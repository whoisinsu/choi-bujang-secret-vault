// 3단계: GET /api/notes(내 메모 목록)와 POST /api/notes(메모 추가)입니다.
// 로그인 검사는 src/notes-api.mjs가 시작 틀 src/verify-login.mjs로 합니다.
// 목록은 서버가 확인한 사용자 ID의 메모만 돌려주고, 추가할 때는 그 ID를 owner_id로 저장합니다.
// 본문의 owner_id·userId는 저장에 쓰지 않습니다(4단계에서도 같음).
import { randomUUID } from 'node:crypto';
import { HttpError, isUuid, notesHandler, notesRequest, publicNote, readNoteInput } from '../../src/notes-api.mjs';

export default notesHandler({
  async GET({ response, userId, base, key }) {
    const rows = await notesRequest(key, base, {
      query: { select: 'id,title,body', owner_id: `eq.${userId}`, order: 'created_at.asc,id.asc' },
    });
    return response.status(200).json(Array.isArray(rows) ? rows.map(publicNote) : []);
  },

  async POST({ request, response, userId, base, key }) {
    const { id = randomUUID(), title, body } = readNoteInput(request);
    if (!isUuid(id)) throw new HttpError(400, 'INVALID_NOTE_ID');
    await notesRequest(key, base, {
      method: 'POST',
      payload: { id: id.toLowerCase(), owner_id: userId, title, body },
    });
    return response.status(201).json({ id: id.toLowerCase() });
  },
});
