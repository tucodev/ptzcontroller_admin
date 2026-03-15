/**
 * lib/sms.ts — Aligo SMS 발송 유틸리티
 *
 * 환경변수:
 *   ALIGO_API_KEY  — Aligo API 인증키
 *   ALIGO_USER_ID  — Aligo 사용자 ID
 *   ALIGO_SENDER   — 발신번호 (사전 등록 필수)
 */

const ALIGO_API_KEY = process.env.ALIGO_API_KEY || "";
const ALIGO_USER_ID = process.env.ALIGO_USER_ID || "";
const ALIGO_SENDER = process.env.ALIGO_SENDER || "";

/** Aligo 환경변수가 모두 설정되어 있는지 확인 */
export function isSmsConfigured(): boolean {
    return !!(ALIGO_API_KEY && ALIGO_USER_ID && ALIGO_SENDER);
}

/**
 * Aligo SMS 발송
 * @param receivers - 수신 전화번호 배열 (예: ['01012345678'])
 * @param message  - SMS 메시지 (90byte 이하 → SMS, 초과 → LMS 자동)
 */
export async function sendSms(
    receivers: string[],
    message: string,
): Promise<{ success: boolean; error?: string }> {
    if (!isSmsConfigured()) {
        return { success: false, error: "Aligo SMS 환경변수 미설정" };
    }

    if (receivers.length === 0) {
        return { success: true }; // 수신자 없음 → skip
    }

    try {
        // 전화번호 정규화: 하이픈 제거
        const cleanReceivers = receivers
            .map((r) => r.replace(/[-\s]/g, ""))
            .filter(Boolean);

        if (cleanReceivers.length === 0) {
            return { success: true };
        }

        const formData = new URLSearchParams();
        formData.append("key", ALIGO_API_KEY);
        formData.append("user_id", ALIGO_USER_ID);
        formData.append("sender", ALIGO_SENDER);
        formData.append("receiver", cleanReceivers.join(","));
        formData.append("msg", message);
        // msg_type 미지정 시 자동 판별 (90byte 이하 SMS, 초과 LMS)

        const res = await fetch("https://apis.aligo.in/send/", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: formData.toString(),
        });

        const data = await res.json();

        if (data.result_code === 1) {
            console.log(
                `[SMS] Sent to ${cleanReceivers.length} recipients (msg_id: ${data.msg_id})`,
            );
            return { success: true };
        } else {
            console.error("[SMS] Aligo error:", data.message);
            return { success: false, error: data.message };
        }
    } catch (err) {
        console.error("[SMS] Send error:", err);
        return {
            success: false,
            error: err instanceof Error ? err.message : "SMS 발송 실패",
        };
    }
}

/**
 * admin 사용자의 설정에서 SMS 토글 값 읽기
 * 여러 admin 중 하나라도 켜져 있으면 true
 */
export async function getSmsSettings(): Promise<{
    smsNotifySignup: boolean;
    smsNotifyLicense: boolean;
}> {
    try {
        const { prisma } = await import("@/lib/db");
        const configs = await prisma.userConfig.findMany({
            where: {
                key: "settings",
                user: { role: "admin" },
            },
            select: { value: true },
        });

        let signup = false;
        let license = false;
        for (const c of configs) {
            try {
                const parsed = JSON.parse(c.value);
                if (parsed.smsNotifySignup) signup = true;
                if (parsed.smsNotifyLicense) license = true;
            } catch { /* ignore */ }
        }
        return { smsNotifySignup: signup, smsNotifyLicense: license };
    } catch {
        return { smsNotifySignup: false, smsNotifyLicense: false };
    }
}

/**
 * admin 역할 + 전화번호 등록된 사용자에게 SMS 발송
 */
export async function sendSmsToAdmins(
    message: string,
): Promise<{ success: boolean; error?: string }> {
    try {
        const { prisma } = await import("@/lib/db");
        const admins = await prisma.user.findMany({
            where: {
                role: "admin",
                phone: { not: null },
            },
            select: { phone: true },
        });

        const phones = admins
            .map((a: { phone: string | null }) => a.phone)
            .filter((p): p is string => !!p);

        if (phones.length === 0) {
            console.log("[SMS] No admin phone numbers registered — skipping");
            return { success: true };
        }

        return sendSms(phones, message);
    } catch (err) {
        console.error("[SMS] sendSmsToAdmins error:", err);
        return {
            success: false,
            error: err instanceof Error ? err.message : "SMS 발송 실패",
        };
    }
}
