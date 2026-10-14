// 11단계: 기기 승인 요청과 결과 확인입니다. 로그인한 사람만 부를 수 있습니다.
// - POST /api/devices {"publicKey": <P-256 공개키 JWK>}: 공개키에서 16자리 기기 ID를 서버가 계산해
//   pending(승인 대기)으로 저장합니다. 브라우저가 보낸 상태·기기 ID·owner_id는 받지 않습니다.
// - GET /api/devices (헤더 X-Device-Id): 그 기기의 서버 기록 상태(pending·approved·revoked)를 돌려줍니다.
// 승인(approved)은 이 API로 할 수 없습니다. 학생이 Supabase SQL Editor에서 직접 바꿉니다
// (supabase/step11_devices.sql). 공개키 말고 개인키·토큰은 받거나 저장하지 않습니다.
import { createHash } from 'node:crypto';
import { DEVICE_ID, HttpError, requireUser, serverSettings } from './notes-api.mjs';

const B64URL_32 = /^[A-Za-z0-9_-]{43}$/u;

// P-256 공개키 JWK만 받습니다. 다른 이름(d 같은 개인키 값 등)이 있으면 거부합니다.
function readPublicKey(request) {
  let input = request.body;
  if (typeof input === 'string') {
    try {
      input = JSON.parse(input);
    } catch {
      throw new HttpError(400, 'INVALID_JSON');
    }
  }
  const jwk = input?.publicKey;
  if (!input || typeof input !== 'object' || Object.keys(input).join(',') !== 'publicKey'
      || !jwk || typeof jwk !== 'object' || Array.isArray(jwk)) {
    throw new HttpError(400, 'DEVICE_PUBLIC_KEY_REQUIRED');
  }
  const allowed = new Set(['kty', 'crv', 'x', 'y', 'ext', 'key_ops']);
  if (Object.keys(jwk).some(name => !allowed.has(name)) || jwk.kty !== 'EC' || jwk.crv !== 'P-256'
      || !B64URL_32.test(jwk.x ?? '') || !B64URL_32.test(jwk.y ?? '')) {
    throw new HttpError(400, 'DEVICE_PUBLIC_KEY_REQUIRED');
  }
  return { kty: 'EC', crv: 'P-256', x: jwk.x, y: jwk.y };
}

// 기기 ID = sha256("P-256.x.y")의 앞 16자리 16진수. 판정 계약의 deviceId와 같은 모양입니다.
export const deviceIdFor = ({ x, y }) => createHash('sha256').update(`P-256.${x}.${y}`, 'utf8').digest('hex').slice(0, 16);

async function devicesRequest(key, base, { method = 'GET', query, payload }) {
  const url = new URL('/rest/v1/device_registrations', base);
  url.search = new URLSearchParams(query).toString();
  const headers = { apikey: key, Accept: 'application/json' };
  if (payload) headers['Content-Type'] = 'application/json';
  if (method === 'POST') headers.Prefer = 'resolution=ignore-duplicates,return=minimal';
  let upstream;
  try {
    upstream = await fetch(url, { method, headers, body: payload ? JSON.stringify(payload) : undefined,
      signal: AbortSignal.timeout(8000) });
  } catch (error) {
    console.error(`devices: Supabase 요청 실패 (${error.name})`);
    throw new HttpError(502, 'DEVICES_UNAVAILABLE');
  }
  if (!upstream.ok) {
    console.error(`devices: Supabase 응답 ${upstream.status}`);
    throw new HttpError(502, 'DEVICES_UNAVAILABLE');
  }
  const text = await upstream.text();
  return text ? JSON.parse(text) : [];
}

async function findDevice(key, base, deviceId) {
  const rows = await devicesRequest(key, base, { query: { select: 'device_id,owner_id,status', device_id: `eq.${deviceId}` } });
  return Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
}

export async function devicesHandler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST'].includes(request.method)) {
    response.setHeader('Allow', 'GET, POST');
    return response.status(405).json({ error: 'METHOD_NOT_ALLOWED' });
  }
  try {
    const { base, key } = serverSettings();
    const userId = await requireUser(request, key);
    if (new URL(request.url ?? '', 'http://localhost').search) throw new HttpError(404, 'ROUTE_NOT_ALLOWED');
    if (request.method === 'POST') {
      const publicKey = readPublicKey(request);
      const deviceId = deviceIdFor(publicKey);
      // 새 기기는 pending으로만 넣습니다. 이미 있으면 덮어쓰지 않습니다(승인 상태를 바꾸지 않음).
      await devicesRequest(key, base, { method: 'POST',
        payload: { device_id: deviceId, owner_id: userId, public_key: publicKey, status: 'pending' } });
      const row = await findDevice(key, base, deviceId);
      if (!row || row.owner_id !== userId) throw new HttpError(409, 'DEVICE_OWNER_CONFLICT');
      return response.status(200).json({ deviceId, status: row.status });
    }
    const deviceId = request.headers?.['x-device-id'];
    if (typeof deviceId !== 'string' || !DEVICE_ID.test(deviceId)) throw new HttpError(400, 'DEVICE_ID_REQUIRED');
    const row = await findDevice(key, base, deviceId);
    // 남의 기기는 없는 기기와 똑같이 404로 답합니다.
    if (!row || row.owner_id !== userId) throw new HttpError(404, 'DEVICE_NOT_FOUND');
    return response.status(200).json({ deviceId, status: row.status });
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 401) response.setHeader('WWW-Authenticate', 'Bearer');
      if (error.status >= 400 && error.status !== 401) console.warn(`devices: 거부 ${error.code}`);
      return response.status(error.status).json({ error: error.code });
    }
    console.error(`devices: 처리 실패 (${error.name})`);
    return response.status(500).json({ error: 'INTERNAL_ERROR' });
  }
}
