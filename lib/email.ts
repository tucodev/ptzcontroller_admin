import nodemailer from "nodemailer";

// ─── SMTP 설정 ─────────────────────────────────────────────
const SMTP_HOST = process.env.SMTP_HOST || "";
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_USER = process.env.SMTP_USER || "";
const SMTP_PASS = process.env.SMTP_PASSWORD || process.env.SMTP_PASS || "";
const SMTP_FROM = process.env.SMTP_FROM || `PTZ Controller <${SMTP_USER}>`;

/** SMTP가 설정되어 있는지 확인 */
export function isSmtpConfigured(): boolean {
    return !!(SMTP_HOST && SMTP_USER && SMTP_PASS);
}

/** Nodemailer transporter 생성 */
function createTransporter() {
    if (!isSmtpConfigured()) {
        throw new Error(
            "SMTP가 설정되지 않았습니다. .env 파일에 SMTP_HOST, SMTP_USER, SMTP_PASS를 설정해주세요.",
        );
    }

    return nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: SMTP_PORT === 465, // 465=SSL, 587=STARTTLS
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS,
        },
        //👇 이 부분을 추가하세요 (메일 오류시)👇
        tls: {
            rejectUnauthorized: false,
        },
    });
}

// ─── 관리자 강제 리셋: 임시 비밀번호 발송 ─────────────────────

export async function sendPasswordResetEmail(
    to: string,
    tempPassword: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const transporter = createTransporter();

        await transporter.sendMail({
            from: SMTP_FROM,
            to,
            subject: "[PTZ Controller] 비밀번호가 초기화되었습니다",
            html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a2e; margin-bottom: 16px;">비밀번호 초기화 안내</h2>
          <p style="color: #444; line-height: 1.6;">
            관리자에 의해 비밀번호가 초기화되었습니다.<br/>
            아래 임시 비밀번호로 로그인한 후 비밀번호를 변경해주세요.
          </p>
          <div style="background: #f0f4ff; border: 1px solid #d0d8f0; border-radius: 8px; padding: 16px; margin: 20px 0; text-align: center;">
            <p style="margin: 0 0 4px 0; font-size: 13px; color: #666;">임시 비밀번호</p>
            <p style="margin: 0; font-size: 22px; font-weight: bold; font-family: 'Courier New', monospace; color: #1a1a2e; letter-spacing: 2px;">
              ${tempPassword}
            </p>
          </div>
          <p style="color: #888; font-size: 12px; line-height: 1.5;">
            보안을 위해 로그인 후 반드시 비밀번호를 변경해주세요.<br/>
            본인이 요청하지 않았다면 관리자에게 문의하세요.
          </p>
        </div>
      `,
        });

        return { success: true };
    } catch (err) {
        console.error("[Email] sendPasswordResetEmail error:", err);
        return {
            success: false,
            error:
                err instanceof Error
                    ? err.message
                    : "이메일 발송에 실패했습니다.",
        };
    }
}

// ─── 셀프서비스: 리셋 링크 발송 ───────────────────────────────

export async function sendResetLinkEmail(
    to: string,
    resetToken: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const transporter = createTransporter();

        const baseUrl =
            process.env.NEXTAUTH_URL ||
            process.env.NEXT_PUBLIC_BASE_URL ||
            "http://localhost:3000";
        const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;

        await transporter.sendMail({
            from: SMTP_FROM,
            to,
            subject: "[PTZ Controller] 비밀번호 재설정 요청",
            html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a2e; margin-bottom: 16px;">비밀번호 재설정</h2>
          <p style="color: #444; line-height: 1.6;">
            비밀번호 재설정이 요청되었습니다.<br/>
            아래 버튼을 클릭하여 새 비밀번호를 설정해주세요.
          </p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${resetUrl}"
               style="display: inline-block; background: #3b82f6; color: #fff; text-decoration: none;
                      padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">
              비밀번호 재설정
            </a>
          </div>
          <p style="color: #888; font-size: 12px; line-height: 1.5;">
            이 링크는 1시간 동안 유효합니다.<br/>
            버튼이 작동하지 않으면 아래 링크를 브라우저에 복사해주세요:<br/>
            <a href="${resetUrl}" style="color: #3b82f6; word-break: break-all;">${resetUrl}</a>
          </p>
          <p style="color: #aaa; font-size: 11px; margin-top: 24px;">
            본인이 요청하지 않았다면 이 메일을 무시하세요.
          </p>
        </div>
      `,
        });

        return { success: true };
    } catch (err) {
        console.error("[Email] sendResetLinkEmail error:", err);
        return {
            success: false,
            error:
                err instanceof Error
                    ? err.message
                    : "이메일 발송에 실패했습니다.",
        };
    }
}

// ─── 라이선스 요청 알림 (관리자에게) ──────────────────────────────

export async function sendLicenseRequestNotifyEmail(
    adminEmails: string[],
    requester: { name: string; email: string; org: string; machineId: string },
): Promise<{ success: boolean; error?: string }> {
    if (adminEmails.length === 0) return { success: true };
    try {
        const transporter = createTransporter();

        const licenseServerUrl =
            process.env.LICENSE_SERVER_URL || "http://localhost:4000";

        await transporter.sendMail({
            from: SMTP_FROM,
            to: adminEmails.join(","),
            subject: "[PTZ Controller] 새 오프라인 라이선스 요청",
            html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
          <h2 style="color: #1a1a2e; margin-bottom: 16px;">오프라인 라이선스 요청</h2>
          <p style="color: #444; line-height: 1.6;">
            새로운 오프라인 라이선스 요청이 접수되었습니다.
          </p>
          <div style="background: #f0f4ff; border: 1px solid #d0d8f0; border-radius: 8px; padding: 16px; margin: 20px 0;">
            <table style="width: 100%; font-size: 14px; color: #333;">
              <tr><td style="padding: 4px 8px; color: #666;">이름</td><td style="padding: 4px 8px; font-weight: 600;">${requester.name || '(미입력)'}</td></tr>
              <tr><td style="padding: 4px 8px; color: #666;">이메일</td><td style="padding: 4px 8px; font-weight: 600;">${requester.email}</td></tr>
              <tr><td style="padding: 4px 8px; color: #666;">소속</td><td style="padding: 4px 8px; font-weight: 600;">${requester.org || '(미입력)'}</td></tr>
              <tr><td style="padding: 4px 8px; color: #666;">머신 ID</td><td style="padding: 4px 8px; font-family: 'Courier New', monospace; font-size: 11px; word-break: break-all;">${requester.machineId}</td></tr>
              <tr><td style="padding: 4px 8px; color: #666;">요청 시간</td><td style="padding: 4px 8px;">${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</td></tr>
            </table>
          </div>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${licenseServerUrl}"
               style="display: inline-block; background: #3b82f6; color: #fff; text-decoration: none;
                      padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">
              라이선스 관리 페이지
            </a>
          </div>
          <p style="color: #888; font-size: 12px; line-height: 1.5;">
            위 버튼을 클릭하여 라이선스 서버에서 요청을 승인 또는 거절할 수 있습니다.
          </p>
        </div>
      `,
        });

        return { success: true };
    } catch (err) {
        console.error("[Email] sendLicenseRequestNotifyEmail error:", err);
        return {
            success: false,
            error:
                err instanceof Error
                    ? err.message
                    : "이메일 발송에 실패했습니다.",
        };
    }
}

// ─── 임시 비밀번호 생성 ────────────────────────────────────────

/** 12자 랜덤 비밀번호 (영대소문자 + 숫자 + 특수문자) */
export function generateTempPassword(length = 12): string {
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const digits = "0123456789";
    const special = "!@#$%&*";
    const all = upper + lower + digits + special;

    // 최소 1개씩 보장
    const password = [
        upper[Math.floor(Math.random() * upper.length)],
        lower[Math.floor(Math.random() * lower.length)],
        digits[Math.floor(Math.random() * digits.length)],
        special[Math.floor(Math.random() * special.length)],
    ];

    for (let i = password.length; i < length; i++) {
        password.push(all[Math.floor(Math.random() * all.length)]);
    }

    // 셔플
    for (let i = password.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [password[i], password[j]] = [password[j], password[i]];
    }

    return password.join("");
}
