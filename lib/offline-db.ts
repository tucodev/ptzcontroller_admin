/**
 * lib/offline-db.ts
 * 
 * SQLite 기반 오프라인 사용자 저장소
 * 경로: C:\ProgramData\PTZController\offline.db (크로스 플랫폼)
 */

import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

export interface OfflineUserRecord {
  // 기본 인증 정보
  id: string;
  email: string;
  name: string;
  passwordHash: string;  // 빈 문자열('')이면 비밀번호 로그인 불가 (라이선스 전용 계정)
  role: 'user' | 'admin';
  createdAt: string;
  updatedAt: string;
  
  // 기본 정보 확장
  organization?: string | null;
  
  // 오프라인 동기화 추적
  lastOnlineLoginAt?: string | null;
  lastSyncAt?: string | null;
  isInOfflineMode?: number;
  
  // 라이선스 & 기기 추적 (P-46)
  machineId?: string | null;
  lastMachineId?: string | null;
  licenseStatus?: string | null;
  licenseExpiresAt?: string | null;
  
  // 보안 & 감시
  failedLoginAttempts?: number;
  lastFailedLoginAt?: string | null;
  lockedUntil?: string | null;
  isActive?: number;
  
  // 오프라인 환경 정보
  offlineSessionToken?: string | null;
  offlineStartedAt?: string | null;
  platform?: string | null;
  appVersion?: string | null;
}

let db: Database.Database | null = null;

/**
 * SQLite DB 파일 경로 (크로스 플랫폼)
 */
export function getOfflineDbPath(): string {
  let dataDir: string;
  
  if (process.platform === 'win32') {
    dataDir = path.join(process.env.PROGRAMDATA || 'C:\\ProgramData', 'PTZController');
  } else if (process.platform === 'darwin') {
    dataDir = path.join(
      process.env.HOME || os.homedir(),
      'Library/Application Support/PTZController'
    );
  } else {
    // Linux
    dataDir = path.join(
      process.env.HOME || os.homedir(),
      '.config/PTZController'
    );
  }
  
  // 디렉토리 생성 (없으면)
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  return path.join(dataDir, 'offline.db');
}

/**
 * 클라우드 환경 감지 (SQLite 불필요)
 * - DATABASE_URL 존재 = Neon PostgreSQL 사용 중 = 클라우드 배포
 * - ELECTRON_RUN_AS_NODE 또는 로컬 환경 = Desktop 모드
 */
function isCloudEnvironment(): boolean {
  return !!(process.env.DATABASE_URL && !process.env.ELECTRON_RUN_AS_NODE);
}

/**
 * SQLite DB 초기화
 */
export function initOfflineDb(): void {
  // 클라우드 환경에서는 SQLite 오프라인 DB 불필요 — 건너뜀
  if (isCloudEnvironment()) {
    console.log('[OfflineDB] Cloud environment detected — skipping SQLite init');
    return;
  }

  try {
    const dbPath = getOfflineDbPath();
    db = new Database(dbPath);

    // busy_timeout: 다른 프로세스가 DB 잠금 시 최대 5초 대기
    db.pragma('busy_timeout = 5000');
    // WAL 모드 활성화
    db.pragma('journal_mode = WAL');
    db.pragma('synchronous = NORMAL');

    // 테이블 생성
    db.exec(`
      CREATE TABLE IF NOT EXISTS offline_users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        passwordHash TEXT NOT NULL DEFAULT '',  -- 빈 문자열: 라이선스 전용 계정 (비밀번호 로그인 불가)
        role TEXT NOT NULL DEFAULT 'user',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        organization TEXT,
        lastOnlineLoginAt TEXT,
        lastSyncAt TEXT,
        isInOfflineMode INTEGER DEFAULT 0,
        machineId TEXT,
        lastMachineId TEXT,
        licenseStatus TEXT DEFAULT 'none',
        licenseExpiresAt TEXT,
        failedLoginAttempts INTEGER DEFAULT 0,
        lastFailedLoginAt TEXT,
        lockedUntil TEXT,
        isActive INTEGER DEFAULT 1,
        offlineSessionToken TEXT,
        offlineStartedAt TEXT,
        platform TEXT,
        appVersion TEXT
      );
      
      CREATE INDEX IF NOT EXISTS idx_offline_users_email ON offline_users(email);
      CREATE INDEX IF NOT EXISTS idx_offline_users_machineId ON offline_users(machineId);
      CREATE INDEX IF NOT EXISTS idx_offline_users_isActive ON offline_users(isActive);

      CREATE TABLE IF NOT EXISTS user_configs (
        id TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        UNIQUE(userId, key)
      );

      CREATE INDEX IF NOT EXISTS idx_user_configs_userId ON user_configs(userId);
    `);
    
    console.log('[OfflineDB] Initialized at:', dbPath);
  } catch (err) {
    console.error('[OfflineDB] Initialization failed:', err);
    throw err;
  }
}

/**
 * DB 연결 종료
 */
export function closeOfflineDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * 현재 DB 연결 가져오기
 * 클라우드 환경에서는 null 반환 (SQLite 미사용)
 */
function getDb(): Database.Database | null {
  if (!db && !isCloudEnvironment()) {
    initOfflineDb();
  }
  return db;
}

/**
 * 이메일로 사용자 조회
 */
export function getOfflineUser(email: string): OfflineUserRecord | null {
  const database = getDb();
  if (!database) return null;
  const stmt = database.prepare('SELECT * FROM offline_users WHERE email = ?');
  const user = stmt.get(email) as OfflineUserRecord | undefined;
  return user ?? null;
}

/**
 * ID로 사용자 조회
 */
export function getOfflineUserById(id: string): OfflineUserRecord | null {
  const database = getDb();
  if (!database) return null;
  const stmt = database.prepare('SELECT * FROM offline_users WHERE id = ?');
  const user = stmt.get(id) as OfflineUserRecord | undefined;
  return user ?? null;
}

/**
 * 기기 ID로 사용자 조회 (P-46)
 */
export function getOfflineUserByMachineId(machineId: string): OfflineUserRecord | null {
  const database = getDb();
  if (!database) return null;
  const stmt = database.prepare('SELECT * FROM offline_users WHERE machineId = ?');
  const user = stmt.get(machineId) as OfflineUserRecord | undefined;
  return user ?? null;
}

/**
 * 모든 사용자 조회
 */
export function getAllOfflineUsers(): OfflineUserRecord[] {
  const database = getDb();
  if (!database) return [];
  const stmt = database.prepare('SELECT * FROM offline_users WHERE isActive = 1 ORDER BY createdAt DESC');
  return stmt.all() as OfflineUserRecord[];
}

/**
 * 사용자 저장/업데이트
 */
/**
 * 사용자 저장/업데이트
 */
export function saveOfflineUser(
  user: Omit<OfflineUserRecord, 'createdAt' | 'updatedAt' | 'id' | 'passwordHash'> & {
    id?: string;
    createdAt?: string;
    passwordHash?: string;  // 미제공 시 '' (라이선스 전용 계정)
  }
): OfflineUserRecord | null {
  const database = getDb();
  if (!database) return null;

  const id = user.id || generateId();
  const now = new Date().toISOString();
  const passwordHash = user.passwordHash ?? '';  // 미제공 시 빈 문자열
  const existing = getOfflineUser(user.email);
    
  if (existing) {
    // 업데이트
    const stmt = database.prepare(`
      UPDATE offline_users
      SET 
        name = ?,
        organization = ?,
        passwordHash = ?,
        role = ?,
        machineId = ?,
        lastMachineId = ?,
        licenseStatus = ?,
        licenseExpiresAt = ?,
        lastOnlineLoginAt = ?,
        lastSyncAt = ?,
        isInOfflineMode = ?,
        offlineSessionToken = ?,
        offlineStartedAt = ?,
        platform = ?,
        appVersion = ?,
        failedLoginAttempts = ?,
        lastFailedLoginAt = ?,
        lockedUntil = ?,
        isActive = ?,
        updatedAt = ?
      WHERE email = ?
    `);
    
    stmt.run(
      user.name,
      user.organization ?? null,
      passwordHash,
      user.role,
      user.machineId ?? null,
      user.lastMachineId ?? null,
      user.licenseStatus ?? null,
      user.licenseExpiresAt ?? null,
      user.lastOnlineLoginAt ?? null,
      user.lastSyncAt ?? null,
      user.isInOfflineMode ?? 0,
      user.offlineSessionToken ?? null,
      user.offlineStartedAt ?? null,
      user.platform ?? null,
      user.appVersion ?? null,
      user.failedLoginAttempts ?? 0,
      user.lastFailedLoginAt ?? null,
      user.lockedUntil ?? null,
      user.isActive ?? 1,
      now,
      user.email
    );
    
    return getOfflineUser(user.email)!;
  } else {
    // 삽입
    const stmt = database.prepare(`
      INSERT INTO offline_users (
        id, email, name, organization, passwordHash, role,
        machineId, lastMachineId, licenseStatus, licenseExpiresAt,
        lastOnlineLoginAt, lastSyncAt, isInOfflineMode,
        offlineSessionToken, offlineStartedAt, platform, appVersion,
        failedLoginAttempts, lastFailedLoginAt, lockedUntil, isActive,
        createdAt, updatedAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      id,
      user.email,
      user.name,
      user.organization ?? null,
      passwordHash,
      user.role,
      user.machineId ?? null,
      user.lastMachineId ?? null,
      user.licenseStatus ?? null,
      user.licenseExpiresAt ?? null,
      user.lastOnlineLoginAt ?? null,
      user.lastSyncAt ?? null,
      user.isInOfflineMode ?? 0,
      user.offlineSessionToken ?? null,
      user.offlineStartedAt ?? null,
      user.platform ?? null,
      user.appVersion ?? null,
      user.failedLoginAttempts ?? 0,
      user.lastFailedLoginAt ?? null,
      user.lockedUntil ?? null,
      user.isActive ?? 1,
      user.createdAt ?? now,
      now
    );
    
    return getOfflineUser(user.email)!;
  }
}

/**
 * 비밀번호 검증
 */
/**
 * 비밀번호 검증 (✅ 개선 버전)
 */
export async function verifyOfflinePassword(
    email: string,
    password: string,
    bcryptModule: any,
): Promise<OfflineUserRecord | null> {
    const user = getOfflineUser(email);
    
    if (!user) {
        console.warn('[OfflineDB] 사용자 없음:', email);
        return null;
    }

    // 라이선스 전용 계정 (passwordHash 없음) → 비밀번호 로그인 불가
    if (!user.passwordHash) {
        console.warn('[OfflineDB] 비밀번호 없는 라이선스 전용 계정:', email);
        return null;
    }

    // 계정 잠금 확인
    if (user.lockedUntil) {
        const lockTime = new Date(user.lockedUntil);
        if (lockTime > new Date()) {
            console.warn('[OfflineDB] 계정 잠금 (해제 시간):', user.lockedUntil);
            return null;
        }
    }
    
    // 비활성 계정 확인
    if (user.isActive !== 1) {
        console.warn('[OfflineDB] 비활성 계정:', email);
        return null;
    }
    
    // 비밀번호 검증
    try {
        const isValid = await bcryptModule.compare(password, user.passwordHash);
        
        if (!isValid) {
            const failedCount = (user.failedLoginAttempts ?? 0) + 1;
            const shouldLock = failedCount >= 5;

            const database = getDb();
            if (!database) return null;
            const updateStmt = database.prepare(`
                UPDATE offline_users
                SET 
                    failedLoginAttempts = ?,
                    lastFailedLoginAt = ?,
                    lockedUntil = ?
                WHERE email = ?
            `);
            
            updateStmt.run(
                failedCount,
                new Date().toISOString(),
                shouldLock ? new Date(Date.now() + 30 * 60 * 1000).toISOString() : null,
                email
            );
            
            console.warn('[OfflineDB] ❌ 비밀번호 불일치:', email, `(${failedCount}/5)`);
            return null;
        }
        
        // ✅ 로그인 성공 - 실패 횟수 초기화
        const database2 = getDb();
        if (!database2) return null;
        const successStmt = database2.prepare(`
            UPDATE offline_users
            SET 
                failedLoginAttempts = 0,
                lastFailedLoginAt = NULL,
                lockedUntil = NULL,
                lastOnlineLoginAt = ?,
                lastSyncAt = ?,
                updatedAt = ?
            WHERE email = ?
        `);
        
        successStmt.run(
            new Date().toISOString(),
            new Date().toISOString(),
            new Date().toISOString(),
            email
        );
        
        console.log('[OfflineDB] ✅ 오프라인 로그인 성공:', email);
        return getOfflineUser(email);
    } catch (err) {
        console.error('[OfflineDB] bcrypt 비교 에러:', err instanceof Error ? err.message : String(err));
        return null;
    }
}

/**
 * 라이선스 상태 업데이트
 */
export function updateLicenseStatus(
  email: string,
  status: 'valid' | 'expired' | 'pending' | 'none',
  expiresAt?: string
): void {
  const database = getDb();
  if (!database) return;
  const stmt = database.prepare(`
    UPDATE offline_users
    SET licenseStatus = ?, licenseExpiresAt = ?, updatedAt = ?
    WHERE email = ?
  `);

  stmt.run(status, expiresAt ?? null, new Date().toISOString(), email);
}

/**
 * 오프라인 모드 상태 업데이트
 */
export function updateOfflineModeStatus(email: string, isOffline: boolean, machineId?: string): void {
  const database = getDb();
  if (!database) return;

  const stmt = database.prepare(`
    UPDATE offline_users
    SET
      isInOfflineMode = ?,
      offlineStartedAt = ?,
      machineId = ?,
      platform = ?,
      appVersion = ?,
      updatedAt = ?
    WHERE email = ?
  `);

  stmt.run(
    isOffline ? 1 : 0,
    isOffline ? new Date().toISOString() : null,
    machineId ?? null,
    process.platform,
    process.env.npm_package_version ?? null,
    new Date().toISOString(),
    email
  );
}

/**
 * 동기화 시간 업데이트
 */
export function updateSyncTime(email: string): void {
  const database = getDb();
  if (!database) return;
  const stmt = database.prepare(`
    UPDATE offline_users
    SET lastSyncAt = ?, updatedAt = ?
    WHERE email = ?
  `);

  stmt.run(new Date().toISOString(), new Date().toISOString(), email);
}

/**
 * 사용자 삭제
 */
export function deleteOfflineUser(email: string): boolean {
  const database = getDb();
  if (!database) return false;
  const stmt = database.prepare('DELETE FROM offline_users WHERE email = ?');
  const result = stmt.run(email);
  return result.changes > 0;
}

/**
 * 사용자 비활성화
 */
export function deactivateOfflineUser(email: string): void {
  const database = getDb();
  if (!database) return;
  const stmt = database.prepare(`
    UPDATE offline_users
    SET isActive = 0, updatedAt = ?
    WHERE email = ?
  `);

  stmt.run(new Date().toISOString(), email);
}

// ─── user_configs CRUD ────────────────────────────────────────

/**
 * 설정 조회 (userId = email)
 */
export function getOfflineConfig(userId: string, key: string): string | null {
  const database = getDb();
  if (!database) return null;
  const row = database.prepare(
    'SELECT value FROM user_configs WHERE userId = ? AND key = ?'
  ).get(userId, key) as { value: string } | undefined;
  return row?.value ?? null;
}

/**
 * 설정 저장/업데이트 (userId = email)
 */
export function saveOfflineConfig(userId: string, key: string, value: string): void {
  const database = getDb();
  if (!database) return;
  const now = new Date().toISOString();
  const id = `${userId}:${key}`;
  database.prepare(`
    INSERT INTO user_configs (id, userId, key, value, updatedAt)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(userId, key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
  `).run(id, userId, key, value, now);
}

/**
 * 설정 삭제 (userId = email)
 */
export function deleteOfflineConfig(userId: string, key: string): void {
  const database = getDb();
  if (!database) return;
  database.prepare('DELETE FROM user_configs WHERE userId = ? AND key = ?').run(userId, key);
}

// ─── 라이선스 기반 사용자 생성 ────────────────────────────────

/**
 * 라이선스에서 생성하는 오프라인 사용자.
 * id = email, passwordHash = '' (비밀번호 로그인 불가 — 라이선스로만 오프라인 진입).
 * 이미 존재하면 기존 id 반환.
 */
export function saveLicenseUser(params: {
  email: string;
  name?: string;
  org?: string;
}): string | null {
  if (isCloudEnvironment()) return null;
  const existing = getOfflineUser(params.email);
  if (existing) return existing.id;

  saveOfflineUser({
    id:           params.email,  // email을 id로 사용 (안정적 식별자)
    email:        params.email,
    name:         params.name || '',
    organization: params.org,
    passwordHash: '',            // 비밀번호 없는 라이선스 전용 계정
    role:         'user',
  });
  console.log('[OfflineDB] License user created:', params.email);
  return params.email;
}

/**
 * ID 생성
 */
function generateId(): string {
  return `offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * DB 통계
 */
export function getOfflineDbStats(): {
  totalUsers: number;
  activeUsers: number;
  lockedUsers: number;
  usersWithLicense: number;
  usersInOfflineMode: number;
} {
  const database = getDb();
  if (!database) return { totalUsers: 0, activeUsers: 0, lockedUsers: 0, usersWithLicense: 0, usersInOfflineMode: 0 };

  const totalStmt = database.prepare('SELECT COUNT(*) as count FROM offline_users');
  const activeStmt = database.prepare('SELECT COUNT(*) as count FROM offline_users WHERE isActive = 1');
  const lockedStmt = database.prepare('SELECT COUNT(*) as count FROM offline_users WHERE lockedUntil IS NOT NULL AND lockedUntil > datetime("now")');
  const licenseStmt = database.prepare('SELECT COUNT(*) as count FROM offline_users WHERE licenseStatus IS NOT NULL AND licenseStatus != "none"');
  const offlineStmt = database.prepare('SELECT COUNT(*) as count FROM offline_users WHERE isInOfflineMode = 1');

  return {
    totalUsers: (totalStmt.get() as { count: number }).count,
    activeUsers: (activeStmt.get() as { count: number }).count,
    lockedUsers: (lockedStmt.get() as { count: number }).count,
    usersWithLicense: (licenseStmt.get() as { count: number }).count,
    usersInOfflineMode: (offlineStmt.get() as { count: number }).count,
  };
}
