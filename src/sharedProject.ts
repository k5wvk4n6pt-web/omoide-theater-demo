import type {StoredProject} from './draftStore';

const endpoint = 'https://omoide-theater-share.th-1043.chatgpt.site/project';
const signature = 'OMOIDE1\n';
const limit = 80 * 1024 * 1024;
const manifestLimit = 2 * 1024 * 1024;
const tokenPattern = /^[0-9a-f]{64}$/;

type Part = {size: number; type: string};
type Archive = {
 version: number;
 savedAt: string;
 settings: StoredProject['settings'];
 photos: {meta: StoredProject['photos'][number]['meta']; part: Part}[];
 audio?: {name: string; seconds: number; part: Part};
 switchFiles: {id: string; part: Part}[];
};

export class SharedProjectConflict extends Error {}
export function newShareToken() {
 return Array.from(crypto.getRandomValues(new Uint8Array(32)), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function shareTokenFromHash(hash: string) {
 const token = hash.slice('#share='.length);
 return hash.startsWith('#share=') && tokenPattern.test(token) ? token : null;
}

export function encodeProject(project: StoredProject): Blob {
 const parts: Blob[] = [];
 function add(blob: Blob): Part {
  if (!blob.size) throw Error('空の素材があります。ファイルを選び直してください。');
  parts.push(blob);
  return {size: blob.size, type: blob.type};
 }
 const header: Archive = {
  version: project.version,
  savedAt: project.savedAt,
  settings: project.settings,
  photos: project.photos.map(({meta, blob}) => ({meta, part: add(blob)})),
  audio: project.audio && {name: project.audio.name, seconds: project.audio.seconds, part: add(project.audio.blob)},
  switchFiles: (project.switchFiles ?? []).map(({id, blob}) => ({id, part: add(blob)})),
 };
 const manifest = new Blob([JSON.stringify(header)]);
 if (manifest.size > manifestLimit) throw Error('編集設定の容量が大きすぎます。');
 const blob = new Blob([signature, String(manifest.size).padStart(8, '0'), manifest, ...parts], {type: 'application/octet-stream'});
 if (blob.size > limit) throw Error('共有できる作品の容量は80 MBまでです。写真や動画の容量を減らしてください。');
 return blob;
}

function validRecord(value: unknown): value is Record<string, unknown> {
 return !!value && typeof value === 'object' && !Array.isArray(value);
}

export async function decodeProject(blob: Blob): Promise<StoredProject> {
 const fail = () => Error('共有作品のデータを読み込めませんでした。');
 const prefix = await blob.slice(0, 16).text();
 if (!prefix.startsWith(signature) || !/^\d{8}$/.test(prefix.slice(8)) || blob.size > limit) throw fail();
 const manifestSize = Number(prefix.slice(8));
 let offset = 16 + manifestSize;
 if (manifestSize <= 0 || manifestSize > manifestLimit || offset > blob.size) throw fail();
 let header: Archive;
 try { header = JSON.parse(await blob.slice(16, offset).text()); }
 catch { throw fail(); }
 if (!validRecord(header) || header.version !== 1 || typeof header.savedAt !== 'string' || !validRecord(header.settings) ||
     !Array.isArray(header.photos) || !Array.isArray(header.switchFiles)) throw fail();
 const settings = header.settings;
 if (typeof settings.title !== 'string' || typeof settings.ending !== 'string' ||
     !['duration','musicSeconds','volume','bgmStart','bgmOffset'].every(key => Number.isFinite(settings[key])) ||
     !Array.isArray(settings.musicSwitches) || !settings.musicSwitches.every(item => validRecord(item) &&
       typeof item.id === 'string' && typeof item.name === 'string' &&
       ['seconds','start','offset','volume','fade'].every(key => Number.isFinite(item[key])))) throw fail();
 function take(part: Part) {
  if (!validRecord(part) || !Number.isSafeInteger(part.size) || part.size < 1 || typeof part.type !== 'string') throw fail();
  const end = offset + part.size;
  if (end > blob.size) throw fail();
  const result = blob.slice(offset, end, part.type);
  offset = end;
  return result;
 }
 const photos = header.photos.map(item => {
  if (!validRecord(item) || !validRecord(item.meta) || typeof item.meta.id !== 'string' || typeof item.meta.name !== 'string' ||
      typeof item.meta.duration !== 'number' || !Number.isFinite(item.meta.duration) || item.meta.duration <= 0 ||
      (item.meta.caption !== undefined && typeof item.meta.caption !== 'string') ||
      (item.meta.subtitles !== undefined && (!Array.isArray(item.meta.subtitles) ||
       !item.meta.subtitles.every(cue => validRecord(cue) && typeof cue.id === 'string' &&
         typeof cue.text === 'string' && Number.isFinite(cue.start) && Number.isFinite(cue.end))))) throw fail();
  return {meta: item.meta, blob: take(item.part)};
 });
 const source = header.audio;
 if (source !== undefined && (!validRecord(source) || typeof source.name !== 'string' || !Number.isFinite(source.seconds))) throw fail();
 const audio = source && {name: source.name, seconds: source.seconds, blob: take(source.part)};
 const switchFiles = header.switchFiles.map(item => {
  if (!validRecord(item) || typeof item.id !== 'string') throw fail();
  return {id: item.id, blob: take(item.part)};
 });
 if (offset !== blob.size) throw fail();
 return {version: header.version, savedAt: header.savedAt, settings, photos, audio, switchFiles};
}

function revision(response: Response) {
 const etag = response.headers.get('ETag');
 if (!etag) throw Error('共有先の保存状態を確認できませんでした。');
 return etag;
}

async function requestProject(token: string, options: RequestInit = {}) {
 const headers = new Headers(options.headers);
 headers.set('Authorization', 'Bearer ' + token);
 let response: Response;
 try {
  response = await fetch(endpoint, {...options, headers, cache: 'no-store', redirect: 'error'});
 } catch {
  throw Error('共有先に接続できませんでした。通信状態を確認して、もう一度お試しください。');
 }
 if (response.status === 412) throw new SharedProjectConflict('別の人が先に保存しました。編集中の内容はこの画面に残っています。');
 if (!response.ok) {
  const problem = await response.json().catch(() => null);
  throw Error(problem?.message ?? '共有作品を処理できませんでした。');
 }
 return response;
}

export async function loadSharedProject(token: string) {
 const response = await requestProject(token);
 const etag = revision(response);
 return {etag, project: await decodeProject(await response.blob())};
}

export async function saveSharedProject(token: string, etag: string | null, project: StoredProject) {
 const body = encodeProject(project);
 const headers = new Headers({'Content-Type': 'application/octet-stream'});
 if (etag) headers.set('If-Match', etag);
 else headers.set('If-None-Match', '*');
 return revision(await requestProject(token, {method: 'PUT', headers, body}));
}
