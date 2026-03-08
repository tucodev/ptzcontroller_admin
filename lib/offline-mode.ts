/**
 * offline-mode.ts (P-47 완전 구현)
 * 
 * DB 연결 불가 시 오프라인 모드 활성화
 * 라이선스 검증 포함 (P-46)
 */

import { prisma } from './db';
import { verifyLicense, getLicenseDir, createLicenseRequest, saveRequestFile } from './license';
import path from 'path';
import fs from 'fs';

// ── 오프라인 세션 타입 ───────────────────────────────────────
export interface OfflineSession {
  user: {
    id:    string;
    name:  string;
    email: string;
    role:  'user'; // 오프라인은 항상 user 고정
  };
  offline: true;
  license?: {
    valid: boolean;
    expiresAt?: string;
    reason?: string;
  };
}

// ── DB 연결 상태 캐시 ────────────────────────────────────────
let _dbAvailable: boolean | null = null;
let _lastCheckTime = 0;
const CACHE_TTL_MS = 30_000; // 30초마다 재확인
const DB_CHECK_TIMEOUT_MS = 3_000;

/**
 * DB 연결 가능 여부 확인
 * 결과는 30초간 캐시됨
 */
export async function isDbAvailable(): Promise<boolean> {
  const now = Date.now();
  if (_dbAvailable !== null && now - _lastCheckTime < CACHE_TTL_MS) {
    return _dbAvailable;
  }

  try {
    await Promise.race([
      prisma.$queryRaw`SELECT 1`,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('DB check timeout')), DB_CHECK_TIMEOUT_MS)
      ),
    ]);
    _dbAvailable = true;
  } catch (err) {
    _dbAvailable = false;
    console.warn('[OfflineMode] DB connection failed — offline mode activated:', (err as Error).message);
  }

  _lastCheckTime = Date.now();
  return _dbAvailable;
}

/**
 * DB 연결 캐시 강제 초기화
 * (재연결 시도 버튼 등에서 사용)
 */
export function resetDbCache(): void {
  _dbAvailable   = null;
  _lastCheckTime = 0;
  console.log('[OfflineMode] DB cache reset');
}

/**
 * 라이선스 파일 검증 (P-46)
 * 
 * 반환:
 *   { valid: true, expiresAt: "2027-03-07T..." }  – 라이선스 유효
 *   { valid: false, reason: "Expired" }           – 라이선스 만료
 *   { valid: false, reason: "Not found" }         – 라이선스 없음
 */
async function verifyOfflineLicense(): Promise<{ valid: boolean; expiresAt?: string; reason?: string }> {
  try {
    const licenseDir = getLicenseDir();
    const licenseFile = path.join(licenseDir, 'offline.ptzlic');
    
    // 라이선스 파일 존재 여부 확인
    if (!fs.existsSync(licenseFile)) {
      console.warn('[OfflineMode] License file not found. Creating license request...');
      
      // 요청 파일 생성
      try {
        const request = await createLicenseRequest();
        await saveRequestFile(request);
        console.log('[OfflineMode] License request saved. Please upload to license server.');
        console.log('[OfflineMode] Request file location:', path.join(licenseDir, 'license.ptzreq'));
      } catch (err) {
        console.warn('[OfflineMode] Failed to create license request:', err);
      }
      
      return { valid: false, reason: 'Not found' };
    }
    
    // 라이선스 파일 검증
    const licenseContent = fs.readFileSync(licenseFile, 'utf-8').trim();
    const result = verifyLicense(licenseContent);
    
    if (!result.valid) {
      console.warn('[OfflineMode] License validation failed:', result.reason);
      return result;
    }
    
    // 라이선스 만료 시간까지의 남은 시간 로깅
    if (result.expiresAt) {
      const expiresAt = new Date(result.expiresAt);
      const daysLeft = Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      
      if (daysLeft <= 0) {
        console.warn('[OfflineMode] License has expired');
        return { valid: false, reason: 'Expired' };
      } else if (daysLeft <= 30) {
        console.warn(`[OfflineMode] License expires in ${daysLeft} days`);
      } else {
        console.log(`[OfflineMode] License valid for ${daysLeft} more days`);
      }
    }
    
    return result;
  } catch (err) {
    console.error('[OfflineMode] License verification error:', err);
    return { valid: false, reason: 'Verification error' };
  }
}

/**
 * 오프라인 세션 생성
 * 라이선스 검증 포함 (필수)
 */
export async function createOfflineSession(): Promise<OfflineSession> {
  // P-47: 라이선스 검증 (필수)
  const licenseStatus = await verifyOfflineLicense();
  
  // 라이선스 검증 결과 로깅
  if (!licenseStatus.valid) {
    console.warn('[OfflineMode] ⚠️  Offline mode activated WITHOUT valid license');
    console.warn('[OfflineMode] Reason:', licenseStatus.reason);
    console.warn('[OfflineMode] Please upload a valid license file to enable offline mode');
  } else {
    console.log('[OfflineMode] ✅ Offline mode activated WITH valid license');
    if (licenseStatus.expiresAt) {
      console.log('[OfflineMode] License expires at:', licenseStatus.expiresAt);
    }
  }
  
  return {
    user: {
      id:    'offline',
      name:  'Offline User',
      email: 'offline@local',
      role:  'user',
    },
    offline: true,
    license: licenseStatus,
  };
}

/**
 * 주어진 세션이 오프라인 세션인지 확인
 */
export function isOfflineSession(session: unknown): session is OfflineSession {
  return (
    typeof session === 'object' &&
    session !== null &&
    (session as OfflineSession).offline === true
  );
}
