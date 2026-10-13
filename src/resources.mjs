// 8단계: 자료실의 자원을 구역으로 나누고, 요청마다 서버가 구별할 수 있는 자원 ID를 붙입니다.
// - 내 메모(my_notes): 기존 /api/notes, /api/notes/:id. 자원 ID는 notes(목록·추가), notes/<id>(한 건)
// - 강사 공지(class_notices): notices(목록), notices/<id>(한 건). 아직 자료·API가 없어 이름만 정합니다.
// 자원 ID는 서버가 요청 동작·경로로만 만듭니다. 브라우저가 보낸 구역·역할·자원 이름은 쓰지 않습니다.
// 경로는 Vercel 주소(/api/notes/…)와 판정 계약의 경로 모양(/notes/…)을 같은 자원으로 봅니다.
export const ZONES = Object.freeze({
  MY_NOTES: 'my_notes',
  CLASS_NOTICES: 'class_notices',
});

const COLLECTIONS = Object.freeze({
  notes: ZONES.MY_NOTES,
  notices: ZONES.CLASS_NOTICES,
});

const ITEM_ID = /^[A-Za-z0-9_-]{1,64}$/u;
const METHODS = new Set(['GET', 'POST', 'PUT', 'DELETE']);

// { zone, resourceId, route }을 돌려줍니다. 구역에 속하지 않는 요청은 null입니다.
export function resourceFor(method, path) {
  if (typeof method !== 'string' || !METHODS.has(method) || typeof path !== 'string') return null;
  const segments = path.split('?')[0].split('/').filter(Boolean);
  if (segments[0] === 'api') segments.shift();
  const [collection, id, ...rest] = segments;
  if (!Object.hasOwn(COLLECTIONS, collection ?? '') || rest.length) return null;
  const zone = COLLECTIONS[collection];
  if (id === undefined) {
    return Object.freeze({ zone, resourceId: collection, route: `${method} /${collection}` });
  }
  if (!ITEM_ID.test(id)) return null;
  return Object.freeze({
    zone,
    resourceId: `${collection}/${id.toLowerCase()}`,
    route: `${method} /${collection}/:id`,
  });
}
