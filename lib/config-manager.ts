/**
 * config-manager.ts
 *
 * 카메라, 프리셋, 설정을 사용자별로 분리하여 저장/조회한다.
 *
 * ── 저장 방식 (STORAGE_MODE 환경변수로 선택) ──────────────────
 *
 *   STORAGE_MODE=file  (기본값)
 *     사용자별로 별도 디렉토리에 JSON 파일로 저장.
 *     BASE_DIR/<userId>/cameras.json
 *     BASE_DIR/<userId>/presets.json
 *     BASE_DIR/<userId>/settings.json
 *
 *     BASE_DIR 우선순위:
 *       1. PTZ_DATA_DIR 환경변수 (Electron: app.getPath('userData') 자동 주입)
 *          Windows : C:\Users\<user>\AppData\Roaming\ptzcontroller_admin\
 *          macOS   : ~/Library/Application Support/ptzcontroller_admin/
 *          Linux   : ~/.config/ptzcontroller_admin/
 *       2. 공유 경로 환경변수 (웹 서버 배포 시 중앙 공유 스토리지 지정)
 *          PTZ_SHARED_DATA_DIR=C:\ProgramData\PTZController\Setting\
 *       3. 폴백 (개발/단순 배포): process.cwd()/data/
 *
 *   STORAGE_MODE=db
 *     Prisma(PostgreSQL)에 저장 (UserConfig 모델 필요).
 *     다중 서버/클라우드 배포 환경에서 권장.
 *     ※ DB 모드 사용 시 prisma/schema.prisma 에 UserConfig 모델을 추가하고
 *       `npx prisma migrate dev` 를 실행해야 한다.
 *
 * ── 오프라인/Desktop 동작 ─────────────────────────────────────
 *   userId 파라미터에 'offline' 을 전달하면 항상 file 모드로 동작.
 *   (DB 연결 없이도 설정 저장/조회 가능)
 *
 * ── 하위 호환성 ──────────────────────────────────────────────
 *   STORAGE_MODE 미설정 또는 'file' 이면 기존 동작과 동일하게
 *   파일 기반으로 동작하되, userId를 경로에 포함해 사용자별로 분리한다.
 *   userId 없이 호출 시('shared') 기존 공유 경로(./data/)를 사용하므로
 *   기존 데이터를 그대로 유지할 수 있다.
 */

import fs from 'fs';
import path from 'path';
import { CameraConfig, PresetConfig, AppSettings } from './types';

// ── 저장 모드 ──────────────────────────────────────────────────
export type StorageMode = 'file' | 'db';

export function getStorageMode(): StorageMode {
  const mode = process.env.STORAGE_MODE?.toLowerCase();
  return mode === 'db' ? 'db' : 'file';
}

// ── 파일 저장 기본 디렉토리 결정 ──────────────────────────────
function getBaseDir(): string {
  // 1. Electron이 주입하는 userData 경로
  if (process.env.PTZ_DATA_DIR) return process.env.PTZ_DATA_DIR;
  // 2. 웹 서버 배포 시 중앙 공유 스토리지
  if (process.env.PTZ_SHARED_DATA_DIR) return process.env.PTZ_SHARED_DATA_DIR;
  // 3. 폴백
  return path.join(process.cwd(), 'data');
}

/**
 * 사용자별 데이터 디렉토리 경로 반환
 * @param userId  사용자 ID. 'shared' 이면 공유(기존) 경로, 'offline' 이면 offline 전용 경로.
 */
function getUserDataDir(userId?: string): string {
  const base = getBaseDir();

  // Desktop EXE: PTZ_FORCE_SHARED=true 이면 userId 무시 → BASE_DIR 바로 사용
  // → C:\ProgramData\PTZController\cameras.json 으로 고정
  if (process.env.PTZ_FORCE_SHARED === 'true') return base;

  if (!userId || userId === 'shared') {
    // 하위 호환: userId 없으면 기존 방식 (BASE_DIR 바로 사용)
    return base;
  }
  // 사용자별 하위 디렉토리
  // userId에 경로 구분자가 들어오면 안전하게 치환
  const safeId = userId.replace(/[/\\:*?"<>|]/g, '_');
  return path.join(base, 'users', safeId);
}

function getFilePaths(userId?: string) {
  const DATA_DIR = getUserDataDir(userId);
  return {
    DATA_DIR,
    CAMERAS_FILE:  path.join(DATA_DIR, 'cameras.json'),
    PRESETS_FILE:  path.join(DATA_DIR, 'presets.json'),
    SETTINGS_FILE: path.join(DATA_DIR, 'settings.json'),
  };
}

const DEFAULT_SETTINGS: AppSettings = {
  defaultProtocol: 'pelcod',
  proxyPort:       9902,
  logLevel:        'info',
  theme:           'dark',
};

// ─── 인메모리 캐시 ────────────────────────────────────────────
//
// 목적: 매 API 요청마다 파일 I/O 를 반복하는 비용 절감
// TTL:  60초 (환경변수 PTZ_CACHE_TTL_S 로 조정 가능)
// 범위: 파일 모드 전용. DB 모드는 Prisma 커넥션 풀이 캐싱을 담당.
//
// 구조: Map<cacheKey, { data, expireAt }>
//   cacheKey = `${userId}:cameras` | `${userId}:presets` | `${userId}:settings`

const CACHE_TTL_MS = (Number(process.env.PTZ_CACHE_TTL_S ?? 60)) * 1000;

interface CacheEntry<T> { data: T; expireAt: number; }
const _cache = new Map<string, CacheEntry<unknown>>();

function cacheGet<T>(key: string): T | undefined {
  const entry = _cache.get(key) as CacheEntry<T> | undefined;
  if (!entry) return undefined;
  if (Date.now() > entry.expireAt) { _cache.delete(key); return undefined; }
  return entry.data;
}

function cacheSet<T>(key: string, data: T): void {
  _cache.set(key, { data, expireAt: Date.now() + CACHE_TTL_MS });
}

function cacheInvalidate(userId: string): void {
  for (const k of _cache.keys()) {
    if (k.startsWith(`${userId}:`)) _cache.delete(k);
  }
}

// ─── 파일 I/O 헬퍼 (캐시 적용) ──────────────────────────────

function ensureDataDir(userId?: string): void {
  const { DATA_DIR } = getFilePaths(userId);
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJsonFile<T>(filePath: string, defaultValue: T, userId?: string, cacheKey?: string): T {
  // 캐시 히트
  if (cacheKey) {
    const cached = cacheGet<T>(cacheKey);
    if (cached !== undefined) return cached;
  }

  ensureDataDir(userId);
  let result = defaultValue;
  try {
    if (fs.existsSync(filePath)) {
      result = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
    }
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error);
  }

  if (cacheKey) cacheSet(cacheKey, result);
  return result;
}

function writeJsonFile<T>(filePath: string, data: T, userId?: string, cacheKey?: string): void {
  ensureDataDir(userId);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  // 쓰기 즉시 캐시 갱신 (다음 읽기 전까지 최신 데이터 유지)
  if (cacheKey) cacheSet(cacheKey, data);
}

// ── DB 모드 동적 임포트 헬퍼 ─────────────────────────────────
// DB 모드는 런타임에만 prisma를 사용하므로 동적 require로 순환 참조 방지
let _prisma: import('./db').PrismaClientType | null = null;
async function getPrisma() {
  if (!_prisma) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _prisma = require('./db').prisma;
  }
  return _prisma!;
}

// ── SQLite 오프라인 동기화 헬퍼 ────────────────────────────────
// Desktop(Electron) 전용. PTZ_DESKTOP_MODE=true 일 때만 활성화.
// non-critical: 실패해도 동작에 영향 없음.
const IS_DESKTOP = process.env.PTZ_DESKTOP_MODE === 'true';

function syncToOfflineSQLite(userId: string, key: string, value: unknown): void {
  if (!IS_DESKTOP) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { saveOfflineConfig } = require('./offline-db') as {
      saveOfflineConfig: (userId: string, key: string, value: string) => void;
    };
    saveOfflineConfig(userId, key, JSON.stringify(value));
  } catch { /* non-critical */ }
}

function readFromOfflineSQLite<T>(userId: string, key: string, fallback: T): T {
  if (!IS_DESKTOP) return fallback;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getOfflineConfig } = require('./offline-db') as {
      getOfflineConfig: (userId: string, key: string) => string | null;
    };
    const raw = getOfflineConfig(userId, key);
    if (raw !== null) return JSON.parse(raw) as T;
  } catch { /* non-critical */ }
  return fallback;
}

// ── DB 모드: UserConfig 테이블 읽기/쓰기 ──────────────────────
async function readDbConfig<T>(
  userId: string,
  key: 'cameras' | 'presets' | 'settings',
  defaultValue: T
): Promise<T> {
  try {
    const prisma = await getPrisma();
    const row = await (prisma as any).userConfig.findUnique({
      where: { userId_key: { userId, key } },
    });
    if (row?.value) return JSON.parse(row.value) as T;
  } catch (e) {
    console.error(`[ConfigManager DB] read ${key} failed:`, e);
  }
  return defaultValue;
}

async function writeDbConfig(
  userId: string,
  key: 'cameras' | 'presets' | 'settings',
  data: unknown
): Promise<void> {
  try {
    const prisma = await getPrisma();
    await (prisma as any).userConfig.upsert({
      where: { userId_key: { userId, key } },
      update: { value: JSON.stringify(data), updatedAt: new Date() },
      create: { userId, key, value: JSON.stringify(data) },
    });
  } catch (e) {
    console.error(`[ConfigManager DB] write ${key} failed:`, e);
    throw e;
  }
}

// ─── Camera Configuration ──────────────────────────────────

export async function getCamerasAsync(userId?: string): Promise<CameraConfig[]> {
  const uid = userId ?? 'shared';
  if (getStorageMode() === 'db' && uid !== 'offline') {
    try {
      const prisma = await getPrisma();
      const row = await (prisma as any).userConfig.findUnique({
        where: { userId_key: { userId: uid, key: 'cameras' } },
      });
      const cameras: CameraConfig[] = row?.value ? JSON.parse(row.value) : [];
      // Desktop: Neon이 비어있으면 SQLite 확인 → 오프라인→온라인 전환 후 자동 업로드
      if (IS_DESKTOP && cameras.length === 0) {
        const sqliteCameras = readFromOfflineSQLite<CameraConfig[]>(uid, 'cameras', []);
        if (sqliteCameras.length > 0) {
          // SQLite → Neon 동기화 (오프라인 데이터를 클라우드에 업로드)
          await writeDbConfig(uid, 'cameras', sqliteCameras);
          return sqliteCameras;
        }
      }
      // DB 성공 → SQLite 동기화. Desktop은 파일 사용 안함.
      syncToOfflineSQLite(uid, 'cameras', cameras);
      if (!IS_DESKTOP) writeJsonFile(getFilePaths(uid).CAMERAS_FILE, cameras, uid, `${uid}:cameras`);
      return cameras;
    } catch {
      // DB 접속 불가 → SQLite 우선. Desktop은 파일 fallback 없음.
      console.warn('[ConfigManager] DB unavailable, falling back to SQLite/file (cameras)');
      const fileFallback = IS_DESKTOP ? [] : readJsonFile<CameraConfig[]>(getFilePaths(uid).CAMERAS_FILE, [], uid, `${uid}:cameras`);
      return readFromOfflineSQLite<CameraConfig[]>(uid, 'cameras', fileFallback);
    }
  }
  // file 모드: Desktop은 SQLite, 웹서버는 파일
  if (IS_DESKTOP) return readFromOfflineSQLite<CameraConfig[]>(uid, 'cameras', []);
  return readJsonFile<CameraConfig[]>(getFilePaths(uid).CAMERAS_FILE, [], uid, `${uid}:cameras`);
}

export async function saveCameraAsync(camera: CameraConfig, userId?: string): Promise<CameraConfig> {
  const uid = userId ?? 'shared';
  const cameras = await getCamerasAsync(uid);
  const index = cameras.findIndex(c => c.id === camera.id);
  const now = new Date().toISOString();

  const updated = index >= 0
    ? cameras.map((c, i) => i === index ? { ...camera, updatedAt: now } : c)
    : [...cameras, { ...camera, createdAt: now, updatedAt: now }];

  if (getStorageMode() === 'db' && uid !== 'offline') {
    await writeDbConfig(uid, 'cameras', updated);
    syncToOfflineSQLite(uid, 'cameras', updated);
    if (!IS_DESKTOP) writeJsonFile(getFilePaths(uid).CAMERAS_FILE, updated, uid, `${uid}:cameras`);
  } else {
    syncToOfflineSQLite(uid, 'cameras', updated);
    if (!IS_DESKTOP) writeJsonFile(getFilePaths(uid).CAMERAS_FILE, updated, uid, `${uid}:cameras`);
  }
  return camera;
}

export async function deleteCameraAsync(id: string, userId?: string): Promise<boolean> {
  const uid = userId ?? 'shared';
  const cameras = await getCamerasAsync(uid);
  const filtered = cameras.filter(c => c.id !== id);
  const deleted = filtered.length !== cameras.length;

  if (getStorageMode() === 'db' && uid !== 'offline') {
    await writeDbConfig(uid, 'cameras', filtered);
    syncToOfflineSQLite(uid, 'cameras', filtered);
    if (!IS_DESKTOP) writeJsonFile(getFilePaths(uid).CAMERAS_FILE, filtered, uid, `${uid}:cameras`);
  } else {
    syncToOfflineSQLite(uid, 'cameras', filtered);
    if (!IS_DESKTOP) writeJsonFile(getFilePaths(uid).CAMERAS_FILE, filtered, uid, `${uid}:cameras`);
  }
  return deleted;
}

// ─── Presets Configuration ────────────────────────────────

export async function getPresetsAsync(cameraId?: string, userId?: string): Promise<PresetConfig[]> {
  const uid = userId ?? 'shared';
  let presets: PresetConfig[];

  if (getStorageMode() === 'db' && uid !== 'offline') {
    try {
      const prisma = await getPrisma();
      const row = await (prisma as any).userConfig.findUnique({
        where: { userId_key: { userId: uid, key: 'presets' } },
      });
      presets = row?.value ? JSON.parse(row.value) : [];
      // Desktop: Neon이 비어있으면 SQLite 확인 → 자동 업로드
      if (IS_DESKTOP && presets.length === 0) {
        const sqlitePresets = readFromOfflineSQLite<PresetConfig[]>(uid, 'presets', []);
        if (sqlitePresets.length > 0) {
          await writeDbConfig(uid, 'presets', sqlitePresets);
          presets = sqlitePresets;
        }
      } else {
        syncToOfflineSQLite(uid, 'presets', presets);
        if (!IS_DESKTOP) writeJsonFile(getFilePaths(uid).PRESETS_FILE, presets, uid, `${uid}:presets`);
      }
    } catch {
      console.warn('[ConfigManager] DB unavailable, falling back to SQLite/file (presets)');
      const fileFallback = IS_DESKTOP ? [] : readJsonFile<PresetConfig[]>(getFilePaths(uid).PRESETS_FILE, [], uid, `${uid}:presets`);
      presets = readFromOfflineSQLite<PresetConfig[]>(uid, 'presets', fileFallback);
    }
  } else {
    presets = IS_DESKTOP
      ? readFromOfflineSQLite<PresetConfig[]>(uid, 'presets', [])
      : readJsonFile<PresetConfig[]>(getFilePaths(uid).PRESETS_FILE, [], uid, `${uid}:presets`);
  }
  return cameraId ? presets.filter(p => p.cameraId === cameraId) : presets;
}

export async function savePresetAsync(preset: PresetConfig, userId?: string): Promise<PresetConfig> {
  const uid = userId ?? 'shared';
  const presets = await getPresetsAsync(undefined, uid);
  const index = presets.findIndex(p => p.id === preset.id);
  const updated = index >= 0
    ? presets.map((p, i) => i === index ? preset : p)
    : [...presets, preset];

  if (getStorageMode() === 'db' && uid !== 'offline') {
    await writeDbConfig(uid, 'presets', updated);
    syncToOfflineSQLite(uid, 'presets', updated);
    if (!IS_DESKTOP) writeJsonFile(getFilePaths(uid).PRESETS_FILE, updated, uid, `${uid}:presets`);
  } else {
    syncToOfflineSQLite(uid, 'presets', updated);
    if (!IS_DESKTOP) writeJsonFile(getFilePaths(uid).PRESETS_FILE, updated, uid, `${uid}:presets`);
  }
  return preset;
}

export async function deletePresetAsync(id: string, userId?: string): Promise<boolean> {
  const uid = userId ?? 'shared';
  const presets = await getPresetsAsync(undefined, uid);
  const filtered = presets.filter(p => p.id !== id);
  const deleted = filtered.length !== presets.length;

  if (getStorageMode() === 'db' && uid !== 'offline') {
    await writeDbConfig(uid, 'presets', filtered);
    syncToOfflineSQLite(uid, 'presets', filtered);
    if (!IS_DESKTOP) writeJsonFile(getFilePaths(uid).PRESETS_FILE, filtered, uid, `${uid}:presets`);
  } else {
    syncToOfflineSQLite(uid, 'presets', filtered);
    if (!IS_DESKTOP) writeJsonFile(getFilePaths(uid).PRESETS_FILE, filtered, uid, `${uid}:presets`);
  }
  return deleted;
}

// ─── App Settings ─────────────────────────────────────────

export async function getSettingsAsync(userId?: string): Promise<AppSettings> {
  const uid = userId ?? 'shared';
  if (getStorageMode() === 'db' && uid !== 'offline') {
    try {
      const prisma = await getPrisma();
      const row = await (prisma as any).userConfig.findUnique({
        where: { userId_key: { userId: uid, key: 'settings' } },
      });
      const settings: AppSettings = row?.value ? JSON.parse(row.value) : DEFAULT_SETTINGS;
      // Desktop: Neon에 row가 없으면 SQLite 확인 → 자동 업로드
      if (IS_DESKTOP && !row?.value) {
        const sqliteSettings = readFromOfflineSQLite<AppSettings | null>(uid, 'settings', null);
        if (sqliteSettings !== null) {
          await writeDbConfig(uid, 'settings', sqliteSettings);
          return sqliteSettings;
        }
      }
      syncToOfflineSQLite(uid, 'settings', settings);
      if (!IS_DESKTOP) writeJsonFile(getFilePaths(uid).SETTINGS_FILE, settings, uid, `${uid}:settings`);
      return settings;
    } catch {
      console.warn('[ConfigManager] DB unavailable, falling back to SQLite/file (settings)');
      const fileFallback = IS_DESKTOP ? DEFAULT_SETTINGS : readJsonFile<AppSettings>(getFilePaths(uid).SETTINGS_FILE, DEFAULT_SETTINGS, uid, `${uid}:settings`);
      return readFromOfflineSQLite<AppSettings>(uid, 'settings', fileFallback);
    }
  }
  if (IS_DESKTOP) return readFromOfflineSQLite<AppSettings>(uid, 'settings', DEFAULT_SETTINGS);
  return readJsonFile<AppSettings>(getFilePaths(uid).SETTINGS_FILE, DEFAULT_SETTINGS, uid, `${uid}:settings`);
}

export async function saveSettingsAsync(settings: Partial<AppSettings>, userId?: string): Promise<AppSettings> {
  const uid = userId ?? 'shared';
  const current = await getSettingsAsync(uid);
  const updated = { ...current, ...settings };

  if (getStorageMode() === 'db' && uid !== 'offline') {
    await writeDbConfig(uid, 'settings', updated);
    syncToOfflineSQLite(uid, 'settings', updated);
    if (!IS_DESKTOP) writeJsonFile(getFilePaths(uid).SETTINGS_FILE, updated, uid, `${uid}:settings`);
  } else {
    syncToOfflineSQLite(uid, 'settings', updated);
    if (!IS_DESKTOP) writeJsonFile(getFilePaths(uid).SETTINGS_FILE, updated, uid, `${uid}:settings`);
  }
  return updated;
}

// ─── 하위 호환 동기 API (기존 코드가 import 하는 함수명 유지) ─

/** @deprecated async 버전(getCamerasAsync) 사용을 권장 */
export function getCameras(userId?: string): CameraConfig[] {
  const uid = userId ?? 'shared';
  return readJsonFile<CameraConfig[]>(getFilePaths(uid).CAMERAS_FILE, [], uid, `${uid}:cameras`);
}

/** @deprecated async 버전(saveCameraAsync) 사용을 권장 */
export function saveCamera(camera: CameraConfig, userId?: string): CameraConfig {
  const uid = userId ?? 'shared';
  const cameras = getCameras(uid);
  const index = cameras.findIndex(c => c.id === camera.id);
  const now = new Date().toISOString();

  if (index >= 0) {
    cameras[index] = { ...camera, updatedAt: now };
  } else {
    cameras.push({ ...camera, createdAt: now, updatedAt: now });
  }
  writeJsonFile(getFilePaths(uid).CAMERAS_FILE, cameras, uid, `${uid}:cameras`);
  return camera;
}

/** @deprecated async 버전(deleteCameraAsync) 사용을 권장 */
export function deleteCamera(id: string, userId?: string): boolean {
  const uid = userId ?? 'shared';
  const cameras = getCameras(uid);
  const filtered = cameras.filter(c => c.id !== id);
  writeJsonFile(getFilePaths(uid).CAMERAS_FILE, filtered, uid, `${uid}:cameras`);
  return filtered.length !== cameras.length;
}

/** @deprecated */
export function getPresets(cameraId?: string, userId?: string): PresetConfig[] {
  const uid = userId ?? 'shared';
  const presets = readJsonFile<PresetConfig[]>(getFilePaths(uid).PRESETS_FILE, [], uid);
  return cameraId ? presets.filter(p => p.cameraId === cameraId) : presets;
}

/** @deprecated */
export function savePreset(preset: PresetConfig, userId?: string): PresetConfig {
  const uid = userId ?? 'shared';
  const presets = getPresets(undefined, uid);
  const index = presets.findIndex(p => p.id === preset.id);
  if (index >= 0) { presets[index] = preset; } else { presets.push(preset); }
  writeJsonFile(getFilePaths(uid).PRESETS_FILE, presets, uid);
  return preset;
}

/** @deprecated */
export function deletePreset(id: string, userId?: string): boolean {
  const uid = userId ?? 'shared';
  const presets = getPresets(undefined, uid);
  const filtered = presets.filter(p => p.id !== id);
  writeJsonFile(getFilePaths(uid).PRESETS_FILE, filtered, uid);
  return filtered.length !== presets.length;
}

/** @deprecated */
export function getSettings(userId?: string): AppSettings {
  const uid = userId ?? 'shared';
  return readJsonFile<AppSettings>(getFilePaths(uid).SETTINGS_FILE, DEFAULT_SETTINGS, uid);
}

/** @deprecated */
export function saveSettings(settings: Partial<AppSettings>, userId?: string): AppSettings {
  const uid = userId ?? 'shared';
  const updated = { ...getSettings(uid), ...settings };
  writeJsonFile(getFilePaths(uid).SETTINGS_FILE, updated, uid);
  return updated;
}
