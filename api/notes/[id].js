// 3단계: GET·PUT·DELETE /api/notes/:id 입니다. 로그인한 사람만 부를 수 있습니다.
// 아직 owner_id를 대조하지 않으므로 다른 계정의 메모도 id만 알면 읽고 바꿀 수 있습니다.
// 이 허점은 4단계에서 막습니다.
import { HttpError, isUuid, notesHandler, notesRequest, publicNote, readNoteInput } from '../../src/notes-api.mjs';

function noteId(request) {
  const id = request.query?.id;
  if (!isUuid(id)) throw new HttpError(404, 'NOTE_NOT_FOUND');
  return id.toLowerCase();
}

function onlyRow(rows) {
  if (!Array.isArray(rows) || !rows.length) throw new HttpError(404, 'NOTE_NOT_FOUND');
  return publicNote(rows[0]);
}

export default notesHandler({
  async GET({ request, response, base, key }) {
    const rows = await notesRequest(key, base, {
      query: { select: 'id,title,body', id: `eq.${noteId(request)}` },
    });
    return response.status(200).json(onlyRow(rows));
  },

  async PUT({ request, response, base, key }) {
    const id = noteId(request);
    const { title, body } = readNoteInput(request);
    const rows = await notesRequest(key, base, {
      method: 'PATCH',
      query: { id: `eq.${id}`, select: 'id,title,body' },
      payload: { title, body, updated_at: new Date().toISOString() },
      returning: true,
    });
    return response.status(200).json(onlyRow(rows));
  },

  async DELETE({ request, response, base, key }) {
    const rows = await notesRequest(key, base, {
      method: 'DELETE',
      query: { id: `eq.${noteId(request)}`, select: 'id' },
      returning: true,
    });
    onlyRow(rows);
    return response.status(204).end();
  },
});
