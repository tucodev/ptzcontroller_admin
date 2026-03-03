/**
 * issue-license.js
 *
 * ⚠️  제공자 전용 — 사용자에게 배포하지 말 것
 *
 * 사용자로부터 받은 .ptzreq 파일을 검증하고
 * 해당 PC에서만 유효한 라이센스 파일(.ptzlic)을 생성합니다.
 *
 * 사용법:
 *   node scripts/issue-license.js <요청파일.ptzreq> [만료일]
 *
 * 예시:
 *   node scripts/issue-license.js ptzcontroller-07E89ACE3657A538.ptzreq
 *   node scripts/issue-license.js ptzcontroller-07E89ACE3657A538.ptzreq 2027-12-31
 *
 * 만료일 미지정 시 1년 후로 자동 설정.
 *
 * 환경변수:
 *   LICENSE_SECRET  제공자의 서명 비밀키 (앱의 .env 와 동일 값 사용)
 */

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

// ── 설정 ──────────────────────────────────────────────────────
// ⚠️ 이 값은 앱의 .env LICENSE_SECRET 과 반드시 동일해야 함
const MASTER_SECRET =
    process.env.LICENSE_SECRET ?? "TYCHE-PTZ-LICENSE-SECRET-2024";
const PRODUCT_ID = "PTZ-OFFLINE";

// ── 인자 파싱 ─────────────────────────────────────────────────
const reqFilePath = process.argv[2];
const expiresArg = process.argv[3]; // 선택: 'YYYY-MM-DD'

if (!reqFilePath) {
    console.error("");
    console.error(
        "사용법: node scripts/issue-license.js <요청파일.ptzreq> [만료일]",
    );
    console.error(
        "예시  : node scripts/issue-license.js ptzcontroller-07E89ACE.ptzreq 2027-12-31",
    );
    console.error("");
    process.exit(1);
}

if (!fs.existsSync(reqFilePath)) {
    console.error(`[ERROR] 요청 파일을 찾을 수 없습니다: ${reqFilePath}`);
    process.exit(1);
}

// ── 요청 파일 읽기 + 검증 ────────────────────────────────────
let request;
try {
    const raw = fs.readFileSync(reqFilePath, "utf8").trim();
    const decoded = Buffer.from(raw, "base64").toString("utf8");
    request = JSON.parse(decoded);
} catch (e) {
    console.error("[ERROR] 요청 파일 파싱 실패:", e.message);
    process.exit(1);
}

// 요청 서명 검증 (위·변조 방지)
const { sig: reqSig, ...reqPayload } = request;
const expectedReqSig = crypto
    .createHmac("sha256", MASTER_SECRET)
    .update(JSON.stringify(reqPayload))
    .digest("hex")
    .slice(0, 16);

if (reqSig !== expectedReqSig) {
    console.error(
        "[ERROR] 요청 파일 서명이 올바르지 않습니다. 파일이 변조되었을 수 있습니다.",
    );
    process.exit(1);
}

if (request.product !== PRODUCT_ID) {
    console.error(`[ERROR] 제품 ID 불일치: ${request.product}`);
    process.exit(1);
}

// ── 만료일 결정 ───────────────────────────────────────────────
let expiresAt;
if (expiresArg) {
    const d = new Date(expiresArg + "T23:59:59Z");
    if (isNaN(d.getTime())) {
        console.error(
            `[ERROR] 만료일 형식 오류: "${expiresArg}" (YYYY-MM-DD 형식 사용)`,
        );
        process.exit(1);
    }
    expiresAt = d.toISOString();
} else {
    // 기본값: 1년 후
    const d = new Date();
    d.setFullYear(d.getFullYear() + 1);
    expiresAt = d.toISOString();
}

// ── 라이센스 생성 ─────────────────────────────────────────────
const licPayload = {
    machineId: request.machineId,
    issuedAt: new Date().toISOString(),
    expiresAt,
    product: PRODUCT_ID,
};

const licSig = crypto
    .createHmac("sha256", MASTER_SECRET)
    .update(JSON.stringify(licPayload))
    .digest("hex"); // 라이센스 서명은 전체 64자

const licenseContent = Buffer.from(
    JSON.stringify({ ...licPayload, sig: licSig }),
).toString("base64");

// ── 출력 파일 저장 ────────────────────────────────────────────
const outFileName = `ptzcontroller-${request.machineId}.ptzlic`;
const outFilePath = path.join(path.dirname(reqFilePath), outFileName);
fs.writeFileSync(outFilePath, licenseContent, "utf8");

// ── 결과 출력 ─────────────────────────────────────────────────
console.log("");
console.log("╔══════════════════════════════════════════════════════╗");
console.log("║                   라이센스 발급 완료                 ║");
console.log("╠══════════════════════════════════════════════════════╣");
console.log(`║  MachineID  : ${request.machineId.padEnd(36)}   ║`);
console.log(`║  요청일     : ${request.requestedAt.slice(0, 10).padEnd(38)} ║`);
console.log(`║  발급일     : ${licPayload.issuedAt.slice(0, 10).padEnd(38)} ║`);
console.log(`║  만료일     : ${expiresAt.slice(0, 10).padEnd(38)} ║`);
console.log("╠══════════════════════════════════════════════════════╣");
console.log(`║  출력 파일  : ${outFileName.padEnd(36)}  ║`);
console.log("╚══════════════════════════════════════════════════════╝");
console.log("");
console.log(`이 파일을 사용자에게 전달하세요: ${outFilePath}`);
console.log("");
