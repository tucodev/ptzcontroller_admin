/**
 * lib/license.ts (최종 개선 버전 – NIC 다중화 + 크로스 플랫폼 최적화)
 * 
 * ── 설계 원칙 ────────────────────────────────────────────────────────
 * 
 * 문제: 활성화 NIC이 변할 때마다 MAC이 바뀌어 라이선스가 무효화됨
 * 
 * 해결:
 * 1. 모든 물리 NIC (활성/비활성)의 MAC 수집
 * 2. 각 NIC별로 MachineID 생성 → 배열로 저장
 * 3. 라이선스 발급: 수집된 모든 NIC ID 포함
 * 4. 라이선스 검증: 배열 중 하나라도 일치하면 통과
 * 5. NIC이 없으면: OS UUID 기반 발급 (fallback)
 * 
 * + 크로스 플랫폼 적용 +
 * 
 * Windows:
 *   - Windows 8+ : PowerShell Get-NetAdapter (비활성 포함)
 *   - Windows 7  : getmac (활성만) + HDD 시리얼 보완
 * 
 * macOS: ifconfig (모든 어댑터)
 * Linux: /sys/class/net (모든 어댑터)
 * 
 * 
 * 결과:
 * - 한 개 NIC → 1개 ID로 발급
 * - 여러 개 NIC → 모든 NIC ID로 발급 (한 개만 일치해도 OK)
 * - NIC 교체 → 새 ID 추가 가능 (기존 ID도 유효)
 * - NIC 비활성화 → 기존 ID는 여전히 유효
 * 
 */

import * as crypto from 'crypto';
import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { execSync, spawnSync } from 'child_process';

const MASTER_SECRET = process.env.LICENSE_SECRET ?? 'TYCHE-PTZ-LICENSE-SECRET-2024';
const PRODUCT_ID = 'PTZ-OFFLINE';

// ── 라이선스 디렉토리 경로 ────────────────────────────────────────────
export function getLicenseDir(): string {
  if (process.platform === 'win32') {
    const programData = process.env.PROGRAMDATA || process.env.ALLUSERSPROFILE || 'C:\\ProgramData';
    return path.join(programData, 'PTZController');
  } else if (process.platform === 'darwin') {
    return '/Library/Application Support/PTZController';
  } else {
    return path.join(process.env.HOME || '/etc', '.config', 'PTZController');
  }
}

// ── 안전한 명령어 실행 ────────────────────────────────────────────────
function safeSpawn(cmd: string, args: string[], timeout: number = 3000): string | null {
  try {
    // ✅ encoding: 'utf8' 필수 - stdout이 string이 되도록 지정
    const result = spawnSync(cmd, args, {
      timeout,
      encoding: 'utf8' as const,
      stdio: ['pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });
    
    // ✅ stdout은 이제 string | Buffer 대신 string
    if (result.status === 0 && result.stdout) {
      const output = result.stdout;
      if (typeof output === 'string') {
        return output.trim();
      }
    }
    return null;
  } catch (e) {
    console.warn('[license] spawnSync failed:', (e as Error).message);
    return null;
  }
}

function safeReadFile(filePath: string): string | null {
  try {
    if (fs.existsSync(filePath)) {
      return fs.readFileSync(filePath, 'utf8').trim();
    }
    return null;
  } catch (e) {
    console.warn('[license] readFile failed:', (e as Error).message);
    return null;
  }
}

// ── OS ID 추출 ──────────────────────────────────────────────────────
function getOsId(): string {
  const platform = os.platform();
  let osId = '';

  try {
    if (platform === 'win32') {
      // ✅ encoding: 'utf8' 지정하여 stdout이 string이 되도록
      const result = spawnSync('reg', [
        'query',
        'HKLM\\SOFTWARE\\Microsoft\\Cryptography',
        '/v',
        'MachineGuid',
      ], {
        timeout: 3000,
        encoding: 'utf8' as const,
        windowsHide: true,
      });

      if (result.status === 0 && result.stdout) {
        const out = result.stdout;
        if (typeof out === 'string') {
          const match = out.match(/MachineGuid\s+REG_SZ\s+(.+)/);
          if (match) {
            osId = match[1].trim();
          }
        }
      }
    } else if (platform === 'darwin') {
      const out = safeSpawn('ioreg', ['-rd1', '-c', 'IOPlatformExpertDevice']);
      if (out) {
        const match = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
        if (match) {
          osId = match[1];
        }
      }
    } else {
      // Linux
      osId = safeReadFile('/etc/machine-id') || safeReadFile('/var/lib/dbus/machine-id') || '';
    }
  } catch (e) {
    console.warn('[license] OS ID 추출 실패:', (e as Error).message);
  }

  return osId || `${platform}-${os.arch()}-${os.totalmem()}`;
}

// 제품 고유 salt: OS에 종속되지 않고 코드 obfuscation 목적
// OS UUID를 salt로 쓰지 않으므로 OS 재설치 후에도 동일 HW라면 동일 코드 생성
const HW_SALT = 'PTZ-CTRL-HW-2024';

function makeHwId(hwKey: string): string {
  return crypto
    .createHash('sha256')
    .update(`${HW_SALT}||${hwKey}`)
    .digest('hex')
    .slice(0, 16)
    .toUpperCase();
}

// ── Windows 버전 감지 ────────────────────────────────────────────────
function getWindowsOsVersion(): 'win7' | 'win8+' {
  try {
    // ✅ encoding: 'utf8' 지정
    const result = spawnSync('cmd', ['/c', 'ver'], {
      timeout: 3000,
      encoding: 'utf8' as const,
      windowsHide: true,
    });

    if (result.status === 0 && result.stdout) {
      const out = result.stdout;
      if (typeof out === 'string' && out.includes('Windows 7')) {
        return 'win7';
      }
    }
    return 'win8+';
  } catch {
    return 'win8+';
  }
}

// ── Windows 8+ : PowerShell (비활성 NIC 포함) ────────────────────────
function getWindowsMacsModern(): string[] {
  const macs: string[] = [];

  const psOut = safeSpawn('powershell', [
    '-NoProfile',
    '-Command',
    'Get-NetAdapter -Physical | Select-Object -ExpandProperty MacAddress',
  ], 5000);

  if (psOut && typeof psOut === 'string') {
    for (const line of psOut.split(/\r?\n/)) {
      // Get-NetAdapter returns XX-XX-XX-XX-XX-XX (dashes) → normalize to colons
      const mac = line.trim().toLowerCase().replace(/-/g, ':');
      if (/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(mac) && mac !== '00:00:00:00:00:00') {
        macs.push(mac);
      }
    }
  }

  return macs;
}

// ── Windows 7 : getmac (활성만) ─────────────────────────────────────
function getWindowsMacsLegacy(): string[] {
  const macs: string[] = [];

  const getmacOut = safeSpawn('getmac', []);
  if (getmacOut && typeof getmacOut === 'string') {
    const matches = getmacOut.match(/([0-9A-Fa-f]{2}-){5}[0-9A-Fa-f]{2}/g);
    if (matches) {
      for (const match of matches) {
        const mac = match.replace(/-/g, ':').toLowerCase();
        if (mac !== '00:00:00:00:00:00') {
          macs.push(mac);
        }
      }
    }
  }

  return [...new Set(macs)];
}

function getWindowsMacs(): string[] {
  const version = getWindowsOsVersion();

  if (version === 'win8+') {
    console.log('[license] Windows 8+ 감지 – PowerShell 사용 (비활성 어댑터 포함)');
    const macs = getWindowsMacsModern();
    if (macs.length > 0) {
      return macs;
    }

    console.warn('[license] PowerShell 실패 – getmac 폴백');
    return getWindowsMacsLegacy();
  } else {
    console.log('[license] Windows 7 감지 – getmac 사용 (활성만)');
    return getWindowsMacsLegacy();
  }
}

// ── macOS : ifconfig ────────────────────────────────────────────────
function getMacOsMacs(): string[] {
  const macs: string[] = [];

  const out = safeSpawn('ifconfig', ['-a']); // -a: 비활성 인터페이스 포함
  if (out && typeof out === 'string') {
    const matches = out.match(/ether\s+([0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2}:[0-9a-f]{2})/gi);
    if (matches) {
      for (const match of matches) {
        const parts = match.split(/\s+/);
        const mac = parts[1]?.toLowerCase();
        if (mac && mac !== '00:00:00:00:00:00') {
          macs.push(mac);
        }
      }
    }
  }

  return [...new Set(macs)];
}

// ── Linux : /sys/class/net ─────────────────────────────────────────
function getLinuxMacs(): string[] {
  const macs: string[] = [];

  try {
    const netDir = '/sys/class/net';
    if (!fs.existsSync(netDir)) {
      return macs;
    }

    const ifaces = fs.readdirSync(netDir);
    for (const iface of ifaces) {
      if (iface === 'lo' || iface.startsWith('vnet') || iface.startsWith('docker')) {
        continue;
      }

      const addressPath = path.join(netDir, iface, 'address');
      const mac = safeReadFile(addressPath);

      if (mac && typeof mac === 'string' && mac !== '00:00:00:00:00:00' && !mac.startsWith('02:')) {
        macs.push(mac.toLowerCase());
      }
    }
  } catch (e) {
    console.warn('[license] Linux MAC 수집 실패:', (e as Error).message);
  }

  return [...new Set(macs)];
}

// ── Windows HDD Serial (물리 디스크) ────────────────────────────────
function getWindowsHddSerials(): string[] {
  const serials: string[] = [];
  // wmic diskdrive: 물리 디스크 시리얼 (volume serial이 아닌 실제 HW 시리얼)
  const out = safeSpawn('wmic', ['diskdrive', 'get', 'serialnumber', '/format:table']);
  if (out) {
    for (const line of out.split(/\r?\n/)) {
      const serial = line.trim().replace(/\s+/g, '');
      if (serial && serial !== 'SerialNumber' && serial.length > 2) {
        serials.push(serial);
      }
    }
  }
  return [...new Set(serials)];
}

// ── macOS HDD Serial ─────────────────────────────────────────────────
function getMacOsHddSerials(): string[] {
  const serials: string[] = [];
  // SPStorageDataType: SATA + NVMe 모두 커버
  const out = safeSpawn('system_profiler', ['SPStorageDataType'], 8000);
  if (out) {
    const matches = out.match(/Serial Number:\s*(\S+)/g);
    if (matches) {
      for (const m of matches) {
        const serial = m.replace(/Serial Number:\s*/, '').trim();
        if (serial && serial.length > 2) serials.push(serial);
      }
    }
  }
  return [...new Set(serials)];
}

// ── Linux HDD Serial ─────────────────────────────────────────────────
function getLinuxHddSerials(): string[] {
  const serials: string[] = [];
  try {
    const blockDir = '/sys/block';
    if (!fs.existsSync(blockDir)) return serials;
    for (const dev of fs.readdirSync(blockDir)) {
      // loop, ram, zram 장치 제외
      if (dev.startsWith('loop') || dev.startsWith('ram') || dev.startsWith('zram')) continue;
      const serial = safeReadFile(path.join(blockDir, dev, 'device', 'serial'));
      if (serial && serial.length > 2) serials.push(serial.trim());
    }
  } catch (e) {
    console.warn('[license] Linux HDD serial 수집 실패:', (e as Error).message);
  }
  return [...new Set(serials)];
}

// ── 모든 MachineID 수집 (핵심) ──────────────────────────────────────
export function getAllMachineIds(): string[] {
  const platform = os.platform();
  const ids: string[] = [];

  // 1단계: NIC MAC 수집 (비활성 포함, 모든 플랫폼)
  let macs: string[] = [];
  if (platform === 'win32') {
    macs = getWindowsMacs();
  } else if (platform === 'darwin') {
    macs = getMacOsMacs();
  } else {
    macs = getLinuxMacs();
  }
  for (const mac of macs) {
    ids.push(makeHwId(mac));
  }

  // 2단계: HDD Serial 수집 (모든 플랫폼, 항상)
  let serials: string[] = [];
  if (platform === 'win32') {
    serials = getWindowsHddSerials();
  } else if (platform === 'darwin') {
    serials = getMacOsHddSerials();
  } else {
    serials = getLinuxHddSerials();
  }
  for (const serial of serials) {
    ids.push(makeHwId(serial));
  }

  console.log(`[license] getAllMachineIds: ${ids.length} IDs (${macs.length} NICs + ${serials.length} HDDs) on ${platform}`);

  // 3단계: NIC + HDD 모두 없을 때만 OS UUID (최후 수단)
  // OS 재설치 시 코드가 바뀌므로 가능하면 사용 안 함
  if (ids.length === 0) {
    console.warn('[license] No hardware found – OS UUID를 최후 수단으로 사용');
    ids.push(makeHwId(getOsId()));
  }

  return ids;
}

// ── 타입 정의 ────────────────────────────────────────────────────────
export interface LicensePayload {
  machineId: string;
  machineIds: string[];
  userEmail?: string;  // 라이선스 발급 대상 이메일 (서명 포함)
  userName?:  string;  // 발급 대상 이름 (서명 포함)
  userOrg?:   string;  // 발급 대상 소속 (변경 가능 메타데이터 — 서명 제외)
  issuedAt: string;
  expiresAt: string;
  product: string;
}

export interface LicenseFile extends LicensePayload {
  sig: string;
}

export interface RequestPayload {
  machineId: string;
  machineIds: string[];
  requestedAt: string;
  product: string;
  sig: string;
}

export interface VerifyResult {
  valid: boolean;
  reason?: string;
  expiresAt?: string;
  machineId?: string;
  matchedIds?: string[];
  userEmail?: string;  // 라이선스 발급 대상 이메일 (신규 라이선스만 포함)
  userName?:  string;
  userOrg?:   string;
}

// ── 라이선스 파일 경로 ────────────────────────────────────────────────
export const LICENSE_FILE_PATH = path.join(getLicenseDir(), 'offline.ptzlic');
export const REQUEST_FILE_PATH = path.join(getLicenseDir(), 'license.ptzreq');

// ── 라이선스 요청 생성 ────────────────────────────────────────────────
export function createLicenseRequest(): RequestPayload {
  const machineIds = getAllMachineIds();
  const machineId = machineIds[0] ?? 'UNKNOWN';
  const requestedAt = new Date().toISOString();
  const payload = { machineId, machineIds, requestedAt, product: PRODUCT_ID };
  const sig = crypto
    .createHmac('sha256', MASTER_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 16);

  return { ...payload, sig };
}

/**
 * 라이선스 요청 저장
 * @param request - 선택적: RequestPayload. 제공되지 않으면 새로 생성
 */
export function saveRequestFile(request?: RequestPayload): string {
  // request가 제공되지 않으면 새로 생성
  const req = request || createLicenseRequest();
  
  const content = Buffer.from(JSON.stringify(req, null, 2)).toString('base64');
  fs.mkdirSync(path.dirname(REQUEST_FILE_PATH), { recursive: true });
  fs.writeFileSync(REQUEST_FILE_PATH, content, 'utf8');
  
  console.log('[license] License request saved at:', REQUEST_FILE_PATH);
  return REQUEST_FILE_PATH;
}

// ── 라이선스 발급 (제공자용) ────────────────────────────────────────────
export function issueLicense(
  machineId: string,
  machineIds: string[],
  expiresAt: string
): string {
  const payload: LicensePayload = {
    machineId,
    machineIds: machineIds?.length > 0 ? machineIds : [machineId],
    issuedAt: new Date().toISOString(),
    expiresAt,
    product: PRODUCT_ID,
  };
  const sig = crypto
    .createHmac('sha256', MASTER_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex');

  const licenseFile: LicenseFile = { ...payload, sig };
  return Buffer.from(JSON.stringify(licenseFile)).toString('base64');
}

// ── 라이선스 검증 (핵심) ────────────────────────────────────────────────
export function verifyLicense(licenseB64: string): VerifyResult {
  try {
    const raw = Buffer.from(licenseB64, 'base64').toString('utf8');
    const lic = JSON.parse(raw) as LicenseFile;
    // userOrg는 서명 외 메타데이터 → sig와 함께 분리 후 나머지만 검증
    const { sig, userOrg, ...signedPayload } = lic;
    const payload = signedPayload as LicensePayload;

    // 1. HMAC 서명 검증
    const expected = crypto
      .createHmac('sha256', MASTER_SECRET)
      .update(JSON.stringify(signedPayload))
      .digest('hex');
    if (sig !== expected) {
      return { valid: false, reason: '라이선스 서명이 올바르지 않습니다' };
    }

    // 2. Product 확인
    if (payload.product !== PRODUCT_ID) {
      return { valid: false, reason: '라이선스 제품이 일치하지 않습니다' };
    }

    // 3. MachineID 검증 (배열 매칭)
    const currentIds = getAllMachineIds();
    const licenseIds = payload.machineIds?.length ? payload.machineIds : [payload.machineId];
    const matchedIds = currentIds.filter((cur) => licenseIds.includes(cur));

    if (matchedIds.length === 0) {
      return {
        valid: false,
        reason: `이 PC에 발급된 라이선스가 아닙니다 (현재: ${currentIds.length}, 라이선스: ${licenseIds.length}, 일치: 0)`,
      };
    }

    // 4. 만료일 확인
    // "YYYY-MM-DD" 형식(날짜만)이면 해당일 23:59:59 UTC까지 유효 (하루 종일 사용 가능)
    const expiresAtStr = String(payload.expiresAt || '');
    const expiryDate = /^\d{4}-\d{2}-\d{2}$/.test(expiresAtStr)
      ? new Date(expiresAtStr + 'T23:59:59.999Z')
      : new Date(expiresAtStr);
    if (isNaN(expiryDate.getTime()) || expiryDate < new Date()) {
      return { valid: false, reason: `라이선스가 만료됨 (${expiresAtStr.slice(0, 10)})` };
    }

    return {
      valid:      true,
      expiresAt:  payload.expiresAt,
      machineId:  matchedIds[0],
      matchedIds,
      userEmail:  payload.userEmail,
      userName:   payload.userName,
      userOrg:    userOrg,   // 서명 외 메타데이터에서 읽음
    };
  } catch (e) {
    console.error('[license] verifyLicense error:', (e as Error).message);
    return { valid: false, reason: '라이선스 파일을 읽을 수 없습니다' };
  }
}

export function verifyLicenseFile(): VerifyResult {
  if (!fs.existsSync(LICENSE_FILE_PATH)) {
    return { valid: false, reason: 'NOT_FOUND' };
  }
  try {
    const content = fs.readFileSync(LICENSE_FILE_PATH, 'utf8').trim();
    return verifyLicense(content);
  } catch (e) {
    console.error('[license] verifyLicenseFile error:', (e as Error).message);
    return { valid: false, reason: '라이선스 파일을 읽을 수 없습니다' };
  }
}
