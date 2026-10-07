// GET·PUT·DELETE /api/notes/:id 입니다. 로그인한 사람만 부를 수 있습니다.
// 4단계: 확인된 사용자 ID와 DB의 owner_id가 같은 행에만 적용합니다. 다른 사람의 메모와
// 없는 메모는 똑같이 404로 거부해 그 메모가 있는지도 알려 주지 않습니다.
// URL·본문의 owner_id는 믿지 않으며, 수정으로 소유자를 바꾸려 하면 403으로 거부합니다.
import {
  HttpError, isUuid, notesHandler, notesRequest, publicNote, readNoteInput, requestsOtherOwner,
} from '../../src/notes-api.mjs';

function noteId(request) {
  const id = request.query?.id;
  if (!isUuid(id)) throw new HttpError(404, 'NOTE_NOT_FOUND');
  return id.toLowerCase();
}

// 이 id이면서 owner_id가 확인된 사용자인 행만 고릅니다.
const ownRow = (request, userId) => ({ id: `eq.${noteId(request)}`, owner_id: `eq.${userId}` });

function onlyOwnRow(rows, userId) {
  if (!Array.isArray(rows) || !rows.length) throw new HttpError(404, 'NOTE_NOT_FOUND');
  if (rows.length !== 1 || rows[0].owner_id !== userId) {
    console.error('notes: 소유자 대조 결과가 예상과 다릅니다.');
    throw new HttpError(500, 'INTERNAL_ERROR');
  }
  return publicNote(rows[0]);
}

export default notesHandler({
  async GET({ request, response, userId, base, key }) {
    const rows = await notesRequest(key, base, {
      query: { select: 'id,title,body,owner_id', ...ownRow(request, userId) },
    });
    return response.status(200).json(onlyOwnRow(rows, userId));
  },

  async PUT({ request, response, userId, base, key }) {
    const filter = ownRow(request, userId);
    if (requestsOtherOwner(request, userId)) throw new HttpError(403, 'OWNER_CHANGE_FORBIDDEN');
    const { title, body } = readNoteInput(request);
    // 기존 행: 필터가 owner_id = 본인인 행만 고칩니다. 새 행: owner_id를 본인으로 다시 적고 돌려받아 확인합니다.
    const rows = await notesRequest(key, base, {
      method: 'PATCH',
      query: { ...filter, select: 'id,title,body,owner_id' },
      payload: { title, body, owner_id: userId, updated_at: new Date().toISOString() },
      returning: true,
    });
    return response.status(200).json(onlyOwnRow(rows, userId));
  },

  async DELETE({ request, response, userId, base, key }) {
    const rows = await notesRequest(key, base, {
      method: 'DELETE',
      query: { ...ownRow(request, userId), select: 'id,owner_id' },
      returning: true,
    });
    onlyOwnRow(rows, userId);
    return response.status(204).end();
  },
});
