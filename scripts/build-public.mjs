import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deploymentIdentity } from './deployment-identity.mjs';

const root = resolve(import.meta.dirname, '..');
const source = resolve(root, 'data.json');
const output = resolve(root, 'public', 'data.json');
const config = JSON.parse(await readFile(resolve(root, 'aleph.config.json'), 'utf8'));
await mkdir(resolve(root, 'public'), { recursive: true });
if (config.step === 1) {
  const data = JSON.parse(await readFile(source, 'utf8'));
  if (!Array.isArray(data.notes)) {
    throw new Error('실습용 공개 자료 형식을 확인하세요. 실제 학생 자료를 넣으면 안 됩니다.');
  }
  await copyFile(source, output);
  console.log('실습용 공개 자료를 public/data.json에 복사했습니다.');
} else {
  // 2단계부터 메모는 서버 API(/api/notes)로만 읽습니다. 정적 파일에 메모를 두면 빌드를 멈춥니다.
  const published = JSON.parse(await readFile(output, 'utf8'));
  if (!Array.isArray(published.notes) || published.notes.length) {
    throw new Error('2단계부터 public/data.json에 메모를 남기지 마세요.');
  }
  console.log('public/data.json에 메모가 없음을 확인했습니다. 메모는 /api/notes로 읽습니다.');
}
if (!process.argv.includes('--local')) {
  const identity = deploymentIdentity(process.env, config);
  await writeFile(resolve(root, 'public', 'aleph.json'),
    `${JSON.stringify(identity, null, 2)}\n`, 'utf8');
  console.log('배포 저장소·커밋·주소를 public/aleph.json에 기록했습니다.');
}
