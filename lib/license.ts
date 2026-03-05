/**
 * license.ts
 *
 * 오프라인 모드 라이센스 시스템
 *
 * ── 전체 흐름 ──────────────────────────────────────────────
 *
 *  [사용자 PC]                         [제공자]
 *  1. 오프라인 버튼 클릭
 *  2. PC 고유코드(MachineID) 생성
 *  3. 요청 파일 생성 (*.ptzreq)
 *     → 파일 전달 (이메일 등) →
 *                                   4. scripts/issue-license.js 실행
 *                                   5. 라이센스 파일 생성 (*.ptzlic)
 *                                      - MachineID 포함 + HMAC 서명
 *                                   ← 파일 전달 ←
 *  6. 라이센스 파일 로딩
 *  7. 서명 검증 + MachineID 매칭
 *  8. 통과 시 오프라인 모드 진행
 *
 * ── 보안 원칙 ──────────────────────────────────────────────
 *  - MASTER_SECRET 은 환경변수(LICENSE_SECRET)에서 로드
 *  - 라이센스 = base64(JSON({ machineId, issuedAt, expiresAt, product, sig }))
 *  - sig = HMAC-SHA256(payload_without_sig, MASTER_SECRET) 전체 hex
 *  - MachineID = SHA256(OS고유값 || 물리NIC MAC들)[:16] 대문자
 *               OS 고유값(MachineGuid/IOPlatformUUID/machine-id) + 물리 NIC MAC 조합
 *  - 다른 PC에서 발급된 라이센스는 MachineID 불일치로 무효
 */

import * as crypto from 'crypto';
import * as os     from 'os';
import * as fs     from 'fs';
import * as path   from 'path';
import { execSync } from 'child_process';

// ── 상수 ─────────────────────────────────────────────────────
// ⚠️ 반드시 .env 의 LICENSE_SECRET 를 설정할 것.
//    없으면 빌드마다 다른 기본값이 사용되어 기존 라이센스가 무효화됨.
const MASTER_SECRET  = process.env.LICENSE_SECRET ?? 'TYCHE-PTZ-LICENSE-SECRET-2024';
const PRODUCT_ID     = 'PTZ-OFFLINE';

// ── 라이센스 파일 저장 위치 결정 ─────────────────────────────
// 우선순위:
//   1. PTZ_DATA_DIR 환경변수 — Electron main.js 가 app.getPath('userData') 로 주입
//        Windows : C:\Users\<user>\AppData\Roaming\ptzcontroller_admin\data\
//        macOS   : ~/Library/Application Support/ptzcontroller_admin/data/
//        Linux   : ~/.config/ptzcontroller_admin/data/
//      → 앱 재설치 / 업데이트 시에도 라이센스 파일이 유지됨
//   2. 폴백 (개발 환경 / 웹 서버 단독 실행)
//        process.cwd()/data/  (standalone/ 폴더 안)
// ===> 수정
// ★ 공유 라이선스 경로 (웹서버 + Desktop 공용)
//   Windows : C:\ProgramData\PTZController\
//   macOS   : /Library/Application Support/PTZController/
//   Linux   : ~/.config/PTZController/
// ptzcontroller_desktop 의 main.js 도 동일 경로로 맞춰야 함
function getSharedLicenseDir(): string {
  if (process.platform === 'win32') {
    const programData = process.env.PROGRAMDATA || process.env.ALLUSERSPROFILE || 'C:\\ProgramData';
    return path.join(programData, 'PTZController');
  } else if (process.platform === 'darwin') {
    return '/Library/Application Support/PTZController';
  } else {
    return path.join(process.env.HOME || '/etc', '.config', 'PTZController');
  }
}

function getLicenseDir(): string {
  // PTZ_DATA_DIR 가 명시적으로 주입된 경우 우선 사용 (Electron 환경)
  if (process.env.PTZ_DATA_DIR) {
    return path.join(process.env.PTZ_DATA_DIR, 'data');
  }
  // 웹 서버 단독 실행 시 공유 경로 사용 → Desktop 과 동일 파일 공유
  return getSharedLicenseDir();
}

export const LICENSE_FILE_PATH = path.join(getLicenseDir(), 'offline.ptzlic');
export const REQUEST_FILE_PATH = path.join(getLicenseDir(), 'license.ptzreq');

// ── 타입 ─────────────────────────────────────────────────────
export interface LicensePayload {
    machineId:  string;         // 발급 시점 대표 MachineID (하위 호환)
    machineIds: string[];       // 발급 시점 내장 NIC 별 MachineID 배열
    issuedAt:   string;
    expiresAt:  string; // ISO 8601 (예: '2099-12-31T23:59:59Z')
    product:    string;
}

export interface LicenseFile extends LicensePayload {
    sig: string; // HMAC-SHA256 전체 hex
}

export interface RequestPayload {
    machineId: string;
    requestedAt: string;
    product: string;
    sig: string; // 요청 파일 위·변조 방지용 서명
}

export interface VerifyResult {
    valid: boolean;
    reason?: string; // 실패 사유 (valid=false 일 때만)
    expiresAt?: string; // 성공 시 만료일
    machineId?: string; // 성공 시 MachineID
}

// ── PC 고유코드(MachineID) 생성 ──────────────────────────────
/**
 * getOsId(): OS 독립적인 고유값 읽기 (내부 헬퍼)
 *
 * Windows : HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid
 *           → OS 설치 시 생성. OS 재설치 시 변경되지만 하드웨어 식별자(MAC/HDD)와
 *             조합하므로 단독 사용하지 않음 — salt 역할만 담당
 * macOS   : IOPlatformUUID (하드웨어 고정)
 * Linux   : /etc/machine-id
 */
function getOsId(): string {
  const platform = os.platform();
  let osId = '';
  try {
    if (platform === 'win32') {
      const out = execSync(
        'reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid',
        { timeout: 3000, windowsHide: true }
      ).toString();
      osId = out.split('\n')
        .find(l => l.includes('MachineGuid'))
        ?.split(/\s+/).pop()
        ?.trim() ?? '';
    } else if (platform === 'darwin') {
      osId = execSync(
        `ioreg -rd1 -c IOPlatformExpertDevice | awk -F"'" '/IOPlatformUUID/{print $4}'`,
        { timeout: 3000 }
      ).toString().trim();
    } else {
      osId = execSync(
        'cat /etc/machine-id 2>/dev/null || cat /var/lib/dbus/machine-id 2>/dev/null',
        { timeout: 3000 }
      ).toString().trim();
    }
  } catch { osId = ''; }

  return osId || [os.platform(), os.arch(), os.totalmem().toString()].join('|');
}

/**
 * makeHwId(): 하드웨어 식별자 문자열로 MachineID 생성 (내부 헬퍼)
 * SHA256(osId || hwKey)[:16] 대문자
 */
function makeHwId(osId: string, hwKey: string): string {
  return crypto
    .createHash('sha256')
    .update([osId, hwKey].join('||'))
    .digest('hex')
    .slice(0, 16)
    .toUpperCase();
}

/**
 * getAllMachineIds(): 물리 NIC MAC + 내장 HDD 시리얼 각각을 해시하여 배열 반환.
 *
 * ── 수집 대상 ────────────────────────────────────────────────
 * [NIC MAC]
 *   Windows : PowerShell Get-NetAdapter (HardwareInterface=true)
 *             → 비활성화된 NIC 포함, 가상 NIC(VPN/Docker) 제외
 *             → wmic는 Windows 11에서 제거됨
 *   macOS   : networksetup -listallhardwareports
 *   Linux   : /sys/class/net/<iface>/address
 *
 * [HDD 시리얼]
 *   Windows : PowerShell Get-PhysicalDisk (BusType != USB)
 *             → USB/이동식 제외, 내장 디스크만
 *   macOS   : diskutil info disk0 (부트 디스크)
 *   Linux   : /sys/block/<dev>/serial (루프백 제외)
 *
 * ── 반환값 ───────────────────────────────────────────────────
 * [SHA256(osId||mac1)[:16], ..., SHA256(osId||hdd1)[:16], ...]
 * NIC도 HDD도 없으면 [] 반환 (호출부에서 오류 처리)
 *
 * ── 검증 ─────────────────────────────────────────────────────
 * 발급 시 배열 전체 저장 → 검증 시 하나라도 일치하면 통과
 * NIC 교체되어도 HDD로, HDD 교체되어도 NIC으로 통과
 */
export function getAllMachineIds(): string[] {
  const platform = os.platform();
  const osId     = getOsId();
  const ids: string[] = [];

  // ── 1. 물리 NIC MAC (비활성화 포함) ──────────────────────────
  try {
    if (platform === 'win32') {
      // wmic는 Windows 11에서 제거됨 → PowerShell 사용
      // Get-NetAdapter: 비활성화 NIC 포함 모든 물리 NIC
      const out = execSync(
        'powershell -NoProfile -Command "Get-NetAdapter | Where-Object {$_.HardwareInterface -eq $true} | Select-Object -ExpandProperty MacAddress"',
        { timeout: 8000, windowsHide: true }
      ).toString();
      for (const line of out.split(/\r?\n/)) {
        // PowerShell MacAddress 형식: "A0-B1-C2-D3-E4-F5" (하이픈) → 콜론으로 정규화
        const raw = line.trim().replace(/-/g, ':').toLowerCase();
        if (/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/.test(raw) && raw !== '00:00:00:00:00:00') {
          ids.push(makeHwId(osId, raw));
        }
      }
    } else if (platform === 'darwin') {
      const out = execSync('networksetup -listallhardwareports', { timeout: 5000 }).toString();
      for (const line of out.split('\n')) {
        const m = line.trim().match(/Ethernet Address:\s*([0-9a-f:]{17})/i);
        if (m && m[1] !== '00:00:00:00:00:00') ids.push(makeHwId(osId, m[1].toLowerCase()));
      }
    } else {
      const ifaces = execSync('ls /sys/class/net', { timeout: 3000 }).toString().trim().split('\n');
      for (const iface of ifaces) {
        try {
          const mac = execSync(`cat /sys/class/net/${iface.trim()}/address`, { timeout: 1000 })
            .toString().trim().toLowerCase();
          if (mac && mac !== '00:00:00:00:00:00' && !mac.startsWith('02:') && iface.trim() !== 'lo') {
            ids.push(makeHwId(osId, mac));
          }
        } catch { /* skip */ }
      }
    }
  } catch (e) {
    console.warn('[license] NIC 수집 실패:', e);
  }

  // ── 2. 내장 HDD 시리얼 (USB/이동식 제외) ─────────────────────
  try {
    if (platform === 'win32') {
      // Get-PhysicalDisk: USB 드라이브 제외 (BusType != USB)
      const out = execSync(
        `powershell -NoProfile -Command "Get-PhysicalDisk | Where-Object {$_.BusType -ne 'USB'} | Select-Object -ExpandProperty SerialNumber"`,
        { timeout: 8000, windowsHide: true }
      ).toString();
      for (const line of out.split(/\r?\n/)) {
        const serial = line.trim();
        if (serial && serial.length > 0) {
          ids.push(makeHwId(osId, serial));
        }
      }
    } else if (platform === 'darwin') {
      // macOS: 부트 디스크 시리얼
      try {
        const out = execSync(
          'system_profiler SPStorageDataType | grep "Serial Number"',
          { timeout: 5000 }
        ).toString();
        for (const line of out.split('\n')) {
          const m = line.match(/Serial Number:\s*(.+)/i);
          if (m) ids.push(makeHwId(osId, m[1].trim()));
        }
      } catch { /* skip */ }
    } else {
      // Linux: /sys/block 에서 내장 디스크 시리얼
      try {
        const devs = execSync('ls /sys/block', { timeout: 3000 }).toString().trim().split('\n');
        for (const dev of devs) {
          const d = dev.trim();
          if (!d || d.startsWith('loop') || d.startsWith('ram')) continue;
          try {
            const serial = execSync(
              `cat /sys/block/${d}/device/serial 2>/dev/null || udevadm info /dev/${d} 2>/dev/null | grep ID_SERIAL_SHORT | cut -d= -f2`,
              { timeout: 2000 }
            ).toString().trim();
            if (serial) ids.push(makeHwId(osId, serial));
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }
  } catch (e) {
    console.warn('[license] HDD 수집 실패:', e);
  }

  // ── 3. 폴백: os.networkInterfaces() (활성 NIC만이라도 사용) ──
  if (ids.length === 0) {
    console.warn('[license] PowerShell 수집 실패 — os.networkInterfaces() 폴백 사용');
    for (const addrs of Object.values(os.networkInterfaces())) {
      for (const a of (addrs ?? [])) {
        const mac = a.mac?.toLowerCase() ?? '';
        if (!a.internal && mac !== '00:00:00:00:00:00' && !mac.startsWith('02:')) {
          ids.push(makeHwId(osId, mac));
        }
      }
    }
  }

  console.log('[license] getAllMachineIds:', ids.length, 'ids collected, platform:', platform);
  // 중복 제거 후 반환
  return [...new Set(ids)];
}

// ── 요청 파일 생성 ────────────────────────────────────────────
/**
 * 사용자가 제공자에게 전달할 요청 파일(.ptzreq)의 내용을 생성.
 * 요청 파일에 서명을 포함시켜 위·변조 방지.
 */
export function createLicenseRequest(): RequestPayload {
  const machineIds  = getAllMachineIds();
  const machineId   = machineIds[0] ?? 'UNKNOWN'; // 대표값 (하위 호환용)
  const requestedAt = new Date().toISOString();
  const payload     = { machineId, machineIds, requestedAt, product: PRODUCT_ID };
  const sig         = crypto
    .createHmac('sha256', MASTER_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex')
    .slice(0, 16); // 요청 서명은 16자만 사용 (파일 크기 최소화)

  return { ...payload, sig };
}

/**
 * 요청 파일을 data/license.ptzreq 로 저장.
 * JSON을 base64 인코딩하여 저장 (바이너리처럼 보이게).
 */
export function saveRequestFile(): string {
  const request = createLicenseRequest();
  const content = Buffer.from(JSON.stringify(request, null, 2)).toString('base64');
  fs.mkdirSync(path.dirname(REQUEST_FILE_PATH), { recursive: true });
  fs.writeFileSync(REQUEST_FILE_PATH, content, 'utf8');
  return REQUEST_FILE_PATH;
}

// ── 라이센스 생성 (제공자용) ──────────────────────────────────
/**
 * ⚠️ 제공자 전용 함수. 서버/스크립트에서만 사용.
 * 요청 파일을 검증하고, 해당 PC에서만 유효한 라이센스를 생성.
 *
 * @param machineId  요청 파일에서 추출한 MachineID
 * @param expiresAt  만료일 (ISO 8601, 예: '2026-12-31T23:59:59Z')
 * @returns          base64 인코딩된 라이센스 문자열
 */
export function issueLicense(machineId: string, expiresAt: string, machineIds?: string[]): string {
  const payload: LicensePayload = {
    machineId,
    machineIds: machineIds ?? [machineId],
    issuedAt:   new Date().toISOString(),
    expiresAt,
    product:    PRODUCT_ID,
  };
  const sig = crypto
    .createHmac('sha256', MASTER_SECRET)
    .update(JSON.stringify(payload))
    .digest('hex'); // 라이센스 서명은 전체 64자 사용

  const licenseFile: LicenseFile = { ...payload, sig };
  return Buffer.from(JSON.stringify(licenseFile)).toString('base64');
}

// ── 라이센스 검증 ─────────────────────────────────────────────
/**
 * base64 라이센스 문자열을 검증.
 * 1. JSON 파싱
 * 2. HMAC 서명 일치 확인
 * 3. MachineID 일치 확인 (현재 PC 와 비교)
 * 4. 만료일 확인
 */
export function verifyLicense(licenseB64: string): VerifyResult {
  try {
    const raw     = Buffer.from(licenseB64, 'base64').toString('utf8');
    const lic     = JSON.parse(raw) as LicenseFile;
    const { sig, ...payload } = lic;

    // 1. 서명 검증
    const expected = crypto
      .createHmac('sha256', MASTER_SECRET)
      .update(JSON.stringify(payload))
      .digest('hex');
    if (sig !== expected) {
      return { valid: false, reason: '라이센스 서명이 올바르지 않습니다' };
    }

    // 2. Product 확인
    if (payload.product !== PRODUCT_ID) {
      return { valid: false, reason: '라이센스 제품이 일치하지 않습니다' };
    }

        // 3. MachineID 검증 — 현재 PC 의 모든 NIC ID 중 하나라도 매칭되면 통과
        //    LAN 어댑터가 비활성화되어도 다른 어댑터로 검증 가능
        const currentIds  = getAllMachineIds();
        const licenseIds  = payload.machineIds?.length
          ? payload.machineIds
          : [payload.machineId]; // 구버전 라이선스 (machineIds 없음) 하위 호환
        const matched = currentIds.some(cur => licenseIds.includes(cur));
        if (!matched) {
            return {
                valid: false,
                reason: `이 PC에 발급된 라이센스가 아닙니다\n현재 PC: ${currentIds[0] ?? 'UNKNOWN'}\n라이센스: ${payload.machineId}`,
            };
        }

        // 4. 만료일 확인
        if (new Date(payload.expiresAt) < new Date()) {
            return {
                valid: false,
                reason: `라이센스가 만료되었습니다 (${payload.expiresAt.slice(0, 10)})`,
            };
        }

    return {
      valid:     true,
      expiresAt: payload.expiresAt,
      machineId: payload.machineId,
    };
  } catch {
    return { valid: false, reason: '라이센스 파일을 읽을 수 없습니다' };
  }
}

/**
 * 저장된 라이센스 파일을 읽어 검증.
 * 파일이 없으면 { valid: false, reason: 'NOT_FOUND' } 반환.
 */
export function verifyLicenseFile(): VerifyResult {
  if (!fs.existsSync(LICENSE_FILE_PATH)) {
    return { valid: false, reason: 'NOT_FOUND' };
  }
  try {
    const content = fs.readFileSync(LICENSE_FILE_PATH, 'utf8').trim();
    return verifyLicense(content);
  } catch {
    return { valid: false, reason: '라이센스 파일을 읽을 수 없습니다' };
  }
}
