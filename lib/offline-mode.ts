/**
 * offline-mode.ts
 * DB connection unavailable - activate offline mode with license verification
 */

import { prisma } from './db';
import { verifyLicense, getLicenseDir, createLicenseRequest, saveRequestFile } from './license';
import path from 'path';
import fs from 'fs';

// Offline session type
export interface OfflineSession {
  user: {
    id:    string;
    name:  string;
    email: string;
    role:  'user';
  };
  offline: true;
  license?: {
    valid: boolean;
    expiresAt?: string;
    reason?: string;
  };
}

// DB connection cache
let _dbAvailable: boolean | null = null;
let _lastCheckTime = 0;
const CACHE_TTL_MS = 30_000;
const DB_CHECK_TIMEOUT_MS = 3_000;

/**
 * Check if DB is available
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
    console.warn('[OfflineMode] DB unavailable, offline mode activated:', (err as Error).message);
  }

  _lastCheckTime = Date.now();
  return _dbAvailable;
}

/**
 * Reset DB cache
 */
export function resetDbCache(): void {
  _dbAvailable   = null;
  _lastCheckTime = 0;
  console.log('[OfflineMode] DB cache reset');
}

/**
 * Verify offline license file
 * Returns: { valid: true, expiresAt: "..." } or { valid: false, reason: "..." }
 */
export async function verifyOfflineLicense(): Promise<{
  valid:      boolean;
  expiresAt?: string;
  reason?:    string;
  userEmail?: string;
  userName?:  string;
  userOrg?:   string;
}> {
  try {
    const licenseDir = getLicenseDir();
    const licenseFile = path.join(licenseDir, 'offline.ptzlic');
    
    // Check if license file exists
    if (!fs.existsSync(licenseFile)) {
      console.warn('[OfflineMode] License file not found');
      
      // Try to create license request
      try {
        const request = createLicenseRequest();
        saveRequestFile(request);
        console.log('[OfflineMode] License request created:', path.join(licenseDir, 'license.ptzreq'));
      } catch (err) {
        console.warn('[OfflineMode] Failed to create license request:', err);
      }      
      return { valid: false, reason: 'NOT_FOUND' };
    }
    
    // Verify license file
    const licenseContent = fs.readFileSync(licenseFile, 'utf-8').trim();
    const result = verifyLicense(licenseContent);
    
    if (!result.valid) {
      console.warn('[OfflineMode] License validation failed:', result.reason);
      return result;
    }
    
    // Check expiry
    if (result.expiresAt) {
      const expiresAt = new Date(result.expiresAt);
      const daysLeft = Math.floor((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      
      if (daysLeft <= 0) {
        console.warn('[OfflineMode] License expired');
        return { valid: false, reason: 'EXPIRED' };
      } else if (daysLeft <= 30) {
        console.warn(`[OfflineMode] License expires in ${daysLeft} days`);
      } else {
        console.log(`[OfflineMode] License valid for ${daysLeft} more days`);
      }
    }
    
    // result에 userEmail/userName/userOrg 이미 포함 (license.ts verifyLicense 반환값)
    return {
      valid:      result.valid,
      expiresAt:  result.expiresAt,
      reason:     result.reason,
      userEmail:  result.userEmail,
      userName:   result.userName,
      userOrg:    result.userOrg,
    };
  } catch (err) {
    console.error('[OfflineMode] License verification error:', err);
    return { valid: false, reason: 'ERROR' };
  }
}

/**
 * Create offline session with license verification
 * @param userEmail - 쿠키에서 읽은 이메일 (ptz-offline-userid). 없으면 라이선스에서 추출.
 */
export async function createOfflineSession(userEmail?: string): Promise<OfflineSession> {
  const licenseStatus = await verifyOfflineLicense();

  // 실제 사용자 이메일 우선순위: 파라미터(쿠키) > 라이선스 파일 > fallback
  const email = userEmail ?? licenseStatus.userEmail ?? 'offline@local';
  const name  = licenseStatus.userName ?? 'Offline User';

  if (!licenseStatus.valid) {
    console.warn('[OfflineMode] Offline mode without valid license, reason:', licenseStatus.reason);
  } else {
    console.log('[OfflineMode] Offline mode with valid license:', licenseStatus.expiresAt, '/ user:', email);
  }

  return {
    user: {
      id:    email,
      name,
      email,
      role:  'user',
    },
    offline: true,
    license: licenseStatus,
  };
}

/**
 * Check if session is offline
 */
export function isOfflineSession(session: unknown): session is OfflineSession {
  return (
    typeof session === 'object' &&
    session !== null &&
    (session as OfflineSession).offline === true
  );
}
