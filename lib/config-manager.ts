/**
 * config-manager.ts
 *
 * 카메라, 프리셋, 설정을 사용자별로 분리하여 저장/조회한다.
 *
 * ── 저장 방식 ────────────────────────────────────────────────
 *
 *   DB_TYPE 환경변수로 기본 저장소를 선택한다.
 *
 *   DB_TYPE=sqlite  (기본값)
 *     SQLite(offline-db.ts user_configs 테이블)에만 저장.
 *     STORAGE_MODE 값은 무시된다.
 *     서버 1대(단독 배포)에 적합.
 *
 *   DB_TYPE=neon
 *     Neon(PostgreSQL) Prisma(UserConfig 모델)가 기본 저장소.
 *     STORAGE_MODE 에 따라 SQLite 백업 여부가 결정된다.
 *       STORAGE_MODE=on  → Neon 저장 + SQLite에도 동기화 (이중 저장)
 *       STORAGE_MODE=off → Neon에만 저장 (기본값)
 *     다중 서버/클라우드 배포 환경에서 권장.
 *
 * ── Admin vs Desktop ────────────────────────────────────────
 *   Admin(웹 서버): offline 지원 없음. DB 접속 불가 시 에러 반환.
 *   Desktop(Electron, PTZ_DESKTOP_MODE=true):
 *     온라인(DB 접속 가능) → Neon 기본 + SQLite 백업 (항상 이중 저장)
 *     오프라인(DB 접속 불가) → SQLite 폴백
 *     userId='offline' → SQLite 직접 사용
 *
 * ── JSON 파일 저장 ──────────────────────────────────────────
 *   ❌ 더 이상 JSON 파일을 읽거나 쓰지 않는다.
 *   모든 데이터는 DB(Neon 또는 SQLite)에만 저장된다.
 */

import { CameraConfig, PresetConfig, AppSettings } from './types';

// ── DB 타입 & 저장 모드 ─────────────────────────────────────

export type DbType = 'sqlite' | 'neon';
export type StorageMode = 'on' | 'off';

export function getDbType(): DbType {
  const t = process.env.DB_TYPE?.toLowerCase();
  return t === 'neon' ? 'neon' : 'sqlite';
}

export function getStorageMode(): StorageMode {
  const m = process.env.STORAGE_MODE?.toLowerCase();
  if (m === 'on') return 'on';
  return 'off';
}

const IS_DESKTOP = process.env.PTZ_DESKTOP_MODE === 'true';

const DEFAULT_SETTINGS: AppSettings = {
  defaultProtocol: 'pelcod',
  proxyPort:       9902,
  logLevel:        'info',
  theme:           'system',
};

// ─── 인메모리 캐시 ────────────────────────────────────────────
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

// ── Neon(Prisma) 동적 임포트 ─────────────────────────────────
let _prisma: import('./db').PrismaClientType | null = null;
async function getPrisma() {
  if (!_prisma) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _prisma = require('./db').prisma;
  }
  return _prisma!;
}

// ── SQLite 읽기/쓰기 헬퍼 ───────────────────────────────────
// offline-db.ts 의 user_configs 테이블 사용

function saveToSQLite(userId: string, key: string, value: unknown): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { saveOfflineConfig } = require('./offline-db') as {
      saveOfflineConfig: (userId: string, key: string, value: string) => void;
    };
    saveOfflineConfig(userId, key, JSON.stringify(value));
  } catch (e) {
    console.error(`[ConfigManager SQLite] write ${key} failed:`, e);
  }
}

function readFromSQLite<T>(userId: string, key: string, fallback: T): T {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getOfflineConfig } = require('./offline-db') as {
      getOfflineConfig: (userId: string, key: string) => string | null;
    };
    const raw = getOfflineConfig(userId, key);
    if (raw !== null) return JSON.parse(raw) as T;
  } catch (e) {
    console.error(`[ConfigManager SQLite] read ${key} failed:`, e);
  }
  return fallback;
}

// ── Neon(Prisma) 읽기/쓰기 ──────────────────────────────────
async function readDbConfig<T>(
  userId: string,
  key: 'cameras' | 'presets' | 'settings',
  defaultValue: T
): Promise<T> {
  const prisma = await getPrisma();
  const row = await (prisma as any).userConfig.findUnique({
    where: { userId_key: { userId, key } },
  });
  if (row?.value) return JSON.parse(row.value) as T;
  return defaultValue;
}

async function writeDbConfig(
  userId: string,
  key: 'cameras' | 'presets' | 'settings',
  data: unknown
): Promise<void> {
  const prisma = await getPrisma();
  await (prisma as any).userConfig.upsert({
    where: { userId_key: { userId, key } },
    update: { value: JSON.stringify(data), updatedAt: new Date() },
    create: { userId, key, value: JSON.stringify(data) },
  });
}

// ── 저장 전략 결정 ──────────────────────────────────────────

/** SQLite 백업 수행 여부 (Neon 모드일 때만 의미 있음) */
function shouldSyncToSQLite(): boolean {
  if (getDbType() === 'sqlite') return false;
  if (IS_DESKTOP) return true; // Desktop은 항상 이중 저장
  return getStorageMode() === 'on';
}

/** 기본 저장소가 SQLite인지 여부 */
function useSQLiteAsPrimary(uid: string): boolean {
  if (IS_DESKTOP && uid === 'offline') return true;
  return getDbType() === 'sqlite';
}

// ─── Camera Configuration ──────────────────────────────────

export async function getCamerasAsync(userId?: string): Promise<CameraConfig[]> {
  const uid = userId ?? 'shared';
  const ck = `${uid}:cameras`;

  const cached = cacheGet<CameraConfig[]>(ck);
  if (cached !== undefined) return cached;

  // SQLite 기본 모드 (DB_TYPE=sqlite)
  if (useSQLiteAsPrimary(uid)) {
    const cameras = readFromSQLite<CameraConfig[]>(uid, 'cameras', []);
    cacheSet(ck, cameras);
    return cameras;
  }

  // Neon 기본 모드 (DB_TYPE=neon)
  try {
    let cameras = await readDbConfig<CameraConfig[]>(uid, 'cameras', []);

    // Desktop: Neon이 비어있으면 SQLite → Neon 동기화
    if (IS_DESKTOP && cameras.length === 0) {
      const sqliteCameras = readFromSQLite<CameraConfig[]>(uid, 'cameras', []);
      if (sqliteCameras.length > 0) {
        await writeDbConfig(uid, 'cameras', sqliteCameras);
        cameras = sqliteCameras;
      }
    }

    if (shouldSyncToSQLite()) saveToSQLite(uid, 'cameras', cameras);
    cacheSet(ck, cameras);
    return cameras;
  } catch (e) {
    // Desktop: DB 접속 불가 → SQLite 폴백
    if (IS_DESKTOP) {
      console.warn('[ConfigManager] DB unavailable, falling back to SQLite (cameras)');
      const cameras = readFromSQLite<CameraConfig[]>(uid, 'cameras', []);
      cacheSet(ck, cameras);
      return cameras;
    }
    // Admin: offline 지원 없음 → 에러 전파
    throw e;
  }
}

export async function saveCameraAsync(camera: CameraConfig, userId?: string): Promise<CameraConfig> {
  const uid = userId ?? 'shared';
  const cameras = await getCamerasAsync(uid);
  const index = cameras.findIndex(c => c.id === camera.id);
  const now = new Date().toISOString();

  const updated = index >= 0
    ? cameras.map((c, i) => i === index ? { ...camera, updatedAt: now } : c)
    : [...cameras, { ...camera, createdAt: now, updatedAt: now }];

  if (useSQLiteAsPrimary(uid)) {
    saveToSQLite(uid, 'cameras', updated);
  } else {
    await writeDbConfig(uid, 'cameras', updated);
    if (shouldSyncToSQLite()) saveToSQLite(uid, 'cameras', updated);
  }

  cacheInvalidate(uid);
  return camera;
}

export async function deleteCameraAsync(id: string, userId?: string): Promise<boolean> {
  const uid = userId ?? 'shared';
  const cameras = await getCamerasAsync(uid);
  const filtered = cameras.filter(c => c.id !== id);
  const deleted = filtered.length !== cameras.length;

  if (useSQLiteAsPrimary(uid)) {
    saveToSQLite(uid, 'cameras', filtered);
  } else {
    await writeDbConfig(uid, 'cameras', filtered);
    if (shouldSyncToSQLite()) saveToSQLite(uid, 'cameras', filtered);
  }

  cacheInvalidate(uid);
  return deleted;
}

// ─── Presets Configuration ────────────────────────────────

export async function getPresetsAsync(cameraId?: string, userId?: string): Promise<PresetConfig[]> {
  const uid = userId ?? 'shared';
  const ck = `${uid}:presets`;

  let presets = cacheGet<PresetConfig[]>(ck);

  if (presets === undefined) {
    if (useSQLiteAsPrimary(uid)) {
      presets = readFromSQLite<PresetConfig[]>(uid, 'presets', []);
    } else {
      try {
        presets = await readDbConfig<PresetConfig[]>(uid, 'presets', []);

        if (IS_DESKTOP && presets.length === 0) {
          const sqlitePresets = readFromSQLite<PresetConfig[]>(uid, 'presets', []);
          if (sqlitePresets.length > 0) {
            await writeDbConfig(uid, 'presets', sqlitePresets);
            presets = sqlitePresets;
          }
        }

        if (shouldSyncToSQLite()) saveToSQLite(uid, 'presets', presets);
      } catch (e) {
        if (IS_DESKTOP) {
          console.warn('[ConfigManager] DB unavailable, falling back to SQLite (presets)');
          presets = readFromSQLite<PresetConfig[]>(uid, 'presets', []);
        } else {
          throw e;
        }
      }
    }
    cacheSet(ck, presets);
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

  if (useSQLiteAsPrimary(uid)) {
    saveToSQLite(uid, 'presets', updated);
  } else {
    await writeDbConfig(uid, 'presets', updated);
    if (shouldSyncToSQLite()) saveToSQLite(uid, 'presets', updated);
  }

  cacheInvalidate(uid);
  return preset;
}

export async function deletePresetAsync(id: string, userId?: string): Promise<boolean> {
  const uid = userId ?? 'shared';
  const presets = await getPresetsAsync(undefined, uid);
  const filtered = presets.filter(p => p.id !== id);
  const deleted = filtered.length !== presets.length;

  if (useSQLiteAsPrimary(uid)) {
    saveToSQLite(uid, 'presets', filtered);
  } else {
    await writeDbConfig(uid, 'presets', filtered);
    if (shouldSyncToSQLite()) saveToSQLite(uid, 'presets', filtered);
  }

  cacheInvalidate(uid);
  return deleted;
}

// ─── App Settings ─────────────────────────────────────────

export async function getSettingsAsync(userId?: string): Promise<AppSettings> {
  const uid = userId ?? 'shared';
  const ck = `${uid}:settings`;

  const cached = cacheGet<AppSettings>(ck);
  if (cached !== undefined) return cached;

  if (useSQLiteAsPrimary(uid)) {
    const settings = readFromSQLite<AppSettings>(uid, 'settings', DEFAULT_SETTINGS);
    cacheSet(ck, settings);
    return settings;
  }

  try {
    let settings = await readDbConfig<AppSettings>(uid, 'settings', DEFAULT_SETTINGS);

    // Desktop: Neon에 데이터 없으면 SQLite → Neon 동기화
    if (IS_DESKTOP && JSON.stringify(settings) === JSON.stringify(DEFAULT_SETTINGS)) {
      const sqliteSettings = readFromSQLite<AppSettings | null>(uid, 'settings', null);
      if (sqliteSettings !== null) {
        await writeDbConfig(uid, 'settings', sqliteSettings);
        settings = sqliteSettings;
      }
    }

    if (shouldSyncToSQLite()) saveToSQLite(uid, 'settings', settings);
    cacheSet(ck, settings);
    return settings;
  } catch (e) {
    if (IS_DESKTOP) {
      console.warn('[ConfigManager] DB unavailable, falling back to SQLite (settings)');
      const settings = readFromSQLite<AppSettings>(uid, 'settings', DEFAULT_SETTINGS);
      cacheSet(ck, settings);
      return settings;
    }
    throw e;
  }
}

export async function saveSettingsAsync(settings: Partial<AppSettings>, userId?: string): Promise<AppSettings> {
  const uid = userId ?? 'shared';
  const current = await getSettingsAsync(uid);
  const updated = { ...current, ...settings };

  if (useSQLiteAsPrimary(uid)) {
    saveToSQLite(uid, 'settings', updated);
  } else {
    await writeDbConfig(uid, 'settings', updated);
    if (shouldSyncToSQLite()) saveToSQLite(uid, 'settings', updated);
  }

  cacheInvalidate(uid);
  return updated;
}

// ─── 하위 호환 동기 API (기존 코드가 import 하는 함수명 유지) ─
// ⚠️ 동기 API는 SQLite만 사용 (Prisma는 비동기 전용)
// Desktop 빌드에서 사용. Admin에서는 async 버전 사용 권장.

/** @deprecated async 버전(getCamerasAsync) 사용을 권장 */
export function getCameras(userId?: string): CameraConfig[] {
  const uid = userId ?? 'shared';
  return readFromSQLite<CameraConfig[]>(uid, 'cameras', []);
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
  saveToSQLite(uid, 'cameras', cameras);
  return camera;
}

/** @deprecated async 버전(deleteCameraAsync) 사용을 권장 */
export function deleteCamera(id: string, userId?: string): boolean {
  const uid = userId ?? 'shared';
  const cameras = getCameras(uid);
  const filtered = cameras.filter(c => c.id !== id);
  saveToSQLite(uid, 'cameras', filtered);
  return filtered.length !== cameras.length;
}

/** @deprecated */
export function getPresets(cameraId?: string, userId?: string): PresetConfig[] {
  const uid = userId ?? 'shared';
  const presets = readFromSQLite<PresetConfig[]>(uid, 'presets', []);
  return cameraId ? presets.filter(p => p.cameraId === cameraId) : presets;
}

/** @deprecated */
export function savePreset(preset: PresetConfig, userId?: string): PresetConfig {
  const uid = userId ?? 'shared';
  const presets = getPresets(undefined, uid);
  const index = presets.findIndex(p => p.id === preset.id);
  if (index >= 0) { presets[index] = preset; } else { presets.push(preset); }
  saveToSQLite(uid, 'presets', presets);
  return preset;
}

/** @deprecated */
export function deletePreset(id: string, userId?: string): boolean {
  const uid = userId ?? 'shared';
  const presets = getPresets(undefined, uid);
  const filtered = presets.filter(p => p.id !== id);
  saveToSQLite(uid, 'presets', filtered);
  return filtered.length !== presets.length;
}

/** @deprecated */
export function getSettings(userId?: string): AppSettings {
  const uid = userId ?? 'shared';
  return readFromSQLite<AppSettings>(uid, 'settings', DEFAULT_SETTINGS);
}

/** @deprecated */
export function saveSettings(settings: Partial<AppSettings>, userId?: string): AppSettings {
  const uid = userId ?? 'shared';
  const updated = { ...getSettings(uid), ...settings };
  saveToSQLite(uid, 'settings', updated);
  return updated;
}
